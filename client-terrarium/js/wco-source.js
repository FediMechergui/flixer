/* Public WCO metadata is resolved on Android; Vercel never proxies the video. */
(()=>{
 const origin='https://www.wcostream.tv',agent='Flixer (Android)',cache=new Map();
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 function sourceUrl(server){try{const u=new URL(server.embedUrl);return server.provider==='wco'&&server.type==='wco'&&u.origin===origin&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/[a-z0-9][a-z0-9-]{0,159}$/.test(u.pathname)?u.href:null}catch{return null}}
 function configuration(data){
  try{
   const u=new URL(data.server);if(!['https://neptun.wcostream.com','https://cdn.wcostream.com','https://ndisk.wcostream.com'].includes(u.origin)||!['','/'].includes(u.pathname)||u.search||u.hash||u.username||u.password)return [];
   return [['hd','HD'],['enc','SD'],['fhd','FHD']].flatMap(([key,label])=>{
    const token=data[key];if(typeof token!=='string'||!token||token.length>2000||/[\s\x00-\x1f]/.test(token))return [];
    const url=new URL('/getvid',u);url.searchParams.set('evid',token);
    const subtitles=[];if(typeof data.sub==='string'&&data.sub&&data.sub.length<=2000&&!/[\s\x00-\x1f]/.test(data.sub)){const sub=new URL('/getvid',u);sub.searchParams.set('evid',data.sub);subtitles.push({url:sub.href,mimeType:'text/vtt',language:'en',label:'English'});}
    return [{key,label,url:url.href,subtitles}];
   });
  }catch{return []}
 }
 async function resolve(server){
  const url=sourceUrl(server),plugin=window.Capacitor?.Plugins?.WcoSource;if(!url||!plugin?.resolve)return [];
  let old=cache.get(url);
  if(!old||Date.now()>old.expires){
   old={expires:Date.now()+120000,promise:plugin.resolve({url}).then(r=>configuration(r.configuration)).catch(()=>[])};cache.set(url,old);
   const entry=old;old.promise.then(rows=>{if(!rows.length&&cache.get(url)===entry)cache.delete(url)});if(cache.size>40)cache.delete(cache.keys().next().value);
  }
  const rows=await old.promise;
  return rows.map(row=>({...server,id:server.id+':'+row.key,name:'Watch Cartoon Online · '+row.label,type:'mp4',embedUrl:null,streamUrl:row.url,rawStreamUrl:row.url,subtitles:row.subtitles,sourceEmbedUrl:url,deviceResolved:true,headers:{'User-Agent':agent}}));
 }
 // WCO labels later seasons explicitly and lists a series' first season as plain
 // "Episode N" entries. Only that evidence assigns season 1; shorts, specials and
 // arc-labelled entries keep source numbering. Mirrors server/src/wco.js.
 function inferFirstSeason(episodes,seriesSlug){
  const seasons=new Set(episodes.map(e=>e.season).filter(s=>s!==null));
  if(seasons.has(1)||![...seasons].some(s=>s>=2))return episodes;
  const plain=new RegExp('^sp:wco:e:'+seriesSlug+':'+seriesSlug+'-episode-\\d');
  for(const e of episodes)if(e.season===null&&e.number!==null&&plain.test(e.id)&&/^episode[ -]*\d/i.test(e.title)){e.season=1;e.absoluteNumber=null;}
  return episodes;
 }
 async function details(id){
  const m=/^sp:wco:s:([a-z0-9][a-z0-9-]{0,159})$/.exec(id),plugin=window.Capacitor?.Plugins?.WcoSource;if(!m||!plugin?.page)throw Error('WCO details unavailable');
  const {html}=await plugin.page({slug:m[1]});if(typeof html!=='string'||html.length>2000000)throw Error('WCO page unavailable');
  const doc=new DOMParser().parseFromString(html,'text/html'),canonical=doc.querySelector('link[rel=canonical]')?.href;
  if(canonical&&canonical.replace(/\/$/,'')!==origin+'/anime/'+m[1])throw Error('WCO identity changed');
  const title=clean(doc.querySelector('.vsbaslik h2')?.textContent);if(!title||!doc.querySelector('#episodeList'))throw Error('WCO episode guide unavailable');
  let poster;try{const u=new URL(doc.querySelector('#cat-img-desc img')?.getAttribute('src'),origin);if(u.protocol==='https:'&&u.hostname==='images.wcostream.com'&&!u.username&&!u.password)poster=u.href}catch{}
  const seen=new Set(),episodes=[];
  for(const a of doc.querySelectorAll('#episodeList a.dark-episode-item[href]')){
   let u;try{u=new URL(a.getAttribute('href'),origin)}catch{continue}
   const slug=/^\/([a-z0-9][a-z0-9-]{0,159})\/?$/.exec(u.pathname)?.[1],label=clean(a.querySelector('span')?.textContent);
   if(u.origin!==origin||u.username||u.password||u.search||u.hash||!slug||!label||seen.has(slug)||a.classList.contains('premium')||a.getAttribute('data-premium')==='1'||/^Movie\s*:/i.test(label))continue;
   seen.add(slug);const text=label+' '+slug,n=/\bepisode[ -]*(\d+(?:\.\d+)?)/i.exec(text),s=/\bseason[ -]*(\d+)/i.exec(text),ordinal=/\b(?:(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)[ -]+season|season[ -]+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth))\b/i.exec(text),group=/^s(\d+)-\d+$/.exec(a.getAttribute('data-season')||''),mode=a.getAttribute('data-lang');
   const season=ordinal?['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'].indexOf((ordinal[1]||ordinal[2]).toLowerCase())+1:s?Number(s[1]):null,number=n?Number(n[1]):null,epId='sp:wco:e:'+m[1]+':'+slug;
   const evidence={audioModes:['sub','dub'].includes(mode)?[mode]:[],...(mode==='sub'?{subtitleLanguages:['en']}:mode==='dub'?{audioLanguages:['en']}:{})};
   episodes.push({id:epId,title:label,season,number,absoluteNumber:season===null?number:null,sourceUrl:origin+'/'+slug,...evidence,offerings:[{provider:'wco',id:epId,...evidence}]});
  }
  inferFirstSeason(episodes,m[1]);
  episodes.sort((a,b)=>(a.season??Number.MAX_SAFE_INTEGER)-(b.season??Number.MAX_SAFE_INTEGER)||(a.number??Number.MAX_SAFE_INTEGER)-(b.number??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id));
  const audioModes=[...new Set(episodes.flatMap(e=>e.audioModes))],anime=audioModes.length>0;
  return {id,title,kind:'series',sourceUrl:origin+'/anime/'+m[1],channelId:'wco',documentary:false,providerMetadata:true,synopsis:clean(doc.querySelector('#cat-img-desc .iltext')?.textContent),poster:poster?{custom:poster}:null,portrait:poster,altTitles:[...doc.querySelectorAll('.film-name[data-jname]')].map(e=>clean(e.getAttribute('data-jname'))).filter(Boolean),tags:['animation',anime?'anime':'cartoons'],collections:[anime?'anime':'cartoons'],audioModes,episodes,episodeCount:episodes.length,episodesComplete:true,offerings:[{provider:'wco',id,sourceUrl:origin+'/anime/'+m[1]}]};
 }
 async function search(query){
  const {html}=await window.Capacitor.Plugins.WcoSource.search({query:String(query).slice(0,80)});if(typeof html!=='string'||html.length>2000000)throw Error('WCO search unavailable');
  const doc=new DOMParser().parseFromString(html,'text/html'),items=new Map();
  for(const a of doc.querySelectorAll('.aramadabaslik a[href]')){
   let u;try{u=new URL(a.getAttribute('href'),origin)}catch{continue}
   const slug=/^\/anime\/([a-z0-9][a-z0-9-]{0,159})\/?$/.exec(u.pathname)?.[1],title=clean(a.textContent);
   if(u.origin!==origin||u.username||u.password||u.hash||!slug||!title||slug==='movies')continue;
   if([...u.searchParams.keys()].some(k=>!['lang','season'].includes(k)))continue;
   const id='sp:wco:s:'+slug,mode=u.searchParams.get('lang');let poster;
   try{const img=new URL(a.closest('.cerceve,.iccerceve')?.querySelector('img')?.getAttribute('src'),origin);if(img.protocol==='https:'&&img.hostname==='images.wcostream.com'&&!img.username&&!img.password)poster=img.href}catch{}
   const old=items.get(id);if(old){if(['sub','dub'].includes(mode)&&!old.audioModes.includes(mode))old.audioModes.push(mode);continue;}
   items.set(id,{id,title,kind:'series',documentary:false,channelId:'wco',sourceUrl:origin+'/anime/'+slug,poster:poster?{custom:poster}:null,portrait:poster,providerMetadata:true,tags:['animation',...(['sub','dub'].includes(mode)?['anime']:mode==='cartoon'?['cartoons']:[])],collections:['sub','dub'].includes(mode)?['anime']:mode==='cartoon'?['cartoons']:[],audioModes:['sub','dub'].includes(mode)?[mode]:[],episodes:[],episodeCount:0,offerings:[{provider:'wco',id,sourceUrl:origin+'/anime/'+slug}]});
  }
  return [...items.values()];
 }
 window.FlixerWcoSource={supports:server=>Boolean(sourceUrl(server)),configuration,resolve,details,search,clearCache:()=>cache.clear(),cancel:()=>window.Capacitor?.Plugins?.WcoSource?.cancel?.()};
})();
