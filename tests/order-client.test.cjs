const {test}=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {createClient}=require('../assets/order-client.js');
const payload={mode:'take',name:'測試',phone:'0900000000',store_id:'flag',items:[{id:'s1',qty:2}]};
function fixture(fetchImpl,provider='gas',shared){const values=shared||new Map();return {values,client:createClient({config:{provider,gasUrl:'https://script.google.com/macros/s/TEST/exec'},endpoints:{create:'https://example.com/create',track:'https://example.com/track'},anonKey:'public-test-key',fetchImpl,cryptoImpl:webcrypto,storage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}})};}
const response=value=>({ok:true,status:200,json:async()=>value});
test('GAS posts a CORS simple request, maps store and normalizes response',async()=>{
 let request;const {client}=fixture(async(url,options)=>{request={url,...options};return response({ok:true,orderNo:'JF261127-001',total:170});});
 const result=await client.send('create',payload);assert.equal(result.order_no,'JF261127-001');assert.equal(request.headers['Content-Type'],'text/plain;charset=utf-8');assert.equal(request.headers.Authorization,undefined);assert.equal(JSON.parse(request.body).store,'flag');assert.match(JSON.parse(request.body).requestId,/^[a-f0-9-]{36}$/);
});
test('ambiguous network failure retains request ID across reload; success clears it',async()=>{
 const ids=[];const store=new Map();const first=fixture(async(u,o)=>{ids.push(JSON.parse(o.body).requestId);throw Error('lost response');},'gas',store);
 await assert.rejects(first.client.send('create',payload));assert.equal([...store.values()].some(v=>v.includes('0900000000')),false);
 const second=fixture(async(u,o)=>{ids.push(JSON.parse(o.body).requestId);return response({ok:true,orderNo:'JF261127-001',total:170});},'gas',store);
 await second.client.send('create',payload);assert.equal(ids[0],ids[1]);assert.equal(store.size,0);
});
test('uncertain submission cannot be silently changed to a new order',async()=>{const {client}=fixture(async()=>{throw Error('offline');});await assert.rejects(client.send('create',payload));await assert.rejects(client.send('create',{...payload,note:'changed'}),/尚未確認/);});
test('GAS track uses public tracking action and preserves summary',async()=>{let sent;const {client}=fixture(async(u,o)=>{sent=JSON.parse(o.body);return response({ok:true,orderNo:'JF261127-001',status:'新訂單',total:170,items:[]});});const result=await client.send('track',{order_no:'JF261127-001'});assert.deepEqual(sent,{action:'track',orderNo:'JF261127-001'});assert.equal(result.order_no,sent.orderNo);});
test('Supabase remains available as a fallback transport',async()=>{let sent;const {client}=fixture(async(u,o)=>{sent={u,o};return response({ok:true,order_no:'JF261127-001',total:170});},'supabase');await client.send('create',payload);assert.equal(sent.u,'https://example.com/create');assert.equal(sent.o.headers.apikey,'public-test-key');assert.equal(sent.o.headers['Content-Type'],'application/json');});
test('HTML/malformed success is not treated as a confirmed order',async()=>{const {client}=fixture(async()=>response({ok:true}));await assert.rejects(client.send('create',payload),/格式/);});
test('reload during an unresolved request retains uncertainty before any rejection handler runs',async()=>{
 const store=new Map();let started,release;const entered=new Promise(resolve=>started=resolve);const unresolved=new Promise(resolve=>release=resolve);
 const first=fixture(async()=>{started();return unresolved;},'gas',store);const inFlight=first.client.send('create',payload);await entered;
 const reloaded=fixture(async()=>response({ok:true,orderNo:'JF261127-002',total:170}),'gas',store);
 try {await assert.rejects(reloaded.client.send('create',{...payload,note:'changed while original was in flight'}),/尚未確認/);}
 finally {release(response({ok:true,orderNo:'JF261127-001',total:170}));await inFlight;}
});
