import {safeRemoteFetch} from './stream-security.js';

// Small metadata responses only. Failed requests never replace a good catalogue.
export function frenchSourceRequest(origin) {
  const cache=new Map();
  return async function request(path,{fresh=false,body,referer=origin+'/'}={}) {
    const url=new URL(path,origin);
    if(url.origin!==origin||url.username||url.password)throw Error('Invalid French source destination');
    const key=url.href+'\n'+(body||''),old=cache.get(key);
    if(!fresh&&old&&Date.now()-old.at<120000)return old.promise;
    const promise=(async()=>{
      const response=await safeRemoteFetch(url.href,{timeoutMs:7000,redirects:0,method:body===undefined?'GET':'POST',body,headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json,text/html',Referer:referer,...(body!==undefined?{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest',Origin:origin}:{})}});
      if(!response.ok){await response.body?.cancel();throw Error(`${new URL(origin).hostname} HTTP ${response.status}; cached data retained`);}
      const reader=response.body.getReader(),chunks=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw Error('French source response too large');chunks.push(value);}}finally{await reader.cancel();}
      const text=Buffer.concat(chunks).toString('utf8');
      if(/<title[^>]*>\s*(Just a moment|Access denied)/i.test(text))throw Error('Source browser verification required');
      return text;
    })();
    cache.set(key,{at:Date.now(),promise});if(cache.size>80)cache.delete(cache.keys().next().value);
    try{return await promise;}catch(error){if(cache.get(key)?.promise===promise)cache.delete(key);throw error;}
  };
}
