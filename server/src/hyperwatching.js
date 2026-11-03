import {load} from 'cheerio';
import {safeRemoteFetch} from './stream-security.js';

export const HYPERWATCHING_ORIGIN='https://v2.hyperwatching.com';
const cache=new Map();
const integer=value=>Number.isSafeInteger(value)&&value>0;
export function hyperwatchingId(value){
  try{const u=new URL(value);return u.origin===HYPERWATCHING_ORIGIN&&!u.username&&!u.password&&!u.search&&!u.hash?/^\/watch\/([A-Za-z0-9]{6,64})$/.exec(u.pathname)?.[1]||null:null;}catch{return null;}
}
export function parseHyperwatchingPage(html,expectedId){
  const $=load(html);let page;try{page=JSON.parse($('[data-page]').first().attr('data-page'));}catch{throw Error('Hyperwatching player format changed');}
  const p=page?.props;
  if(page.component!=='Video/Embed'||p?.video?.hashid!==expectedId||!Array.isArray(p.video.servers))throw Error('Hyperwatching player identity mismatch');
  if(p.is_vip!==false)throw Error('Hyperwatching player is not publicly available');
  const seen=new Set();
  return p.video.servers.filter(server=>integer(server.id)&&server.is_vip===false&&server.status==='completed'&&server.type==='iframe'&&!seen.has(server.id)&&seen.add(server.id))
    .map(server=>({id:server.id,name:String(server.name||'Player').replace(/[<>\r\n]/g,'').slice(0,60)}));
}
export function parseHyperwatchingServer(data,choice,watchUrl){
  if(!hyperwatchingId(watchUrl)||!integer(choice?.id)||data?.player!=='iframe'||typeof data.watch_url!=='string')return null;
  let u;try{u=new URL(data.watch_url);}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return null;
  const allowed=(['uqload.vc','uqload.co','uqload.net'].includes(u.hostname)&&/^\/embed-[A-Za-z0-9]+\.html$/.test(u.pathname))
    ||(['hgcloud.to','mixdrop.top','mixdrop.ag','lulustream.com','savefiles.com'].includes(u.hostname)&&/^\/e\/[A-Za-z0-9]+\/?$/.test(u.pathname));
  if(!allowed)return null;
  // Use the public page's ordinary iframe context. Do not forward API tokens,
  // cookies or arbitrary returned headers into third-party players.
  return {id:'stardima:hyperwatching:'+choice.id,provider:'stardima',name:'StarDima - '+choice.name,type:'embed',embedUrl:u.href,sandbox:null,headers:{Referer:watchUrl}};
}
async function request(path,{timeoutMs=6000,referer=HYPERWATCHING_ORIGIN+'/'}={}){
  const url=new URL(path,HYPERWATCHING_ORIGIN);
  if(url.origin!==HYPERWATCHING_ORIGIN||url.username||url.password)throw Error('Invalid Hyperwatching request');
  const r=await safeRemoteFetch(url.href,{timeoutMs,redirects:0,headers:{Accept:'application/json,text/html','User-Agent':'Mozilla/5.0','X-Requested-With':'XMLHttpRequest',Referer:referer}});
  if(!r.ok){await r.body?.cancel();throw Error('Hyperwatching HTTP '+r.status);}
  const reader=r.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024)throw Error('Hyperwatching response too large');chunks.push(value);}}finally{await reader.cancel();}
  return Buffer.concat(chunks).toString('utf8');
}
export async function resolveHyperwatchingServers(watchUrl,{fresh=false,request:fetchPage=request,budgetMs=12000}={}){
  const id=hyperwatchingId(watchUrl);if(!id)throw Error('Invalid Hyperwatching player');
  const cached=cache.get(id);
  if(fetchPage===request&&!fresh&&cached&&Date.now()-cached.at<120000)return cached.promise;
  const promise=(async()=>{
    const deadline=Date.now()+Math.min(15000,Math.max(1,Number(budgetMs)||12000));
    const get=async path=>{const timeoutMs=Math.min(6000,deadline-Date.now());if(timeoutMs<=0)throw Error('Hyperwatching request budget reached');let timer;
      try{return await Promise.race([Promise.resolve().then(()=>fetchPage(path,{timeoutMs,referer:watchUrl})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Hyperwatching request timed out')),timeoutMs);})]);}finally{clearTimeout(timer);}};
    const choices=parseHyperwatchingPage(await get(watchUrl),id),result=[];
    if(choices.length>24)throw Error('Hyperwatching server inventory exceeds request limit');
    let index=0;
    await Promise.all(Array.from({length:Math.min(3,choices.length)},async()=>{
      while(index<choices.length&&Date.now()<deadline){const position=index++,choice=choices[position];
        try{const response=JSON.parse(await get('/embed/'+id+'/server/'+choice.id+'/url')),server=parseHyperwatchingServer(response,choice,watchUrl);if(server)result[position]=server;}catch{/* Other published free servers can still resolve. */}
      }
    }));
    const seen=new Set(),servers=result.filter(Boolean).filter(row=>!seen.has(row.embedUrl)&&seen.add(row.embedUrl));
    if(choices.length&&!servers.length)throw Error('Hyperwatching free servers are temporarily unavailable');
    return servers;
  })();
  if(fetchPage===request){cache.set(id,{at:Date.now(),promise});if(cache.size>100)cache.delete(cache.keys().next().value);}
  try{return await promise;}catch(error){if(cache.get(id)?.promise===promise)cache.delete(id);throw error;}
}
