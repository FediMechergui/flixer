// Run on the refresh host to distinguish transport failures from upstream refusals.
import { safeRemoteFetch } from '../server/src/stream-security.js';
const origin='https://hdtoday.sx';
const headers={'User-Agent':'Mozilla/5.0',Referer:origin+'/home',Accept:'text/html,application/json;q=0.9,*/*;q=0.8'};
let failures=0;
for(const path of ['/home','/movie?page=1','/tv?page=1','/new-episodes?page=1','/api/suggest?q=happy']){
  for(const transport of ['pinned','native']){
    try{
      const r=transport==='pinned'?await safeRemoteFetch(origin+path,{headers,timeoutMs:12000}):await fetch(origin+path,{headers,signal:AbortSignal.timeout(12000)});
      const body=await r.text();
      console.log(JSON.stringify({path,transport,status:r.status,server:r.headers.get('server'),challenge:r.headers.get('cf-mitigated'),title:/<title[^>]*>([^<]+)/i.exec(body)?.[1],bytes:body.length}));
      if(!r.ok)failures++;
    }catch(e){failures++;console.log(JSON.stringify({path,transport,error:e.message}));}
  }
  await new Promise(resolve=>setTimeout(resolve,1000));
}
console.log(`Unsuccessful requests: ${failures}`);
