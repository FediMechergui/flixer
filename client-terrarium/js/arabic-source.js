// Resolve public source pages on Android's own connection. Remote pages never
// receive the app bridge, and links are restricted to known provider/player hosts.
(function(){
 const providers={tuniflix:{origin:'https://tuniflix.site',name:'Tuniflix'},egydead:{origin:'https://tv10.egydead.live',name:'EgyDead'},ahwaktv:{origin:'https://yam.ahwaktv.net',name:'AhwakTV'},kirmalk:{origin:'https://kirmalk.com',name:'Kirmalk'},streamtunisie:{origin:'https://streamtunisie.net',name:'StreamTunisie'}};
 const hosts=new Set(['uqload.vc','uqload.net','hgcloud.to','mixdrop.top','mixdrop.ps','watch.easyvidplayer.com','watch.strp2p.site','audinifer.com','morencius.com','playmogo.com','s1.hdup400.com','movearnpre.com','dingtezuni.com','q7v3k8m2p1.top','vkvideo.ru','ok.ru','www.ok.ru','geo.dailymotion.com','www.dailymotion.com','player.vimeo.com','player.mediadelivery.net','app.videas.fr','www.vidspeed.org','doodstream.com','cybervynx.com','1vid.xyz','vidmoly.org','vidspeed.org','www.mp4upload.com','bysesukior.com','bysetayico.com','voe.sx']);
 const cache=new Map();
 function source(id){
  const aloula=/^sp:aloula:e:([1-9]\d{0,8})$/.exec(id||'');if(aloula)return {provider:'aloula',token:aloula[1]};
  const cimafu=/^sp:cimafu:([me]):([A-Za-z0-9_-]{1,320})$/.exec(id||'');if(cimafu)try{const path=new TextDecoder().decode(Uint8Array.from(atob(cimafu[2].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));if(!/^\/[^/?#\\]+\/$/.test(path)||/\.\.|%2f|%5c|%2e|\0/i.test(path))return null;return {provider:'cimafu',type:cimafu[1],url:'https://cimafu.live'+path+'watch/',cfg:{origin:'https://cimafu.live',name:'Cima4u'}};}catch{return null;}
  const match=/^sp:(tuniflix|egydead|ahwaktv|kirmalk|streamtunisie):([me]):([A-Za-z0-9_-]{1,300})$/.exec(id||'');if(!match)return null;
  const [,provider,type,token]=match,cfg=providers[provider];let url;
  if(provider==='tuniflix')url=cfg.origin+'/'+(type==='m'?'movie':'episode')+'/'+token;
  else if(provider==='ahwaktv'||provider==='kirmalk')url=cfg.origin+'/watch.php?vid='+token;
  else try{const path=new TextDecoder().decode(Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)));if(!/^\/(?:[a-z-]+\/)?[^/?#\\]+\/$/i.test(path)||/\.\.|%2f|%5c|%2e|\0/i.test(path))return null;url=cfg.origin+path;}catch{return null;}
  return {provider,type,token,url,cfg};
 }
 const http=()=>{const c=window.Capacitor;return c?.isNativePlatform?.()?(c.Plugins?.CapacitorHttp||c.registerPlugin?.('CapacitorHttp')):null;};
 async function page(url,origin,{view=false}={}){
  const u=new URL(url);if(u.origin!==origin||u.username||u.password||u.hash)throw Error('Invalid source page');
  const response=await http().request({url:u.href,method:view?'POST':'GET',headers:{Accept:'text/html',...(view?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(view?{data:'View=1'}:{}),responseType:'text',disableRedirects:true,connectTimeout:5000,readTimeout:6000});
  if(response.status<200||response.status>=300)throw Error('Source HTTP '+response.status);
  if(response.url&&new URL(response.url).origin!==origin)throw Error('Source origin changed');
  if(typeof response.data!=='string'||response.data.length>3000000||/<title[^>]*>\s*(?:Just a moment|Access denied|Quick check)/i.test(response.data))throw Error('Source page unavailable');
  return new DOMParser().parseFromString(response.data,'text/html');
 }
 function players(s,doc){
  const urls=[];
  if(['tuniflix'].includes(s.provider))doc.querySelectorAll('iframe[src]').forEach(el=>urls.push(el.getAttribute('src')));
  if(s.provider==='egydead')doc.querySelectorAll('.watchAreaMaster [data-link],.watchServers [data-link],.serversList [data-link]').forEach(el=>urls.push(el.getAttribute('data-link')));
  if(s.provider==='cimafu'){
   const canonical=doc.querySelector('link[rel="canonical"]')?.getAttribute('href');if(canonical){const u=new URL(canonical,s.url),expected=new URL(s.url);if(u.origin!==s.cfg.origin||decodeURIComponent(u.pathname).replace(/watch\/$/,'')!==decodeURIComponent(expected.pathname).replace(/watch\/$/,''))throw Error('Cima4u player identity changed');}
   doc.querySelectorAll('.server_list [data-server]').forEach(el=>urls.push(el.getAttribute('data-server')));
  }
  if(s.provider==='streamtunisie'){
   doc.querySelectorAll('.tv-player-card iframe[src],article .entry-content iframe[src],article video source[src]').forEach(el=>urls.push(el.getAttribute('src')));
   for(const script of doc.querySelectorAll('script'))for(const match of script.textContent.matchAll(/switchHlsTvServer\([^,\n]*,\s*["']([^"']+)["']/g))urls.push(match[1].replace(/&amp;|&#0?38;/g,'&'));
  }
  if(['ahwaktv','kirmalk'].includes(s.provider)){
   doc.querySelectorAll('script[type="application/ld+json"]').forEach(el=>{try{const data=JSON.parse(el.textContent);for(const item of Array.isArray(data)?data:data['@graph']||[data])if(item['@type']==='VideoObject'&&item.embedUrl)urls.push(item.embedUrl);}catch{}});
   doc.querySelectorAll('link[itemprop="embedUrl"],[data-embed-url]').forEach(el=>urls.push(el.getAttribute('href')||el.getAttribute('data-embed-url')));
  }
  return [...new Set(urls)].flatMap(value=>{try{
   const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)return [];
   if(s.provider==='streamtunisie'&&u.hostname==='s2.savefiles.com'&&u.pathname.endsWith('.m3u8')){
    const start=Number(u.searchParams.get('s')),duration=Number(u.searchParams.get('e'));if(start&&duration&&(start+duration)*1000<=Date.now())return [];
    return [{id:'streamtunisie:device:hls:'+u.pathname,provider:s.provider,name:s.cfg.name+' - HLS',type:'hls',streamUrl:u.href}];
   }
   const youtube=['youtube.com','www.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)&&/^\/embed\/([\w-]{11})(?:[/?]|$)/.exec(u.pathname);
   if(!youtube&&!hosts.has(u.hostname))return [];
   return [{id:s.provider+':device:'+u.hostname+':'+u.pathname,provider:s.provider,name:s.cfg.name+' - '+(youtube?'YouTube':u.hostname),type:youtube?'youtube':'embed',...(youtube?{videoId:youtube[1]}:{embedUrl:u.href,sandbox:null})}];
  }catch{return [];}});
 }
 async function resolve(id,{fresh=false,signal}={}){
  const s=source(id);if(!s||!http())return [];const old=cache.get(id);if(!fresh&&old&&Date.now()-old.at<120000){const rows=await old.promise;return signal?.aborted?[]:rows;}
  const promise=(async()=>{
   if(s.provider==='aloula'){
    const json=async suffix=>{const url='https://aloula.faulio.com/api/v1/video/'+s.token+suffix,response=await http().request({url,method:'GET',headers:{Accept:'application/json','Accept-Language':'ar'},responseType:'json',disableRedirects:true,connectTimeout:5000,readTimeout:6000});if(response.status!==200||response.url&&new URL(response.url).origin!=='https://aloula.faulio.com')throw Error('Aloula player unavailable');return typeof response.data==='string'?JSON.parse(response.data):response.data;};
    const info=await json('');if(!info.blocks?.some(v=>String(v.id)===s.token&&!v.geo_blocked&&(v.access==='guest'||v.access?.available===true&&v.access.access?.guest===true)))return [];
    const data=await json('/player'),hls=data?.settings?.protocols?.hls;if(typeof hls!=='string'||data.settings.drm||data.settings.sources?.some?.(source=>source.drm))return [];
    const u=new URL(hls);if(u.protocol!=='https:'||u.hostname!=='clvod.itworkscdn.net'||u.username||u.password||u.port||!u.pathname.endsWith('.m3u8'))return [];
    return [{id:'aloula:'+s.token,provider:'aloula',name:'Aloula - HLS',type:'hls',streamUrl:u.href,headers:{Referer:'https://aloula.sba.sa/'}}];
   }
   let doc=await page(s.url,s.cfg.origin);
   if(s.provider==='egydead'){
    const expected=new URL(s.url).pathname.replace(/\/$/,'')+'/watch/';
    const watch=[...doc.querySelectorAll('.watchNow a[href]')].map(el=>{try{return new URL(el.getAttribute('href'),s.url);}catch{return null;}}).find(u=>u?.origin===s.cfg.origin&&u.pathname===expected&&!u.search&&!u.hash);
    if(watch)doc=await page(watch.href,s.cfg.origin);else if(!players(s,doc).length)doc=await page(s.url,s.cfg.origin,{view:true});
   }
   if(s.provider==='ahwaktv'){
    let url=s.cfg.origin+'/see.php?vid='+s.token;doc=await page(url,s.cfg.origin);
    for(let i=0;i<2;i++){const link=doc.querySelector('#video-wrapper #play-video[href],#video-wrapper a.controls-play-pause-big[href]');if(!link)break;const next=new URL(link.getAttribute('href'),url);if(next.origin!==s.cfg.origin||next.pathname!=='/see.php'||! /^[A-Za-z0-9_-]{1,100}$/.test(next.searchParams.get('vid')||'')||next.href===url)break;url=next.href;doc=await page(url,s.cfg.origin);}
   }
   if(s.provider==='streamtunisie'&&s.type==='m'){
    const link=doc.querySelector('article a[href*="/watch-movie-"]');if(link){const next=new URL(link.getAttribute('href'),s.url);if(next.origin===s.cfg.origin&&/^\/watch-movie-[^/?]+\/$/.test(next.pathname))doc=await page(next.href,s.cfg.origin);}
   }
   if(s.provider==='tuniflix'){
    const choices=[...doc.querySelectorAll('iframe[src]')].map(el=>{try{return new URL(el.getAttribute('src'),s.cfg.origin);}catch{return null;}}).filter(u=>u?.origin===s.cfg.origin&&u.pathname==='/'&&/^\d+$/.test(u.searchParams.get('trembed')||'')&&/^\d+$/.test(u.searchParams.get('trid')||'')&&/^[12]$/.test(u.searchParams.get('trtype')||''));
    const post=choices[0]?.searchParams.get('trid');doc.querySelectorAll('.OptionBx[data-key][data-id]').forEach(el=>{const key=el.getAttribute('data-key');if(post&&el.getAttribute('data-id')===post&&/^\d+$/.test(key))choices.push(new URL('/?trembed='+key+'&trid='+post+'&trtype='+(s.type==='m'?1:2),s.cfg.origin));});
    const results=await Promise.allSettled([...new Set(choices.map(u=>u.href))].slice(0,8).map(async url=>players(s,await page(url,s.cfg.origin))));
    return [...new Map(results.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(server=>[server.embedUrl||server.videoId,server])).values()];
   }
   return players(s,doc);
  })();cache.set(id,{at:Date.now(),promise});if(cache.size>30)cache.delete(cache.keys().next().value);
  try{const rows=await promise;return signal?.aborted?[]:rows;}catch(error){cache.delete(id);throw error;}
 }
 window.FlixerArabicSource={supports:id=>!!source(id)&&!!http(),resolve};
})();
