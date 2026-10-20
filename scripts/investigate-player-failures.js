// Revisit each frozen failed case. A recovered HTTP route is not proof of video.
import fs from 'node:fs';
import {lookup} from 'node:dns/promises';
import {diagnosePlayerResponse} from '../server/src/player-diagnostics.js';
import {unifiedStream} from '../server/src/library-service.js';
import {safeRemoteFetch,isPublicAddress} from '../server/src/stream-security.js';
const baseline=JSON.parse(fs.readFileSync(process.argv[2]||'artifacts/failures-baseline-89.json','utf8'));
const records=JSON.parse(fs.readFileSync(process.argv[3]||'artifacts/provider-matrix-records.json','utf8'));
const report={at:new Date().toISOString(),baselineAt:baseline.at,scope:'All original failed route descriptors; URLs re-resolved because the original audit did not retain URLs',cases:baseline.cases.map((row,index)=>({case:index+1,...row,baselineError:row.error||`HTTP ${row.status}`,retest:null,playbackConfirmed:false}))};
const out='artifacts/failure-investigation.json';
function save(){fs.writeFileSync(out,JSON.stringify(report,null,2));}
async function pool(items,n,fn){let index=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(index<items.length)await fn(items[index++]);}));}
async function sampleText(response){const reader=response.body?.getReader();if(!reader)return '';const decoder=new TextDecoder();let text='',bytes=0;try{while(bytes<65536){const {value,done}=await reader.read();if(done)break;bytes+=value.length;text+=decoder.decode(value,{stream:true});}}finally{await reader.cancel().catch(()=>{});}return text;}
const groups=[...new Set(report.cases.map(r=>r.titleId))];
await pool(groups,2,async id=>{
 const cases=report.cases.filter(r=>r.titleId===id),title=records.find(r=>r.id===id),ep=title?.episodes?.[0];
 if(!ep){for(const row of cases)row.retest={category:'missing-captured-title',error:'Original title record unavailable'};save();return;}
 let stream;
 try{stream=await unifiedStream(ep.id,{showId:id,transport:'direct',fresh:true,product:'flixer',catalog:{product:'flixer',shows:[title]}});}catch(e){for(const row of cases)row.retest={category:'source-resolution-error',error:e.message};save();return;}
 await pool(cases,3,async row=>{
  const server=stream?.servers?.find(s=>s.id===row.id&&new URL(s.rawStreamUrl||s.streamUrl||s.embedUrl).hostname===row.host);
  if(!server){row.retest={category:'source-route-changed',error:'The original server slot and host are no longer advertised',providerErrors:stream?.providerErrors};save();return;}
  const url=server.rawStreamUrl||server.streamUrl||server.embedUrl,start=Date.now();row.retest={url,category:'pending',history:[]};
  try{row.retest.dns=await lookup(new URL(url).hostname,{all:true});row.retest.dnsPublic=row.retest.dns.every(a=>isPublicAddress(a.address));}catch(e){row.retest.dnsError=e.code||e.message;}
  for(let attempt=1;attempt<=2;attempt++){
   try{
    const r=await safeRemoteFetch(url,{timeoutMs:attempt===1?9000:15000,headers:{'User-Agent':'Mozilla/5.0',Accept:server.streamUrl?'*/*':'text/html,application/xhtml+xml',...server.headers,...(server.streamUrl?{Range:'bytes=0-1023'}:{})}});
    delete row.retest.error;delete row.retest.code;
    const type=r.headers.get('content-type')||'',html=/text|html|json/i.test(type)?await sampleText(r):(await r.body?.cancel(),'');
    const title=/<title[^>]*>([^<]*)/i.exec(html)?.[1]||'',text=html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const headers=Object.fromEntries(['cf-mitigated','server','x-frame-options','content-security-policy','retry-after'].map(key=>[key,r.headers.get(key)]).filter(([,v])=>v));
    const result={category:diagnosePlayerResponse(r.status,{title,text,contentType:type,challenge:headers['cf-mitigated']==='challenge'}),status:r.status,finalUrl:r.url,contentType:type,headers,attempts:attempt,ms:Date.now()-start,title,excerpt:text.slice(0,500)};
    row.retest.history.push(result);Object.assign(row.retest,result);
    if(r.status>=500&&attempt===1)continue;break;
   }catch(e){for(const key of ['status','finalUrl','contentType','title','excerpt','headers'])delete row.retest[key];row.retest={...row.retest,category:/Private/.test(e.message)?'address-rejected':e.code==='ENOTFOUND'?'dns-failure':e.code==='ABORT_ERR'||/abort|timeout/i.test(e.message)?'network-timeout':'network-error',error:e.message,code:e.code,attempts:attempt,ms:Date.now()-start};row.retest.history.push({category:row.retest.category,error:e.message,attempt});if(attempt===2||row.retest.category==='address-rejected')break;}
  }
  save();console.log(JSON.stringify({case:row.case,provider:row.provider,host:row.host,before:row.baselineError,after:row.retest.category,status:row.retest.status}));
 });
});
save();const counts={};for(const row of report.cases)counts[row.retest?.category||'pending']=(counts[row.retest?.category||'pending']||0)+1;console.log(JSON.stringify({cases:report.cases.length,counts}));
