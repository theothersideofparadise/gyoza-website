/** Bound Google Apps Script: checkout -> private Google Sheet. Deploy as owner / Anyone. */
const CONFIG = {
  SHOP_NAME: '煎福鍋貼專賣', SHEET_ORDERS: '訂單', SHEET_ITEMS: '訂單明細', SHEET_PRODUCTS: '商品',
  STATUSES: ['新訂單', '製作中', '待取餐', '配送中', '已完成', '已取消'], MAX_QTY_PER_ITEM: 50, MAX_ITEMS: 30,
  OWNER_EMAIL: '', SEND_CUSTOMER_MAIL: true
};
const ORDER_HEADERS = ['訂單編號','建立時間','狀態','取餐方式','姓名','手機','Email','門市','地址','備註','小計','運費/服務費','應付總額','更新時間','請求ID','請求摘要','寫入狀態'];
const ITEM_HEADERS = ['訂單編號','商品ID','品名','單價','數量','小計'];
const PRODUCT_HEADERS = ['商品ID','品名','單價','分類','上架(TRUE/FALSE)'];
const STORES = { flag: '旗艦店', xinyi: '信義店', taichung: '台中店' };
const FEES = {
  dine: { name: '內用', fee: s => Math.round(s * .1), eta: '約 15–20 分鐘' },
  take: { name: '外帶', fee: () => 0, eta: '約 15–20 分鐘' },
  ship: { name: '宅配', fee: s => s >= 1000 ? 0 : 150, eta: '2–3 個工作天' }
};
function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Run setup from the bound spreadsheet first');
  return ss;
}
/* Idempotent setup: never clear existing orders or replace the merchant's prices. */
function setup() {
  const ss = spreadsheet_();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  for (const [name, headers] of [[CONFIG.SHEET_ORDERS, ORDER_HEADERS], [CONFIG.SHEET_ITEMS, ITEM_HEADERS], [CONFIG.SHEET_PRODUCTS, PRODUCT_HEADERS]]) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const old = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (old.some((value, i) => value && value !== headers[i])) throw new Error(name + ' 欄位與預期不符，請先備份並確認欄位');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setBackground('#eeeeee').setFontColor('#000000').setFontWeight('bold');
    if (name === CONFIG.SHEET_PRODUCTS && sh.getLastRow() < 2) sh.getRange(2,1,PRODUCTS.length,5).setValues(PRODUCTS);
  }
  const orders = ss.getSheetByName(CONFIG.SHEET_ORDERS), n = Math.max(1, orders.getMaxRows() - 1);
  orders.getRange(2,3,n,1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.STATUSES, true).build());
  orders.getRange(2,6,n,1).setNumberFormat('@');
  orders.getRange(2,11,n,3).setNumberFormat('#,##0');
  orders.getRange(2,2,n,1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  orders.getRange(2,14,n,1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  ss.toast('初始化完成；既有訂單與商品價格已保留', CONFIG.SHOP_NAME, 8);
}
function doGet() {
  try {
    const ss = spreadsheet_();
    const ready = [CONFIG.SHEET_ORDERS,CONFIG.SHEET_ITEMS,CONFIG.SHEET_PRODUCTS].every(n => !!ss.getSheetByName(n));
    return json_({ok:true,ready,version:2,service:CONFIG.SHOP_NAME + ' order API'});
  } catch (_) { return json_({ok:false,ready:false,error:'請先執行 setup'}); }
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > 20000) return json_({ok:false,error:'請求內容不正確'});
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json_({ok:false,error:'請求內容不正確'});
    if (body.action === 'track') return track_(body);
    if (body.action) return admin_(body, lock);
    if (body.hp) return json_({ok:false,error:'無法送出訂單'});
    const v = validate_(body);
    if (v.error) return json_({ok:false,error:v.error});
    const hash = fingerprint_(v);
    lock.waitLock(20000);
    const ss = spreadsheet_(), orders = ss.getSheetByName(CONFIG.SHEET_ORDERS), items = ss.getSheetByName(CONFIG.SHEET_ITEMS);
    if (!orders || !items || !ss.getSheetByName(CONFIG.SHEET_PRODUCTS)) return json_({ok:false,error:'店家尚未完成訂單服務設定'});
    const found = find_(orders, 15, v.requestId);
    let orderNo, row;
    if (found) {
      row = found.getRow();
      const prior = orders.getRange(row,1,1,17).getValues()[0];
      if (prior[15] !== hash) return json_({ok:false,error:'此送單識別碼已使用，請先確認原訂單',code:'REQUEST_CONFLICT'});
      if (prior[16] === '已建立') return json_({ok:true,orderNo:prior[0],total:prior[12],eta:FEES[v.mode].eta});
      orderNo = prior[0];
    }
    const pricing = price_(ss,v.items,v.mode);
    if (pricing.error) return json_({ok:false,error:pricing.error});
    if (!found) {
      orderNo = nextOrderNo_(ss); row = orders.getLastRow() + 1;
      const now = new Date();
      orders.appendRow([orderNo,now,CONFIG.STATUSES[0],FEES[v.mode].name,safeText_(v.name),v.phone,safeText_(v.email),
        STORES[v.store] || '',safeText_(v.address),safeText_(v.note),pricing.subtotal,pricing.fee,pricing.total,now,v.requestId,hash,'寫入中']);
      SpreadsheetApp.flush();
    }
    // Repair an interrupted write under the same lock and request ID. Never create a second order.
    for (let r = items.getLastRow(); r >= 2; r--) {
      if (items.getRange(r,1).getValue() === orderNo) items.deleteRow(r);
    }
    const lines = pricing.lines.map(l => [orderNo,l.id,safeText_(l.name),l.price,l.qty,l.price*l.qty]);
    items.getRange(items.getLastRow()+1,1,lines.length,6).setValues(lines);
    orders.getRange(row,11,1,3).setValues([[pricing.subtotal,pricing.fee,pricing.total]]);
    SpreadsheetApp.flush();
    orders.getRange(row,17).setValue('已建立');
    SpreadsheetApp.flush(); lock.releaseLock();
    notify_(orderNo,v,pricing);
    return json_({ok:true,orderNo,total:pricing.total,eta:FEES[v.mode].eta});
  } catch (error) {
    console.error('Order request failed');
    return json_({ok:false,error:'暫時無法確認訂單，請保持資料不變再試，或聯絡店家',code:'RETRY_SAME_REQUEST'});
  } finally { try { lock.releaseLock(); } catch (_) {} }
}
function validate_(b) {
  const clean = value => String(value == null ? '' : value).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,200);
  if (!Object.prototype.hasOwnProperty.call(FEES,b.mode)) return {error:'取餐方式不正確'};
  const v = {mode:b.mode,name:clean(b.name),phone:clean(b.phone),email:clean(b.email),address:clean(b.address),note:clean(b.note),store:b.mode==='ship'?'':clean(b.store),requestId:clean(b.requestId)};
  if (!v.name) return {error:'請填寫姓名'};
  if (!/^09\d{8}$/.test(v.phone)) return {error:'手機號碼格式不正確'};
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return {error:'Email 格式不正確'};
  if (v.mode==='ship' && !v.address) return {error:'宅配需填寫地址'};
  if (v.mode!=='ship' && !Object.prototype.hasOwnProperty.call(STORES,v.store)) return {error:'請選擇正確門市'};
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(v.requestId)) return {error:'送單識別碼不正確，請重新整理頁面'};
  if (!Array.isArray(b.items) || !b.items.length || b.items.length>CONFIG.MAX_ITEMS) return {error:'購物車內容不正確'};
  const seen = new Set(); v.items = [];
  for (const item of b.items) {
    if (!item || typeof item.id!=='string' || !/^[a-z][a-z0-9]{0,19}$/.test(item.id) || seen.has(item.id)) return {error:'商品內容不正確'};
    if (!Number.isInteger(item.qty) || item.qty<1 || item.qty>CONFIG.MAX_QTY_PER_ITEM) return {error:'商品數量不正確'};
    seen.add(item.id); v.items.push({id:item.id,qty:item.qty});
  }
  v.items.sort((a,b)=>a.id.localeCompare(b.id)); return v;
}
function price_(ss,items,mode) {
  const data=ss.getSheetByName(CONFIG.SHEET_PRODUCTS).getDataRange().getValues().slice(1), catalog=Object.create(null);
  data.forEach(r=>catalog[r[0]]={name:String(r[1]),price:Number(r[2]),on:r[4]===true || String(r[4]).toUpperCase()==='TRUE'});
  let subtotal=0;const lines=[];
  for(const item of items){
    const p=catalog[item.id];
    if(!p || !p.on) return {error:'部分商品已下架或不存在'};
    if(!Number.isSafeInteger(p.price) || p.price<0) return {error:'商品價格設定不正確，請聯絡店家'};
    lines.push({id:item.id,name:p.name,price:p.price,qty:item.qty});subtotal+=p.price*item.qty;
  }
  const fee=FEES[mode].fee(subtotal);return {lines,subtotal,fee,total:subtotal+fee};
}
function fingerprint_(v) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(v),Utilities.Charset.UTF_8)
    .map(byte=>('0'+((byte+256)%256).toString(16)).slice(-2)).join('');
}
function safeText_(value) { return /^[=+\-@]/.test(value) ? "'"+value : value; }
function find_(sh,column,value) {
  return sh.getLastRow()<2 ? null : sh.getRange(2,column,sh.getLastRow()-1,1).createTextFinder(String(value)).matchEntireCell(true).findNext();
}
function nextOrderNo_(ss) {
  const day=Utilities.formatDate(new Date(),ss.getSpreadsheetTimeZone(),'yyMMdd'), props=PropertiesService.getScriptProperties(), key='seq_'+day;
  let n=Number(props.getProperty(key)||0);
  const sh=ss.getSheetByName(CONFIG.SHEET_ORDERS);
  if(sh.getLastRow()>1) sh.getRange(2,1,sh.getLastRow()-1,1).getValues().forEach(r=>{
    if(String(r[0]).startsWith('JF'+day+'-')) n=Math.max(n,Number(String(r[0]).split('-')[1])||0);
  });
  n++;props.setProperty(key,String(n));return 'JF'+day+'-'+String(n).padStart(3,'0');
}
function track_(body) {
  const no=String(body.orderNo||'').trim().toUpperCase();
  if(!/^JF\d{6}-\d{3,}$/.test(no)) return json_({ok:false,error:'訂單編號格式不正確'});
  const ss=spreadsheet_(), sh=ss.getSheetByName(CONFIG.SHEET_ORDERS), cell=find_(sh,1,no);
  if(!cell) return json_({ok:false,error:'查無此訂單'});
  const r=sh.getRange(cell.getRow(),1,1,17).getValues()[0];
  if(r[16] && r[16]!=='已建立') return json_({ok:false,error:'訂單處理中，請稍後確認'});
  const fmt=d=>d instanceof Date?Utilities.formatDate(d,ss.getSpreadsheetTimeZone(),"yyyy-MM-dd'T'HH:mm:ss"):String(d||'');
  return json_({ok:true,orderNo:r[0],status:r[2],mode:r[3],createdAt:fmt(r[1]),updatedAt:fmt(r[13])||fmt(r[1]),subtotal:r[10],fee:r[11],total:r[12],items:itemsByNo_(ss)[no]||[]});
}
function itemsByNo_(ss){
  const result={},sh=ss.getSheetByName(CONFIG.SHEET_ITEMS);
  if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,6).getValues().forEach(r=>{
    (result[r[0]]=result[r[0]]||[]).push({name:r[2],price:r[3],qty:r[4]});
  });return result;
}
function admin_(b,lock){
  const key=PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if(!key || b.key!==key) return json_({ok:false,error:'金鑰不正確',code:'AUTH'});
  if(b.action==='list')return json_({ok:true,statuses:CONFIG.STATUSES,orders:listOrders_()});
  if(b.action==='status'){
    if(!CONFIG.STATUSES.includes(b.status))return json_({ok:false,error:'狀態不正確'});
    lock.waitLock(20000);const sh=spreadsheet_().getSheetByName(CONFIG.SHEET_ORDERS), cell=find_(sh,1,String(b.orderNo));
    if(!cell)return json_({ok:false,error:'找不到訂單'});
    sh.getRange(cell.getRow(),3).setValue(b.status);sh.getRange(cell.getRow(),14).setValue(new Date());
    return json_({ok:true,orderNo:b.orderNo,status:b.status});
  }return json_({ok:false,error:'未知的操作'});
}
function listOrders_(){
  const ss=spreadsheet_(),sh=ss.getSheetByName(CONFIG.SHEET_ORDERS),byNo=itemsByNo_(ss);
  if(sh.getLastRow()<2)return [];
  const start=Math.max(2,sh.getLastRow()-499);
  return sh.getRange(start,1,sh.getLastRow()-start+1,17).getValues().filter(r=>!r[16]||r[16]==='已建立').reverse().map(r=>({
    orderNo:r[0],createdAt:r[1] instanceof Date?Utilities.formatDate(r[1],ss.getSpreadsheetTimeZone(),"yyyy-MM-dd'T'HH:mm:ss"):String(r[1]),
    status:r[2],mode:r[3],name:r[4],phone:String(r[5]),email:r[6],store:r[7],address:r[8],note:r[9],subtotal:r[10],fee:r[11],total:r[12],items:byNo[r[0]]||[]
  }));
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function notify_(orderNo, v, p) {
  const lines = p.lines.map(l => '・' + l.name + ' × ' + l.qty + '  NT$' + l.price * l.qty).join('\n');
  const summary = '訂單編號：' + orderNo + '\n取餐方式：' + FEES[v.mode].name +
    (v.store ? '\n門市：' + (STORES[v.store] || v.store) : '') + (v.address ? '\n地址：' + v.address : '') +
    '\n\n' + lines + '\n\n小計 NT$' + p.subtotal + '\n服務費/運費 NT$' + p.fee + '\n應付總額 NT$' + p.total +
    (v.note ? '\n備註：' + v.note : '');
  try {
    const ownerEmail = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') || CONFIG.OWNER_EMAIL;
    if (ownerEmail) {
      MailApp.sendEmail(ownerEmail, '[新訂單] ' + orderNo + ' ' + v.name + ' NT$' + p.total,
        summary + '\n\n顧客：' + v.name + ' / ' + v.phone + (v.email ? ' / ' + v.email : ''));
    }
    if (CONFIG.SEND_CUSTOMER_MAIL && v.email) {
      MailApp.sendEmail(v.email, '【' + CONFIG.SHOP_NAME + '】訂單已建立 ' + orderNo,
        v.name + ' 您好，感謝您的訂購！\n\n' + summary + '\n\n預計時間：' + FEES[v.mode].eta + '\n如有問題請來電 (02) 2345-6789。');
    }
  } catch (err) { console.error('mail failed', err); } // 寄信失敗不影響訂單
}

const PRODUCTS = [
  ['s1', '招牌豬肉鍋貼 (10入)', 85, '招牌鍋貼', true],
  ['s2', '韭菜豬肉鍋貼 (10入)', 90, '招牌鍋貼', true],
  ['s3', '麻辣牛肉鍋貼 (10入)', 110, '招牌鍋貼', true],
  ['s4', '起司玉米鍋貼 (10入)', 100, '招牌鍋貼', true],
  ['d1', '鮮肉水餃 (12入)', 90, '精選水餃', true],
  ['d2', '高麗菜水餃 (12入)', 85, '精選水餃', true],
  ['d3', '鮮蝦水餃 (10入)', 130, '精選水餃', true],
  ['d4', '紅油抄手 (8入)', 95, '精選水餃', true],
  ['p1', '酸辣湯', 55, '湯品/飲料', true],
  ['p2', '蛤蜊雞湯', 80, '湯品/飲料', true],
  ['p3', '古早味紅茶', 30, '湯品/飲料', true],
  ['p4', '酸梅湯', 35, '湯品/飲料', true],
  ['k1', '涼拌小黃瓜', 40, '經典小菜', true],
  ['k2', '滷味拼盤', 65, '經典小菜', true],
  ['k3', '蔥油餅', 45, '經典小菜', true],
  ['k4', '麻辣豆干', 50, '經典小菜', true],
  ['g1', '招牌招財鍋貼禮盒', 680, '冷凍禮盒', true],
  ['g2', '雙拼團圓禮盒', 820, '冷凍禮盒', true],
  ['g3', '嚐鮮綜合禮盒', 590, '冷凍禮盒', true]
];

/* Run manually from the bound editor. Writes one labelled test order, retries and reads it back.
   This is a real Sheet test only when executed in Google Apps Script, not by the local Node tests. */
function setupAndVerify() {
  setup();
  const body = {requestId:Utilities.getUuid(),mode:'take',name:'課程驗收測試',phone:'0900000000',email:'',store:'flag',address:'',note:'任務十驗收測試，非實際出餐',items:[{id:'s1',qty:2}]};
  const invoke = data => JSON.parse(doPost({postData:{contents:JSON.stringify(data)}}).getContent());
  const created = invoke(body), retried = invoke(body);
  if (!created.ok || !retried.ok || created.orderNo !== retried.orderNo) throw new Error('接單／防重送失敗：'+JSON.stringify(created));
  const tracked = invoke({action:'track',orderNo:created.orderNo});
  const ss = spreadsheet_(), orders = ss.getSheetByName(CONFIG.SHEET_ORDERS);
  const matches = orders.getRange(2,15,orders.getLastRow()-1,1).getValues().filter(row=>row[0]===body.requestId).length;
  if (!tracked.ok || tracked.total !== created.total || tracked.items.length !== 1 || tracked.items[0].qty !== 2 || matches !== 1) throw new Error('寫入後讀回結果不符');
  const result = {ok:true,orderNo:created.orderNo,total:tracked.total,matchingOrderRows:matches,spreadsheetUrl:ss.getUrl()};
  console.log(JSON.stringify(result)); return result;
}
