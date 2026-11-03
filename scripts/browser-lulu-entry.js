// Device-only public source metadata resolution. Video never passes through Flixer's backend.
import JSON5 from '../server/node_modules/json5/lib/index.js';
import {createPublicLuluConfig} from '../shared/public-lulu-config.js';
const {sourceUrl,parseLuluPublicLinks,isLuluManifest}=createPublicLuluConfig(JSON5.parse),cache=new Map();
const sourceFor=server=>sourceUrl(server?.sourceEmbedUrl||server?.embedUrl);
function publicReferer(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash?u.href:null;}catch{return null;}}
function requestHeaders(server){
 const result={},headers=server.headers||{};
 const referer=publicReferer(headers.Referer);if(referer)result.Referer=referer;
 const agent=headers['User-Agent']||window.navigator?.userAgent;
 if(typeof agent==='string'&&agent.length<=1024&&!/[\r\n]/.test(agent))result['User-Agent']=agent;
 return result;
}
async function request(url,headers,deadline){
 const http=window.Capacitor?.Plugins?.CapacitorHttp;if(!http?.get)throw Error('Native source metadata unavailable');
 const remaining=Math.min(5000,deadline-Date.now());if(remaining<=0)throw Error('Source metadata time budget reached');
 let timer;
 try{
  const response=await Promise.race([http.get({url,headers,responseType:'text',connectTimeout:remaining,readTimeout:remaining,disableRedirects:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Source metadata timed out')),remaining);})]);
  if(response.url&&response.url!==url)throw Error('Unexpected source redirect');
  if(typeof response.data!=='string'||response.data.length>262144)throw Error('Source metadata unavailable');
  return response;
 }finally{clearTimeout(timer);}
}
async function readSource(source,headers,deadline){
 let url=source,response=await request(url.href,{...headers,Accept:'text/html'},deadline);
 if([301,302,303,307,308].includes(response.status)){
  const location=Object.entries(response.headers||{}).find(([key])=>key.toLowerCase()==='location')?.[1];
  const next=typeof location==='string'?sourceUrl(new URL(location,url).href):null;
  // Follow only the publisher's observed move of this exact free player ID.
  if(url.hostname!=='lulustream.com'||next?.hostname!=='luluvdo.com'||next.pathname!==url.pathname)throw Error('Unsupported source redirect');
  url=next;response=await request(url.href,{...headers,Accept:'text/html'},deadline);
 }
 if(response.status!==200)throw Error('Source metadata unavailable');
 return {url,html:response.data};
}
async function resolve(server){
 const source=sourceFor(server);if(!source)return [];
 const context=requestHeaders(server),key=source.href+'|'+(context['User-Agent']||'');
 let entry=cache.get(key);
 if(!entry||entry.expires<=Date.now()){
  const promise=(async()=>{
   const deadline=Date.now()+10000,{url,html}=await readSource(source,context,deadline);
   const headers={Referer:url.href,Origin:url.origin,...(context['User-Agent']?{'User-Agent':context['User-Agent']}:{})};
   const links=parseLuluPublicLinks(html);
   // At most two advertised alternatives; return as soon as one verifies.
   const first=await Promise.any(links.slice(0,2).map(async link=>{
    const response=await request(link.url,{...headers,Accept:'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain'},deadline);
    if(response.status!==200||!isLuluManifest(response.data,link.url))throw Error('Source is not a video manifest');
    return {...link,headers};
   }));return [first];
  })().catch(()=>[]);
  entry={promise,expires:Date.now()+120000};cache.set(key,entry);if(cache.size>100)cache.delete(cache.keys().next().value);
  promise.then(rows=>{if(!rows.length)entry.expires=Date.now()+15000;});
 }
 const links=await entry.promise,{embedUrl,type,streamUrl,rawStreamUrl,headers,...base}=server;
 return links.map(link=>({...base,id:server.id+':device:lulu:'+link.key,name:server.name+' - Direct video',type:'hls',streamUrl:link.url,rawStreamUrl:link.url,headers:link.headers,sourceEmbedUrl:source.href,deviceResolved:true,resolution:'source-public-config',availability:'unverified'}));
}
window.FlixerLuluSource={supports:server=>Boolean(sourceFor(server)),resolve,clearCache:()=>cache.clear()};
