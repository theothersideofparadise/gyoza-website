/* Explicit, real production acceptance test. Not included in npm test.
   Always reuses docs/tasks-10-live-request.json to avoid duplicate logical orders. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
if(process.env.LIVE_CHECKOUT_TEST!=='1')throw new Error('Set LIVE_CHECKOUT_TEST=1 only when authorized to create the labelled live test order');
const configContext={window:{}};vm.runInNewContext(fs.readFileSync('assets/order-config.js','utf8'),configContext);
const config=configContext.window.JIANFU_ORDER_CONFIG;
assert.equal(config.provider,'gas');
const payload=JSON.parse(fs.readFileSync('docs/tasks-10-live-request.json','utf8'));
function curl(url,body){
 const args=['--fail-with-body','--silent','--show-error','--location','--max-time','45'];
 if(body)args.push('--header','Content-Type: text/plain;charset=utf-8','--data-binary','@-');
 args.push(url);return execFileSync('curl',args,{input:body?JSON.stringify(body):undefined,encoding:'utf8'});
}
const health=JSON.parse(curl(config.gasUrl));assert.equal(health.ok,true);assert.equal(health.ready,true);assert.equal(health.version,2);
const liveConfig=curl('https://theothersideofparadise.github.io/gyoza-website/assets/order-config.js?v=11');
assert(liveConfig.includes(config.gasUrl),'Published site must reference the actual deployment');
assert(/provider["']?\s*:\s*["']gas["']/.test(liveConfig),'Published site must select GAS');
const created=JSON.parse(curl(config.gasUrl,payload));assert.equal(created.ok,true);assert.match(created.orderNo,/^JF\d{6}-\d{3,}$/);assert.equal(created.total,85);
const duplicate=JSON.parse(curl(config.gasUrl,payload));assert.equal(duplicate.ok,true);assert.equal(duplicate.orderNo,created.orderNo);
const tracked=JSON.parse(curl(config.gasUrl,{action:'track',orderNo:created.orderNo}));
assert.equal(tracked.ok,true);assert.equal(tracked.total,created.total);assert.equal(tracked.items.length,1);assert.equal(tracked.items[0].qty,1);
const report={health,requestId:payload.requestId,created,duplicate,tracked};
fs.writeFileSync('/tmp/gyoza-live-checkout-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
// Verify matching rows through the private Sheet connector separately; API success alone is insufficient.
