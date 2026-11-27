/* Transport adapter. A successful order is shown only after a readable server acknowledgement. */
(function(root) {
  function createClient({config,endpoints,anonKey,fetchImpl=globalThis.fetch,storage,cryptoImpl=globalThis.crypto}) {
    if (!storage) { try { storage=globalThis.sessionStorage; } catch (_) {} }
    let pending = null;
    const storageKey = 'jianfu_pending_gas_request_v1';
    try { pending = JSON.parse(storage.getItem(storageKey) || 'null'); } catch (_) {}
    function save(value) {
      pending = value;
      try { if(value) storage.setItem(storageKey,JSON.stringify(value)); else storage.removeItem(storageKey); } catch (_) {}
    }
    async function requestId(body) {
      const ordered = Object.fromEntries(Object.keys(body).sort().filter(k=>k!=='hp').map(k=>[k,k==='items' ? body.items.map(i=>({id:i.id,qty:i.qty})).sort((a,b)=>a.id.localeCompare(b.id)) : body[k]]));
      const data = new TextEncoder().encode(JSON.stringify({endpoint:config.gasUrl,body:ordered}));
      const fingerprint = Array.from(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
      if(pending && pending.uncertain && pending.fingerprint!==fingerprint) throw new Error('上一筆訂單結果尚未確認，請恢復原資料重試或聯絡店家');
      if(!pending || pending.fingerprint!==fingerprint) save({fingerprint,id:cryptoImpl.randomUUID(),uncertain:false});
      return pending.id;
    }
    async function send(action,body) {
      if(!['create','track'].includes(action)) throw new Error('未知的訂單操作');
      const gas = config.provider==='gas';
      if(!gas && config.provider!=='supabase') throw new Error('訂單服務設定不正確，請聯絡店家');
      if(gas && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.gasUrl || '')) throw new Error('店家尚未完成 Google 訂單服務設定，請聯絡店家');
      let outgoing = body;
      if(gas) {
        outgoing = action==='track' ? {action:'track',orderNo:body.order_no} : {...body,store:body.store_id || '',requestId:await requestId(body)};
        delete outgoing.store_id;
      }
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(),45000);
      try {
        // Persist before dispatch: navigation can terminate fetch without running its catch handler.
        if (gas && action==='create') save({...pending,uncertain:true});
        let response;
        try {
          response = await fetchImpl(gas ? config.gasUrl : endpoints[action], {
            method:'POST',signal:controller.signal,redirect:'follow',
            headers:gas ? {'Content-Type':'text/plain;charset=utf-8'} : {'Content-Type':'application/json',Authorization:'Bearer '+anonKey,apikey:anonKey},
            body:JSON.stringify(outgoing)
          });
        } catch (_) {
          const error = new Error('無法確認訂單是否已送出'); error.network=true; throw error;
        }
        let result;
        try { result = await response.json(); }
        catch (_) { const error = new Error('伺服器回應格式不正確，請聯絡店家確認訂單'); error.uncertain=true; throw error; }
        if(!response.ok || !result || result.ok!==true) {
          const error = new Error(result && typeof result.error==='string' ? result.error : '訂單服務暫時無法使用');
          error.status=response.status;error.uncertain=response.status>=500 || result?.code==='RETRY_SAME_REQUEST';throw error;
        }
        const normalized = {...result,order_no:gas ? result.orderNo : result.order_no};
        if(!/^JF\d{6}-\d{3,}$/.test(normalized.order_no || '') || !Number.isFinite(normalized.total) || normalized.total<0 || (action==='track' && (!Array.isArray(normalized.items) || typeof normalized.status!=='string'))) {
          const error = new Error('伺服器回應格式不正確，請聯絡店家確認訂單');error.uncertain=true;throw error;
        }
        if(gas && action==='create') save(null);
        return normalized;
      } catch(error) {
        if(gas && action==='create' && pending) save({...pending,uncertain:!!(error.network || error.uncertain)});
        throw error;
      } finally {clearTimeout(timer);}
    }
    return {send};
  }
  if(typeof module!=='undefined' && module.exports) module.exports={createClient};
  else root.JianfuOrderApi={createClient};
})(typeof window!=='undefined'?window:globalThis);
