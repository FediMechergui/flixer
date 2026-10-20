// Bundled for the APK by build-terrarium. No remote script execution.
import JSON5 from '../server/node_modules/json5/lib/index.js';
import {createPublicHgConfig} from '../shared/public-hg-config.js';
const {parseHgPublicLinks}=createPublicHgConfig(JSON5.parse),cache=new Map();
function sourceUrl(server){
 try{const u=new URL(server.sourceEmbedUrl||server.embedUrl);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&['cybervynx.com','hgcloud.to','hglamioz.com','hgplaycdn.com'].includes(u.hostname)&&/^\/e\/[a-z0-9]{12}$/.test(u.pathname)?u:null;}catch{return null;}
}
async function text(url,accept){
 const http=window.Capacitor?.Plugins?.CapacitorHttp;if(!http?.get)throw Error('Native source metadata unavailable');
 let timer;try{
  const r=await Promise.race([http.get({url,headers:{Accept:accept},responseType:'text',connectTimeout:4000,readTimeout:4000,disableRedirects:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Source metadata timed out')),6500);})]);
  if(r.status<200||r.status>=300||typeof r.data!=='string'||r.data.length>262144)throw Error('Source metadata unavailable');return r.data;
 }finally{clearTimeout(timer);}
}
function knownCdn(value){try{const h=new URL(value).hostname;return ['premilkyway.com','riskanalytics.cfd'].some(domain=>h===domain||h.endsWith('.'+domain));}catch{return false;}}
async function resolve(server){
 const source=sourceUrl(server);if(!source)return [];
 const old=cache.get(source.pathname);let promise;
 if(old&&Date.now()<old.expires)promise=old.promise;
 else{
  promise=(async()=>{
   const url=['hglamioz.com','hgplaycdn.com'].includes(source.hostname)?source.href:'https://hglamioz.com'+source.pathname;
   const links=parseHgPublicLinks(await text(url,'text/html')).filter(link=>knownCdn(link.url));
   // Start playback as soon as a published manifest works. A denied or stalled
   // secondary mirror must not delay an already usable video.
   const first=await Promise.any(links.slice(0,3).map(async link=>{
    const manifest=await text(link.url,'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain');
    if(!/^\uFEFF?#EXTM3U(?:\r?\n|$)/.test(manifest)||!/#EXT(?:INF|\-X\-(?:STREAM-INF|MEDIA))\b/.test(manifest))throw Error('Source is not a video manifest');
    return link;
   }));return [first];
  })().catch(()=>[]);
  const entry={promise,expires:Date.now()+300000};cache.set(source.pathname,entry);if(cache.size>100)cache.delete(cache.keys().next().value);
  promise.then(rows=>{if(!rows.length)entry.expires=Date.now()+15000;});
 }
 const media=await promise,{embedUrl,type,streamUrl,rawStreamUrl,...base}=server;
 return media.map(link=>({...base,id:server.id+':device:'+link.key,name:server.name+' - Direct video',type:'hls',streamUrl:link.url,rawStreamUrl:link.url,sourceEmbedUrl:source.href,deviceResolved:true}));
}
window.FlixerHgSource={supports:server=>Boolean(sourceUrl(server)),resolve,clearCache:()=>cache.clear()};
