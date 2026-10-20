// Resolve every advertised server for one real episode of each captured title.
// Reachability is diagnostic only; it never certifies video playback.
import fs from 'node:fs';
import {unifiedStream} from '../server/src/library-service.js';
import {safeRemoteFetch} from '../server/src/stream-security.js';
const file=process.argv[2]||'artifacts/provider-matrix-records.json';
const titles=[...new Map(JSON.parse(fs.readFileSync(file,'utf8')).map(r=>[r.id,r])).values()];
const native=fs.readFileSync('mobile/android/app/src/main/java/app/flixer/stream/PlayerViewPlugin.java','utf8');
const hosts=new Set([...native.matchAll(/"([a-z0-9.-]+\.[a-z]+)"/g)].map(m=>m[1]));
const report={at:new Date().toISOString(),scope:'All resolved routes for the first actual episode of each captured sample title',playbackConfirmed:false,results:[]};
async function pool(list,concurrency,fn){let cursor=0;await Promise.all(Array.from({length:Math.min(concurrency,list.length)},async()=>{while(cursor<list.length)await fn(list[cursor++]);}));}
function save(){fs.writeFileSync('artifacts/player-routes.json',JSON.stringify(report,null,2));}
await pool(titles,2,async title=>{
 const sample={id:title.id,provider:title.channelId,title:title.title,routes:[]};report.results.push(sample);
 const episode=title.episodes?.[0];if(!episode){sample.error='No source episode links';save();return;}
 try{
  const response=await unifiedStream(episode.id,{showId:title.id,transport:'direct',product:'flixer',catalog:{product:'flixer',shows:[title]}});
  sample.providerErrors=response?.providerErrors;const servers=response?.servers||[];
  await pool(servers,4,async server=>{
   const url=server.rawStreamUrl||server.streamUrl||server.embedUrl;
   const row={id:server.id,type:server.type,name:server.name,playbackConfirmed:false};sample.routes.push(row);
   if(server.type==='youtube'){row.method='official-youtube-embed';save();return;}
   if(server.type==='dessinanime'){row.method='device-source-api';save();return;}
   try{
    const host=new URL(url).hostname;row.host=host;
    row.method=server.streamUrl?'native-media':hosts.has(host)||/^(?:balance|[1-9])\.medmedia03\.wiki$/.test(host)?'isolated-in-app-webview':'unsupported-embed-host';
    const r=await safeRemoteFetch(url,{timeoutMs:7000,headers:{...server.headers,...(server.streamUrl?{Range:'bytes=0-1023'}:{})}});
    row.status=r.status;row.contentType=r.headers.get('content-type');await r.body?.cancel();
   }catch(e){row.error=e.message;}save();
  });
 }catch(e){sample.error=e.message;}save();console.log(JSON.stringify({provider:sample.provider,id:sample.id,routes:sample.routes.length,error:sample.error}));
});
