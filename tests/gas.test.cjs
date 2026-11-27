const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const crypto=require('node:crypto');
function fixture(){
 class Range{
  constructor(sh,r,c,n=1,m=1){Object.assign(this,{sh,r,c,n,m});}
  getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.rows[this.r+i-1]?.[this.c+j-1]??''));}
  setValues(rows){if(this.sh.failOnce){this.sh.failOnce=false;throw Error('simulated Sheets write failure');}rows.forEach((row,i)=>row.forEach((v,j)=>{this.sh.rows[this.r+i-1]??=[];this.sh.rows[this.r+i-1][this.c+j-1]=v;}));return this;}
  setValue(value){return this.setValues([[value]]);}getRow(){return this.r;}getValue(){return this.getValues()[0][0];}
  clearContent(){return this.setValues(Array.from({length:this.n},()=>Array(this.m).fill('')));}
  createTextFinder(value){const range=this;return {matchEntireCell(){return this;},findNext(){for(let i=0;i<range.n;i++)if(String(range.getValues()[i][0])===value)return new Range(range.sh,range.r+i,range.c);return null;}};}
 }
 for(const method of ['setNumberFormat','setDataValidation','setBackground','setFontColor','setFontWeight','setWrap'])Range.prototype[method]=function(){return this;};
 class Sheet{
  constructor(name,rows=[]){this.name=name;this.rows=rows;}getLastRow(){return this.rows.length;}getMaxRows(){return 1000;}getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
  getRange(r,c,n,m){if(typeof r==='string')return new Range(this,2,3,999,1);return new Range(this,r,c,n,m);}getDataRange(){return this.getRange(1,1,this.getLastRow(),this.getLastColumn());}
  appendRow(row){this.rows.push(row);return this;}deleteRow(r){this.rows.splice(r-1,1);}setFrozenRows(){}autoResizeColumns(){}setConditionalFormatRules(){}clear(){this.rows=[];}
 }
 const sheets={'商品':new Sheet('商品',[['商品ID','品名','單價','分類','上架(TRUE/FALSE)'],['s1','招牌',85,'鍋貼',true]]),'訂單':new Sheet('訂單',[Array(17).fill('')]),'訂單明細':new Sheet('訂單明細',[Array(6).fill('')])};
 const props={};const properties={getProperty:k=>props[k]||null,setProperty(k,v){props[k]=v;return this;}};
 const ss={getSheetByName:n=>sheets[n],insertSheet:n=>sheets[n]=new Sheet(n),getSpreadsheetTimeZone:()=> 'Asia/Taipei',getSheets:()=>Object.values(sheets),getId:()=> 'test-sheet',toast(){},deleteSheet(){}};
 const builder={requireValueInList(){return this;},build(){return {};}};
 const context=vm.createContext({console:{error(){}},Date,JSON,Math,Number,String,Array,Object,RegExp,Error,Set,Map,
  SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss,flush(){},newDataValidation:()=>builder,newConditionalFormatRule:()=>({whenTextEqualTo(){return this;},setBackground(){return this;},setRanges(){return this;},build(){return {};}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},PropertiesService:{getScriptProperties:()=>properties},MailApp:{sendEmail(){}},
  Utilities:{formatDate:(d,tz,fmt)=>fmt==='yyMMdd'?'261127':new Date(d).toISOString(),getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(alg,value)=>[...crypto.createHash('sha256').update(value).digest()]},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType(){return this;},getContent:()=>text})}});
 vm.runInContext(fs.readFileSync('gas/Code.gs','utf8'),context);
 const post=body=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}}).getContent());
 const body={requestId:'12345678-1234-4567-8901-123456789012',mode:'take',name:'測試',phone:'0900000000',store:'flag',email:'',address:'',note:'',items:[{id:'s1',qty:2}]};
 return {context,sheets,ss,post,body,props};
}
test('fractional quantities, duplicate IDs and unknown stores are rejected',()=>{
 const {post,body}=fixture();for(const patch of [{items:[{id:'s1',qty:1.2}]},{items:[{id:'s1',qty:1},{id:'s1',qty:2}]},{store:'unknown'},{requestId:''},{mode:'toString'}])assert.equal(post({...body,...patch}).ok,false);
});
test('same request writes one order and returns same result; changed payload is rejected',()=>{
 const {post,body,sheets}=fixture();const first=post(body);assert.equal(first.ok,true);assert.equal(first.total,170);
 const second=post(body);assert.equal(second.orderNo,first.orderNo);assert.equal(sheets['訂單'].rows.length,2);assert.equal(sheets['訂單明細'].rows.length,2);
 assert.equal(post({...body,items:[{id:'s1',qty:3}]}).ok,false);
 const tracked=post({action:'track',orderNo:first.orderNo});assert.equal(tracked.ok,true);assert.equal(tracked.total,170);assert.equal(tracked.items[0].qty,2);assert.equal(tracked.phone,undefined);
});
test('retry repairs interrupted detail write without creating a second order',()=>{
 const {post,body,sheets}=fixture();sheets['訂單明細'].failOnce=true;assert.equal(post(body).ok,false);
 const retry=post(body);assert.equal(retry.ok,true);assert.equal(sheets['訂單'].rows.length,2);assert.equal(sheets['訂單明細'].rows.length,2);
});
test('formula text is escaped, catalog price is trusted, sequence exceeds 999 safely',()=>{
 const {post,body,sheets,props}=fixture();props.seq_261127='999';const result=post({...body,name:'=1+1',total:1});assert.equal(result.total,170);assert.equal(result.orderNo,'JF261127-1000');assert.equal(sheets['訂單'].rows[1][4],"'=1+1");
});
test('setup preserves an existing product catalog',()=>{const {context,sheets}=fixture();sheets['商品'].rows[1][2]=123;context.setup();assert.equal(sheets['商品'].rows[1][2],123);});
