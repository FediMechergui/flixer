// Anonymous StarDima website requests on Android's own connection. No APK API,
// credentials, proxy or background collector. Remote documents are only parsed.
(function(){
 const STAR='https://www.stardima.com',HYPER='https://v2.hyperwatching.com';
 const slug='(?:[a-f0-9]{13}|video-[1-9][0-9]{0,9})',idPattern=new RegExp('^sp:stardima:([mse]):('+slug+')(?::([1-9][0-9]{0,11}))?$');
 const categories={anime:'anmy','anime-sub':'anmy','anime-dub':'anmy',cartoons:'krton','classic-cartoons':'krton-zman'};
 const cache=new Map(),cooldowns=new Map(),savedDetails=new Map(),TTL=120000,MAX_BODY=4*1024*1024;
 const clean=value=>String(value??'').replace(/\s+/g,' ').trim(),positive=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
 const flag=value=>value===true||value===1||value==='1'||value==='true';
 const locked=value=>flag(value?.is_exclusive)||flag(value?.is_premium)||flag(value?.premium)||value?.is_free===false||value?.is_free===0||value?.can_watch===false;
 const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
 const all=(root,selector)=>[...root.querySelectorAll(selector)],attr=(root,selector,name)=>root.querySelector(selector)?.getAttribute(name),text=(root,selector)=>clean(root.querySelector(selector)?.textContent);
 const http=()=>{const c=window.Capacitor;return c?.isNativePlatform?.()?(c.Plugins?.CapacitorHttp||c.registerPlugin?.('CapacitorHttp')):null;};
 function parsed(id){const m=idPattern.exec(String(id));return m&&((m[1]==='e')===!!m[3])?{type:m[1],slug:m[2],...(m[3]?{episodeId:Number(m[3])}:{})}:null;}
 function titleUrl(id){const p=parsed(id);return p?STAR+'/'+(p.type==='m'?'movie':'tvshow')+'/'+p.slug+(p.type==='e'?'/play/'+p.episodeId:''):null;}
 function idFromUrl(value){try{const u=new URL(value,STAR);if(u.origin!==STAR||u.username||u.password||u.port||u.search||u.hash)return null;const m=new RegExp('^/(movie|tvshow|play)/('+slug+')(?:/play/([1-9][0-9]{0,11}))?/?$').exec(u.pathname);if(!m||m[3]&&m[1]!=='tvshow')return null;const id='sp:stardima:'+(m[3]?'e':m[1]==='tvshow'?'s':'m')+':'+m[2]+(m[3]?':'+m[3]:'');return parsed(id)?id:null;}catch{return null;}}
 function playerId(value){try{const u=new URL(value);return u.origin===HYPER&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash?/^\/watch\/([A-Za-z0-9]{6,64})$/.exec(u.pathname)?.[1]||null:null;}catch{return null;}}
 function image(value){if(typeof value!=='string'||!value.trim()||/^(?:undefined|null|none|false)$/i.test(value.trim()))return null;try{const u=new URL(/^https?:|^\//.test(value)?value:'/storage/'+value,STAR);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port?u.href:null;}catch{return null;}}
 function languages(value){const label=clean(value);return /مدبلج/.test(label)?{audioLanguages:['ar'],audioModes:['dub']}:/مترجم/.test(label)?{subtitleLanguages:['ar'],audioModes:['sub']}:{};}
 function row(id,title,poster){const p=parsed(id),portrait=image(poster);return {id,title:clean(title),kind:p.type==='m'?'film':'series',year:null,altTitles:[],portrait,poster:portrait?{custom:portrait}:null,sourceUrl:titleUrl(id),channelId:'stardima',collections:['arabic'],tags:[],providerMetadata:true,documentary:false,access:'public',episodes:[],episodeCount:0,offerings:[{provider:'stardima',id,sourceUrl:titleUrl(id),availability:'unverified'}]};}
 function classify(item,collection){if(['anime','anime-sub','anime-dub'].includes(collection)){item.tags.push('animation','anime');item.collections.push('anime');}if(['cartoons','classic-cartoons'].includes(collection)){item.tags.push('animation');item.collections.push(collection);}return item;}
 function aliases(title,main){return [...new Set(clean(title).replace(/\s*[-–—]\s*(?:ستارديما|StarDima)\s*$/iu,'').split(/\s*\|\s*/).map(clean).filter(value=>value&&value.length<=200&&value.toLowerCase()!==clean(main).toLowerCase()))];}
 function cancelled(){const error=Error('StarDima request cancelled');error.name='AbortError';return error;}
 function check(signal,deadline){if(signal?.aborted)throw cancelled();if(deadline<=Date.now())throw Error('StarDima request time budget reached');}
 function bounded(promise,deadline,signal){
  check(signal,deadline);let timer,onAbort;
  const wait=new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('StarDima request time budget reached')),deadline-Date.now());onAbort=()=>reject(cancelled());signal?.addEventListener('abort',onAbort,{once:true});promise.then(resolve,reject);});
  return wait.finally(()=>{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);});
 }
 function allowed(value){
  const u=new URL(value,STAR);if(u.username||u.password||u.port||u.hash)throw Error('Invalid StarDima destination');
  if(u.origin===STAR){
   if(['/mosalsalat','/aflam','/search'].includes(u.pathname)){
    const keys=[...u.searchParams.keys()];if(u.searchParams.get('premium')!=='free'||!positive(u.searchParams.get('page'))||Number(u.searchParams.get('page'))>10000||keys.some(key=>!['premium','page','query','category','language'].includes(key))||(u.searchParams.get('query')||'').length>200||u.searchParams.has('category')&&!Object.values(categories).includes(u.searchParams.get('category'))||u.searchParams.has('language')&&!['sub','dub'].includes(u.searchParams.get('language')))throw Error('Invalid StarDima catalogue request');
   }else if(u.pathname==='/newrelases'){if(u.search)throw Error('Invalid StarDima latest request');}
   else if(/^\/series\/(?:season|episode)\/[1-9][0-9]{0,11}$/.test(u.pathname)){if(u.search&&u.search!=='?X-Requested-With=XMLHttpRequest')throw Error('Invalid StarDima guide request');}
   else if(!idFromUrl(u.href))throw Error('Invalid StarDima title request');
  }else if(u.origin===HYPER){if(u.search||!/^\/(?:watch\/[A-Za-z0-9]{6,64}|embed\/[A-Za-z0-9]{6,64}\/server\/[1-9][0-9]{0,11}\/url)$/.test(u.pathname))throw Error('Invalid public player request');}
  else throw Error('Invalid StarDima destination');return u;
 }
 function prune(){let bytes=[...cache.values()].reduce((sum,entry)=>sum+(entry.bytes||0),0);for(const [key,entry]of cache){if(cache.size<=32&&bytes<=12*1024*1024)break;if(entry.promise)continue;cache.delete(key);bytes-=entry.bytes||0;}}
 async function read(value,{json=false,fresh=false,deadline=Date.now()+12000,signal,referer}={}){
  check(signal,deadline);const transport=http();if(!transport?.request)throw Error('Native StarDima requests unavailable');const u=allowed(value),key=u.href+'|'+json,old=cache.get(key);
  if(old?.promise)return bounded(old.promise,deadline,signal);
  if(!fresh&&old?.value!==undefined&&Date.now()-old.at<TTL)return old.value;
  if((cooldowns.get(u.origin)||0)>Date.now())throw Error('StarDima source temporarily unavailable; retry later');
  if(old?.error&&Date.now()<old.errorUntil)throw old.error;
  const timeout=Math.max(1,Math.min(6000,deadline-Date.now())),entry=old||{};
  const promise=(async()=>{
   const headers={Accept:json?'application/json':'text/html','User-Agent':window.navigator?.userAgent||'Mozilla/5.0',...(json||u.origin===HYPER?{'X-Requested-With':'XMLHttpRequest'}:{})};
   if(u.origin===HYPER&&playerId(referer))headers.Referer=referer;
   const response=await bounded(transport.request({url:u.href,method:'GET',headers,responseType:'text',disableRedirects:true,connectTimeout:timeout,readTimeout:timeout}),Date.now()+timeout);
   if(response.status===403||response.status===429)cooldowns.set(u.origin,Date.now()+60000);
   if(response.status!==200)throw Error('StarDima source HTTP '+response.status);
   if(response.url&&response.url!==u.href)throw Error('StarDima source destination changed');
   const body=typeof response.data==='string'?response.data:json&&response.data&&typeof response.data==='object'?JSON.stringify(response.data):null;
   if(body===null||body.length>MAX_BODY)throw Error('StarDima source response too large or invalid');
   if(/<title[^>]*>\s*(?:Just a moment|Access denied|Attention Required)/i.test(body)){cooldowns.set(u.origin,Date.now()+60000);throw Error('StarDima browser verification required');}
   entry.value=body;entry.bytes=body.length*2;entry.at=Date.now();delete entry.error;return body;
  })();entry.promise=promise;cache.set(key,entry);prune();
  promise.then(()=>{entry.promise=null;prune();},error=>{entry.promise=null;entry.error=error;entry.errorUntil=Date.now()+15000;prune();});
  return bounded(promise,deadline,signal);
 }
 function document(html){return new DOMParser().parseFromString(html,'text/html');}
 function parseList(input,{page,kind,collection}){
  let data;try{data=JSON.parse(input);}catch{}
  let records,pagination;
  if(Array.isArray(data?.videos)&&data.pagination){records=data.videos;pagination=data.pagination;}
  else{
   const doc=document(input),grid=doc.querySelector('#video-grid');if(!grid)throw Error('StarDima listing format changed');
   records=all(grid,'a[href]').flatMap(a=>{const id=idFromUrl(a.getAttribute('href')),p=parsed(id),card=a.closest('div.flex.flex-col');return p&&p.type!=='e'?[{url:a.getAttribute('href'),title:text(a,'h3')||text(card||a,'h4'),description:text(a,'p'),poster_url:attr(card||a,'img','src'),year:/\b(?:19|20)\d{2}\b/.exec(a.textContent)?.[0],video_quality:clean(card?.lastElementChild?.querySelector('p')?.textContent),is_series:p.type==='s',is_exclusive:Boolean(card?.querySelector('[title*="حصري"],.fa-crown'))}]:[];});
   pagination={current_page:page,last_page:Number(grid.getAttribute('data-last-page'))||page};
  }
  const current=positive(pagination.current_page),last=positive(pagination.last_page);if(current!==page||!last||last<page||last>10000||records.length>100)throw Error('Invalid StarDima catalogue pagination');
  let malformed=false;
  const items=unique(records.flatMap(record=>{
   const id=idFromUrl(record?.url),p=parsed(id);if(!p||p.type==='e'||!clean(record?.title)||typeof record.is_series!=='boolean'||record.is_series!==(p.type==='s')){malformed=true;return [];}
   if(locked(record))return [];const item=row(id,record.title,record.poster_url);if(kind&&kind!==item.kind)return [];item.year=Number(/^(?:19|20)\d{2}$/.exec(String(record.year))?.[0])||null;item.synopsis=clean(record.description);if(positive(record.id))item.sourceRecordId=Number(record.id);Object.assign(item,languages(record.video_quality));return [classify(item,collection)];
  }));
  return {items,page,totalPages:last,hasNext:page<last,...(malformed?{partial:true,providerErrors:[{provider:'stardima',error:'Some source records were malformed; page must be retried'}]}:{})};
 }
 function identity(doc,id,episode=false){const canonical=attr(doc,'meta[property="og:url"]','content')||attr(doc,'link[rel="canonical"]','href');if(canonical&&(episode?parsed(idFromUrl(canonical))?.slug!==parsed(id)?.slug:idFromUrl(canonical)!==id))throw Error('StarDima title identity mismatch');}
 function titleContext(id,html){
  const p=parsed(id),doc=document(html);identity(doc,id);const hero=all(doc,'section').find(section=>section.querySelector('h1,img[alt$=" Logo"]'));if(!hero)throw Error('StarDima title missing');
  const headings=all(hero,'h1'),title=clean(headings[headings.length-1]?.textContent)||clean(attr(hero,'img[alt$=" Logo"]','alt')).replace(/ Logo$/,'');if(!title)throw Error('StarDima title missing');
  const item=row(id,title,attr(doc,'meta[property="og:image"]','content'));item.altTitles=aliases(text(doc,'title'),item.title);item.synopsis=text(hero,'p');item.year=Number(/\b(?:19|20)\d{2}\b/.exec(all(hero,'.info-item').map(e=>e.textContent).join(' '))?.[0])||null;
  Object.assign(item,languages(all(hero,'.info-item,span').map(e=>e.textContent).join(' ')));item.sourceRecordId=positive(attr(hero,'[data-video-id]','data-video-id'));
  const genres=all(hero,'a[href*="/search/"]').map(a=>{try{return decodeURIComponent(new URL(a.getAttribute('href'),STAR).pathname.split('/').pop());}catch{return '';}});
  for(const [collection,category]of Object.entries(categories))if(genres.includes(category))classify(item,collection);item.tags=[...new Set(item.tags)];item.collections=[...new Set(item.collections)];
  const play=all(hero,'a[href]').map(a=>a.getAttribute('href')).find(value=>{const ep=parsed(idFromUrl(value));return ep&&ep.slug===p.slug&&(p.type==='m'?ep.type==='m'&&new URL(value,STAR).pathname.startsWith('/play/'):ep.type==='e');});
  if(!play)throw Error('StarDima title has no public watch link');return {item,play};
 }
 function filmPlayer(id,html){const doc=document(html);identity(doc,id);const player=doc.querySelector('#video-player-container'),url=player&&attr(player,'iframe[src]','src');if(!player||!playerId(url)||/VIP|تسجيل الدخول|حصري/.test(player.textContent))throw Error('StarDima film has no free public player');return url;}
 function guide(id,html){const doc=document(html);identity(doc,id,true);return unique(all(doc,'.season-item[data-season-id]').flatMap(e=>{const id=positive(e.getAttribute('data-season-id')),label=clean(e.getAttribute('data-season-number')),m=/^(\d{1,3})$/.exec(label)||/(?:^|[\s._-])S(\d{1,3})(?:$|\s)/i.exec(label);return id?[{id,label,...(m?{number:Number(m[1])}:{})}]:[]}));}
 function episode(id,data){
  const p=parsed(id),ep=data?.episode;if(!p||p.type!=='e'||positive(ep?.id)!==p.episodeId||data?.series?.slug!==p.slug)throw Error('StarDima episode identity mismatch');
  if(ep.can_watch!==true||locked(ep)||ep.reason)throw Error('StarDima episode requires source access or subscription');
  const number=positive(ep.episode_number),season=data.season?.number==null?NaN:Number(data.season.number);if(!number||!playerId(ep.watch_url))throw Error('StarDima episode has no supported public player');
  return {episode:{id,title:clean(ep.title)||'Episode '+number,number,...(Number.isInteger(season)&&season>=0&&season<1000?{season}:{}),sourceUrl:titleUrl(id),offerings:[{provider:'stardima',id,sourceUrl:titleUrl(id)}],access:'public'},player:ep.watch_url,title:clean(data.series.title)};
 }
 function seasonEpisodes(id,season,data){
  const p=parsed(id);if(!Array.isArray(data?.episodes)||data.episodes.length>15000)throw Error('StarDima season format changed');if(data.series_id&&data.series_id!==p.slug)throw Error('StarDima season identity mismatch');
  return unique(data.episodes.flatMap(ep=>{const eid=positive(ep.id),number=positive(ep.episode_number);if(!eid||!number||locked(ep)||!playerId(ep.watch_url))return [];const episodeId='sp:stardima:e:'+p.slug+':'+eid;return [{id:episodeId,title:clean(ep.title)||'Episode '+number,number,...(Number.isInteger(season.number)?{season:season.number}:{}),sourceSeasonId:season.id,sourceSeasonLabel:season.label,sourceUrl:titleUrl(episodeId),offerings:[{provider:'stardima',id:episodeId,sourceUrl:titleUrl(episodeId)}]}];}));
 }
 async function pool(items,fn,{signal,deadline}={}){const results=[];let next=0;await Promise.all(Array.from({length:Math.min(3,items.length)},async()=>{while(next<items.length){const i=next++;try{check(signal,deadline);results[i]={value:await fn(items[i])};}catch(error){results[i]={error:error.message};if(signal?.aborted)break;}}}));if(signal?.aborted)throw cancelled();return results;}
 function latestEntries(html){
  const doc=document(html),timeline=doc.querySelector('#timeline-container');if(!timeline)throw Error('StarDima latest feed format changed');const entries=[],seen=new Set();
  for(const a of all(timeline,'[data-content="episodes"] a[href]')){const id=idFromUrl(a.getAttribute('href')),p=parsed(id);if(!p||p.type!=='e'||seen.has(p.slug))continue;seen.add(p.slug);const card=a.closest('div.flex.flex-col'),item=row('sp:stardima:s:'+p.slug,text(a,'h3').replace(/\s*-\s*حلقة\s*\d+\s*$/,''),attr(card||a,'img','src'));item.year=Number(/\b(?:19|20)\d{2}\b/.exec(text(a,'span'))?.[0])||null;Object.assign(item,languages(clean(card?.lastElementChild?.querySelector('p')?.textContent)));entries.push({item,episodeId:id});}return entries;
 }
 async function page({kind='series',page=1,search,collection='',latest=false,fresh=false,signal}={}){
  if(!Number.isInteger(page)||page<1||page>10000||!['film','series'].includes(kind))throw Error('Invalid StarDima catalogue page');const deadline=Date.now()+12000;
  if(latest&&!search&&kind==='series'&&(!collection||collection==='arabic')){
   const entries=latestEntries(await read('/newrelases',{fresh,deadline,signal})),selected=entries.slice((page-1)*12,page*12);
   const results=await pool(selected,async entry=>{const result=episode(entry.episodeId,JSON.parse(await read('/series/episode/'+parsed(entry.episodeId).episodeId,{json:true,fresh,deadline,signal})));return {...entry.item,title:result.title||entry.item.title,episodes:[result.episode],episodeCount:1,episodesComplete:false,latestEpisode:result.episode.id,episodeUpdateFeed:true};},{signal,deadline});
   const errors=results.filter(x=>x.error&&!/requires source access|no supported public player/.test(x.error));return {items:results.flatMap(x=>x.value?[x.value]:[]),page,totalPages:Math.max(1,Math.ceil(entries.length/12)),hasNext:page*12<entries.length,...(errors.length?{partial:true,providerErrors:errors.map(x=>({provider:'stardima',error:x.error}))}:{})};
  }
  const params=new URLSearchParams({premium:'free',page:String(page)});if(search)params.set('query',clean(search).slice(0,200));if(categories[collection])params.set('category',categories[collection]);if(collection==='anime-dub')params.set('language','dub');if(collection==='anime-sub')params.set('language','sub');
  return parseList(await read((search?'/search':kind==='film'?'/aflam':'/mosalsalat')+'?'+params,{fresh,json:true,deadline,signal}),{page,kind:search?undefined:kind,collection});
 }
 async function search(query,{aliases=[],signal}={}){
  const queries=[...new Set([query,...(Array.isArray(aliases)?aliases:[])].filter(value=>typeof value==='string').map(value=>clean(value).slice(0,200)).filter(Boolean))].slice(0,3);if(!queries.length)return [];
  const deadline=Date.now()+12000,results=await pool(queries,value=>page({search:value,signal}),{signal,deadline}),success=results.filter(x=>x.value);if(!success.length&&results[0]?.error)throw Error(results[0].error);return unique(success.flatMap(x=>x.value.items));
 }
 async function details(id,{fresh=false,signal}={}){
  const p=parsed(id);if(!p||p.type==='e')throw Error('Invalid StarDima title');if(signal?.aborted)throw cancelled();const saved=savedDetails.get(id);if(!fresh&&saved&&Date.now()-saved.at<TTL)return saved.item;
  const deadline=Date.now()+18000;check(signal,deadline);
  try{
   const {item,play}=titleContext(id,await read(titleUrl(id),{fresh,deadline,signal})),html=await read(play,{fresh,deadline,signal}),doc=document(html);
   const label=all(doc,'span').find(e=>clean(e.textContent)==='اللغة'),originalLanguage=clean(label?.nextElementSibling?.textContent);if(/^[a-z]{2,3}$/.test(originalLanguage))item.originalLanguage=originalLanguage;
   if(p.type==='m'){filmPlayer(id,html);item.episodes=[{id,title:item.title,season:1,number:1,sourceUrl:item.sourceUrl,offerings:item.offerings}];item.episodeCount=1;item.episodesComplete=true;}
   else{
    const seasons=guide(id,html);if(!seasons.length||seasons.length>250)throw Error('StarDima season list missing or too large');
    const results=await pool(seasons,async season=>seasonEpisodes(id,season,JSON.parse(await read('/series/season/'+season.id+'?X-Requested-With=XMLHttpRequest',{json:true,fresh,deadline,signal}))),{signal,deadline}),errors=results.filter(x=>x.error);
    item.episodes=unique([...(errors.length?saved?.item.episodes||[]:[]),...results.flatMap(x=>x.value||[])]).sort((a,b)=>(a.season??Infinity)-(b.season??Infinity)||a.number-b.number);
    if(!item.episodes.length)throw Error('StarDima has no public episode entries');item.episodeCount=item.episodes.length;item.seasons=[...new Set(item.episodes.map(e=>e.season).filter(Number.isInteger))];item.episodesComplete=!errors.length;if(errors.length)item.providerErrors=errors.map(x=>({provider:'stardima',error:x.error}));
   }
   savedDetails.set(id,{at:Date.now(),item});if(savedDetails.size>8)savedDetails.delete(savedDetails.keys().next().value);return item;
  }catch(error){if(signal?.aborted)throw cancelled();if(saved?.item.episodes?.length)return {...saved.item,episodesComplete:false,providerErrors:[{provider:'stardima',error:error.message}]};throw error;}
 }
 function freeServers(html,expected){const doc=document(html);let data;try{data=JSON.parse(attr(doc,'[data-page]','data-page'));}catch{throw Error('Hyperwatching player format changed');}const props=data?.props;if(data?.component!=='Video/Embed'||props?.video?.hashid!==expected||!Array.isArray(props.video.servers))throw Error('Hyperwatching player identity mismatch');if(props.is_vip!==false)throw Error('Hyperwatching player is not publicly available');const seen=new Set();return props.video.servers.filter(s=>Number.isSafeInteger(s.id)&&s.id>0&&s.is_vip===false&&s.status==='completed'&&s.type==='iframe'&&!seen.has(s.id)&&seen.add(s.id)).map(s=>({id:s.id,name:String(s.name||'Player').replace(/[<>\r\n]/g,'').slice(0,60)}));}
 function serverChoice(data,choice,watch){
  if(data?.player!=='iframe'||typeof data.watch_url!=='string')return null;let u;try{u=new URL(data.watch_url);}catch{return null;}if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return null;
  const valid=(['uqload.vc','uqload.co','uqload.net'].includes(u.hostname)&&/^\/embed-[A-Za-z0-9]+\.html$/.test(u.pathname))||(['hgcloud.to','mixdrop.top','mixdrop.ag','lulustream.com','savefiles.com'].includes(u.hostname)&&/^\/e\/[A-Za-z0-9]+\/?$/.test(u.pathname));
  return valid?{id:'stardima:hyperwatching:'+choice.id,provider:'stardima',name:'StarDima - '+choice.name,type:'embed',embedUrl:u.href,sandbox:null,headers:{Referer:watch}}:null;
 }
 async function servers(id,{fresh=false,signal}={}){
  const p=parsed(id);if(!p||p.type==='s')return [];const deadline=Date.now()+15000;check(signal,deadline);
  // Recheck the selected episode's affirmative guest access before using links.
  const watch=p.type==='e'?episode(id,JSON.parse(await read('/series/episode/'+p.episodeId,{fresh:true,json:true,deadline,signal}))).player:filmPlayer(id,await read('/play/'+p.slug,{fresh,deadline,signal})),hash=playerId(watch);
  const choices=freeServers(await read(watch,{fresh,deadline,signal,referer:watch}),hash);if(choices.length>24)throw Error('Hyperwatching server inventory exceeds request limit');
  const results=await pool(choices,async choice=>serverChoice(JSON.parse(await read(HYPER+'/embed/'+hash+'/server/'+choice.id+'/url',{json:true,fresh,deadline,signal,referer:watch})),choice,watch),{signal,deadline});
  const seen=new Set(),rows=results.flatMap(result=>result.value?[result.value]:[]).filter(result=>!seen.has(result.embedUrl)&&seen.add(result.embedUrl));if(choices.length&&!rows.length)throw Error('Hyperwatching free servers are temporarily unavailable');return rows;
 }
 window.FlixerStardimaSource={enabled:()=>Boolean(http()),supports:id=>Boolean(parsed(id)&&http()),page,search,details,servers};
})();
