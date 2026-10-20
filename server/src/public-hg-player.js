import JSON5 from 'json5';
import {safeRemoteFetch} from './stream-security.js';
import {createPublicHgConfig} from '../../shared/public-hg-config.js';
export const {unpackPublicPlayerScripts,parseHgPublicLinks}=createPublicHgConfig(JSON5.parse);

async function boundedText(response,max){
 const reader=response.body?.getReader();if(!reader)return '';let text='',bytes=0;const decoder=new TextDecoder();
 try{while(bytes<max){const r=await reader.read();if(r.done)break;const chunk=r.value.subarray(0,max-bytes);bytes+=chunk.length;text+=decoder.decode(chunk,{stream:true});}}finally{await reader.cancel().catch(()=>{});}return text;
}
const cache=new Map();
export async function resolveHgPublicServers(server,{fresh=false,fetchPage=safeRemoteFetch}={}){
 let source;try{source=new URL(server?.embedUrl);}catch{return [];}
 if(source.protocol!=='https:'||source.username||source.password||source.port||source.search||source.hash
  ||!['cybervynx.com','hgcloud.to','hglamioz.com','hgplaycdn.com'].includes(source.hostname)||!/^\/e\/[a-z0-9]{12}$/.test(source.pathname))return [];
 const key=source.pathname,old=cache.get(key);let media;
 if(fetchPage===safeRemoteFetch&&!fresh&&old&&Date.now()<old.expires)media=await old.promise;
 else{
  const promise=(async()=>{
   // These exact public mirror formats were observed in HG's ordinary browser
   // redirects, preserving the original video ID. No fabricated media IDs.
   const url=['hglamioz.com','hgplaycdn.com'].includes(source.hostname)?source.href:'https://hglamioz.com'+source.pathname;
   const response=await fetchPage(url,{timeoutMs:2500,headers:{Accept:'text/html'}});
   if(!response.ok){await response.body?.cancel();return [];}
   const links=parseHgPublicLinks(await boundedText(response,262144));
   const choices=await Promise.all(links.slice(0,3).map(async link=>{
    try{const r=await fetchPage(link.url,{timeoutMs:2500,headers:{Accept:'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain'}});
     if(!r.ok){await r.body?.cancel();return null;}
     const text=await boundedText(r,8192);
     return /^\uFEFF?#EXTM3U(?:\r?\n|$)/.test(text)&&/#EXT(?:INF|\-X\-(?:STREAM-INF|MEDIA))\b/.test(text)?link:null;
    }catch{return null;}
   }));return choices.filter(Boolean);
  })().catch(()=>[]);
  if(fetchPage===safeRemoteFetch){const entry={promise,expires:Date.now()+300000};cache.set(key,entry);if(cache.size>250)cache.delete(cache.keys().next().value);promise.then(rows=>{if(!rows.length)entry.expires=Date.now()+15000;});}
  media=await promise;
 }
 const {embedUrl,type,...base}=server;
 return media.map((link,index)=>({...base,id:server.id+':'+link.key,name:server.name+' - Direct video'+(index?' '+(index+1):''),type:'hls',streamUrl:link.url,sourceEmbedUrl:embedUrl}));
}
