import {load} from 'cheerio';
import {safeRemoteFetch} from './stream-security.js';
import {artworkUrl} from '../../shared/artwork.js';
import {runtimeProviderSnapshot} from './runtime-source.js';
import {resolveHyperwatchingServers} from './hyperwatching.js';

export const STARDIMA_ORIGIN='https://www.stardima.com';
export const STARDIMA_PROVIDERS={stardima:{name:'StarDima',origin:STARDIMA_ORIGIN,kind:null,collections:['arabic','cartoons','classic-cartoons','anime','anime-sub','anime-dub']}};
const slugPattern='(?:[a-f0-9]{13}|video-[1-9][0-9]{0,9})';
const idPattern=new RegExp(`^sp:stardima:([mse]):(${slugPattern})(?::([1-9][0-9]{0,11}))?$`);
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const integer=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const flag=value=>value===true||value===1||value==='1'||value==='true';
const locked=value=>flag(value?.is_exclusive)||flag(value?.is_premium)||flag(value?.premium)||value?.is_free===false||value?.is_free===0||value?.can_watch===false;
const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];

export function parseStardimaId(value){const m=idPattern.exec(String(value));return m&&((m[1]==='e')===!!m[3])?{provider:'stardima',type:m[1],slug:m[2],...(m[3]?{episodeId:Number(m[3])}:{})}:null;}
export function stardimaUrl(value){const p=parseStardimaId(value);return p?`${STARDIMA_ORIGIN}/${p.type==='m'?'movie':'tvshow'}/${p.slug}${p.type==='e'?'/play/'+p.episodeId:''}`:null;}
export function stardimaIdFromUrl(value){try{const u=new URL(value,STARDIMA_ORIGIN);if(u.origin!==STARDIMA_ORIGIN||u.username||u.password||u.port||u.search||u.hash)return null;const m=new RegExp(`^/(movie|tvshow|play)/(${slugPattern})(?:/play/([1-9][0-9]{0,11}))?/?$`).exec(u.pathname);if(!m||m[3]&&m[1]!=='tvshow')return null;const id=`sp:stardima:${m[3]?'e':m[1]==='tvshow'?'s':'m'}:${m[2]}${m[3]?':'+m[3]:''}`;return parseStardimaId(id)?id:null;}catch{return null;}}
function sourceUrl(value){const u=new URL(value,STARDIMA_ORIGIN);if(u.origin!==STARDIMA_ORIGIN||u.username||u.password||u.port||u.hash)throw Error('Invalid StarDima destination');return u;}
function poster(value){if(!value)return null;return artworkUrl(/^https?:|^\//.test(value)?value:'/storage/'+value,STARDIMA_ORIGIN);}
export function stardimaPlayerUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='v2.hyperwatching.com'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/watch\/[A-Za-z0-9]{6,64}$/.test(u.pathname)?u.href:null;}catch{return null;}}
function languages(value){const label=clean(value);return /مدبلج/.test(label)?{audioLanguages:['ar'],audioModes:['dub']}:/مترجم/.test(label)?{subtitleLanguages:['ar'],audioModes:['sub']}:{};}
function row(id,title,image){const p=parseStardimaId(id),portrait=poster(image);return {id,title:clean(title),kind:p.type==='m'?'film':'series',year:null,altTitles:[],portrait,poster:portrait?{custom:portrait}:null,sourceUrl:stardimaUrl(id),channelId:'stardima',collections:['arabic'],tags:[],providerMetadata:true,documentary:false,access:'public',episodes:[],episodeCount:0,offerings:[{provider:'stardima',id,sourceUrl:stardimaUrl(id),availability:'unverified'}]};}
const categories={anime:'anmy','anime-sub':'anmy','anime-dub':'anmy',cartoons:'krton','classic-cartoons':'krton-zman'};
function classify(item,collection){if(['anime','anime-sub','anime-dub'].includes(collection)){item.tags.push('animation','anime');item.collections.push('anime');}if(['cartoons','classic-cartoons'].includes(collection)){item.tags.push('animation');item.collections.push(collection);}return item;}

// Anonymous website endpoints only. APK authentication material is never used.
const cache=new Map();
async function request(path,{fresh=false,json=false,timeoutMs=7000}={}){
  const url=sourceUrl(path),key=url.href+'|'+json,old=cache.get(key);
  if(!fresh&&old&&Date.now()-old.at<120000)return old.promise;
  const promise=(async()=>{const response=await safeRemoteFetch(url.href,{timeoutMs:Math.max(1,Math.min(7000,timeoutMs)),redirects:0,headers:{'User-Agent':'Mozilla/5.0',Accept:json?'application/json':'text/html',...(json?{'X-Requested-With':'XMLHttpRequest'}:{})}});
    if(!response.ok){await response.body?.cancel();throw Error(`StarDima HTTP ${response.status}; cached data retained`);}
    const parts=[];let size=0;const reader=response.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw Error('StarDima response too large');parts.push(value);}}finally{await reader.cancel();}
    const text=Buffer.concat(parts).toString('utf8');if(/<title[^>]*>\s*(?:Just a moment|Access denied)/i.test(text))throw Error('StarDima browser verification required');return text;
  })();cache.set(key,{at:Date.now(),promise});if(cache.size>80)cache.delete(cache.keys().next().value);
  try{return await promise;}catch(error){if(cache.get(key)?.promise===promise)cache.delete(key);throw error;}
}
export function parseStardimaList(input,{page=1,kind,collection='',freeFiltered=false}={}){
  if(!freeFiltered)throw Error('StarDima catalogue requires the public free-content filter');
  let data=input;if(typeof data==='string')try{data=JSON.parse(data);}catch{data=null;}
  let records,pagination;
  if(data&&Array.isArray(data.videos)&&data.pagination){records=data.videos;pagination=data.pagination;}
  else if(typeof input==='string'){
    const $=load(input),grid=$('#video-grid');if(!grid.length)throw Error('StarDima listing format changed');
    records=grid.find('a[href]').toArray().flatMap(e=>{const a=$(e),id=stardimaIdFromUrl(a.attr('href')),p=parseStardimaId(id),card=a.closest('div.flex.flex-col');return p&&p.type!=='e'?[{url:a.attr('href'),title:a.find('h3').text()||card.find('h4').text(),description:a.find('p').first().text(),poster_url:card.find('img').first().attr('src'),year:/\b(?:19|20)\d{2}\b/.exec(a.text())?.[0],video_quality:card.children('div').last().find('p').text(),is_series:p.type==='s',is_exclusive:card.find('[title*="حصري"],.fa-crown').length>0}]:[];});
    pagination={current_page:page,last_page:Number(grid.attr('data-last-page'))||page};
  }else throw Error('StarDima listing format changed');
  const current=integer(pagination.current_page),last=integer(pagination.last_page);
  if(current!==page||!last||last<page||last>10000||records.length>100)throw Error('Invalid StarDima catalogue pagination');
  const items=unique(records.flatMap(record=>{const id=stardimaIdFromUrl(record.url),p=parseStardimaId(id);if(!p||p.type==='e'||locked(record)||!clean(record.title)||(record.is_series===true)!==(p.type==='s'))return [];const item=row(id,record.title,record.poster_url);if(kind&&item.kind!==kind)return [];item.year=Number(/^(?:19|20)\d{2}$/.exec(String(record.year))?.[0])||null;item.synopsis=clean(record.description);if(integer(record.id))item.sourceRecordId=Number(record.id);Object.assign(item,languages(record.video_quality));return [classify(item,collection)];}));
  // Dropped malformed records must not silently complete a historical traversal.
  const malformed=records.some(record=>{const p=parseStardimaId(stardimaIdFromUrl(record?.url));return !p||p.type==='e'||!clean(record?.title)||typeof record.is_series!=='boolean'||record.is_series!==(p.type==='s');});
  return {items,page,totalPages:last,hasNext:page<last,...(malformed?{partial:true,providerErrors:[{provider:'stardima',error:'Some source records were malformed; page must be retried'}]}:{})};
}

function titleContext(id,html){
  const p=parseStardimaId(id);if(!p||p.type==='e')throw Error('Invalid StarDima title');const $=load(html);
  const canonical=$('meta[property="og:url"]').attr('content')||$('link[rel="canonical"]').attr('href');if(canonical&&stardimaIdFromUrl(canonical)!==id)throw Error('StarDima title identity mismatch');
  const hero=$('section').filter((_,e)=>$(e).find('h1').length||$(e).find('img[alt$=" Logo"]').length).first(),title=clean(hero.find('h1').last().text())||clean(hero.find('img[alt$=" Logo"]').attr('alt')).replace(/ Logo$/,'');
  if(!title)throw Error('StarDima title missing');const item=row(id,title,$('meta[property="og:image"]').attr('content'));
  // The source explicitly publishes Arabic/Latin alternative names in <title>.
  // Do not infer aliases from poster filenames or the authenticated APK API.
  const names=clean($('title').first().text()).split('|');
  if(names.length>1)item.altTitles=[...new Set(names.map(name=>clean(name).replace(/\s*-\s*(?:ستارديما|stardima)\s*$/i,'').trim()).filter(name=>name&&name!==title&&name.length<=200))];
  item.synopsis=clean(hero.find('p').first().text());item.year=Number(/\b(?:19|20)\d{2}\b/.exec(hero.find('.info-item').text())?.[0])||null;
  Object.assign(item,languages(hero.find('.info-item').text()+' '+hero.find('span').text()));item.sourceRecordId=integer(hero.find('[data-video-id]').first().attr('data-video-id'));
  const genreLinks=hero.find('a[href*="/search/"]').toArray().map(e=>{try{return decodeURIComponent(new URL($(e).attr('href')).pathname.split('/').pop());}catch{return '';}});
  for(const [collection,slug]of Object.entries(categories))if(genreLinks.includes(slug))classify(item,collection);
  item.tags=[...new Set(item.tags)];item.collections=[...new Set(item.collections)];
  const play=hero.find('a[href]').map((_,e)=>$(e).attr('href')).get().find(value=>{const ep=parseStardimaId(stardimaIdFromUrl(value));return ep&&ep.slug===p.slug&&(p.type==='m'?ep.type==='m'&&new URL(value).pathname.startsWith('/play/'):ep.type==='e');});
  if(!play)throw Error('StarDima title has no public watch link');return {item,play};
}
export function parseStardimaGuide(html,slug){const $=load(html),seasons=[];const canonical=$('meta[property="og:url"]').attr('content')||$('link[rel="canonical"]').attr('href');if(canonical&&parseStardimaId(stardimaIdFromUrl(canonical))?.slug!==slug)throw Error('StarDima episode guide identity mismatch');$('.season-item[data-season-id]').each((_,e)=>{const id=integer($(e).attr('data-season-id')),label=clean($(e).attr('data-season-number')),m=/^(\d{1,3})$/.exec(label)||/(?:^|[\s._-])S(\d{1,3})(?:$|\s)/i.exec(label);if(id)seasons.push({id,label,...(m?{number:Number(m[1])}:{})});});const initial=integer($('#episodes-list-container').attr('data-initial-episode-id'));return {seasons:[...new Map(seasons.map(s=>[s.id,s])).values()],initialEpisodeId:initial};}
export function parseStardimaEpisode(id,data){
  const p=parseStardimaId(id),ep=data?.episode;if(!p||p.type!=='e'||integer(ep?.id)!==p.episodeId||data?.series?.slug!==p.slug)throw Error('StarDima episode identity mismatch');
  if(ep.can_watch!==true||locked(ep)||ep.reason)throw Error('StarDima episode requires source access or subscription');
  const url=stardimaPlayerUrl(ep.watch_url),number=integer(ep.episode_number),season=data.season?.number==null?NaN:Number(data.season.number);
  if(!url||!number)throw Error('StarDima episode has no supported public player');
  const episode={id,title:clean(ep.title)||`Episode ${number}`,number,...(Number.isInteger(season)&&season>=0&&season<1000?{season}:{}),sourceUrl:stardimaUrl(id),offerings:[{provider:'stardima',id,sourceUrl:stardimaUrl(id)}],access:'public'};
  return {episode,player:url,title:clean(data.series.title)};
}
export function parseStardimaSeason(id,season,data){
  const p=parseStardimaId(id);if(!p||p.type!=='s'||!Array.isArray(data?.episodes)||data.episodes.length>15000)throw Error('StarDima season format changed');
  if(data.series_id&&data.series_id!==p.slug)throw Error('StarDima season identity mismatch');
  return unique(data.episodes.flatMap(ep=>{const eid=integer(ep.id),number=integer(ep.episode_number);if(!eid||!number||locked(ep)||!stardimaPlayerUrl(ep.watch_url))return [];const episodeId=`sp:stardima:e:${p.slug}:${eid}`;return [{id:episodeId,title:clean(ep.title)||`Episode ${number}`,number,...(Number.isInteger(season.number)?{season:season.number}:{}),sourceSeasonId:season.id,sourceSeasonLabel:season.label,sourceUrl:stardimaUrl(episodeId),offerings:[{provider:'stardima',id:episodeId,sourceUrl:stardimaUrl(episodeId)}]}];}));
}
export function parseStardimaFilmPlayer(id,html){const p=parseStardimaId(id);if(!p||p.type!=='m')throw Error('Invalid StarDima film');const $=load(html),canonical=$('meta[property="og:url"]').attr('content');if(canonical&&stardimaIdFromUrl(canonical)!==id)throw Error('StarDima film identity mismatch');const player=$('#video-player-container');if(!player.length)throw Error('StarDima film player missing');const url=stardimaPlayerUrl(player.find('iframe[src]').first().attr('src'));if(!url||/VIP|تسجيل الدخول|حصري/.test(player.text()))throw Error('StarDima film has no free public player');return url;}
async function pool(items,fn,concurrency=3){const results=[];let next=0;await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(next<items.length){const i=next++;try{results[i]={value:await fn(items[i])};}catch(error){results[i]={error:error.message};}}}));return results;}

export async function getStardimaDetails(id,{fresh=false,read=request,readSnapshot=runtimeProviderSnapshot}={}){
  const p=parseStardimaId(id);if(!p||p.type==='e')throw Error('Invalid StarDima title');const saved=await Promise.resolve(readSnapshot(id)).catch(()=>null);if(!fresh&&saved?.id===id&&saved.episodes?.length)return saved;
  const deadline=Date.now()+18000,bounded=(path,options={})=>{if(Date.now()>=deadline)throw Error('StarDima guide refresh time budget reached');return read(path,{fresh,...options,timeoutMs:Math.min(7000,deadline-Date.now())});};
  try{
    const {item,play}=titleContext(id,await bounded(stardimaUrl(id))),html=await bounded(play),$=load(html);
    const originalLanguage=clean($('span').filter((_,e)=>clean($(e).text())==='اللغة').first().next('span').text());
    if(/^[a-z]{2,3}$/.test(originalLanguage))item.originalLanguage=originalLanguage;
    if(p.type==='m'){parseStardimaFilmPlayer(id,html);item.episodes=[{id,title:item.title,season:1,number:1,sourceUrl:item.sourceUrl,offerings:item.offerings}];item.episodeCount=1;item.episodesComplete=true;return item;}
    const guide=parseStardimaGuide(html,p.slug);if(!guide.seasons.length||guide.seasons.length>250)throw Error('StarDima season list missing or too large');
    const responses=await pool(guide.seasons,async season=>parseStardimaSeason(id,season,JSON.parse(await bounded(`/series/season/${season.id}?X-Requested-With=XMLHttpRequest`,{json:true}))));
    const errors=responses.filter(x=>x.error).map(x=>({provider:'stardima',error:x.error}));
    item.episodes=unique([...(errors.length?saved?.episodes||[]:[]),...responses.flatMap(x=>x.value||[])]).sort((a,b)=>(a.season??Infinity)-(b.season??Infinity)||a.number-b.number);
    if(!item.episodes.length)throw Error('StarDima has no public episode entries');item.episodeCount=item.episodes.length;item.seasons=[...new Set(item.episodes.map(e=>e.season).filter(Number.isInteger))];item.episodesComplete=!errors.length;if(errors.length)item.providerErrors=errors;return item;
  }catch(error){if(saved?.id===id&&saved.episodes?.length)return {...saved,episodesComplete:false,providerErrors:[{provider:'stardima',error:error.message}]};throw error;}
}

export function parseStardimaLatest(html){const $=load(html),entries=[];if(!$('#timeline-container').length)throw Error('StarDima latest feed format changed');$('#timeline-container [data-content="episodes"] a[href]').each((_,e)=>{const a=$(e),id=stardimaIdFromUrl(a.attr('href')),p=parseStardimaId(id);if(!p||p.type!=='e')return;const card=a.closest('div.flex.flex-col'),title=clean(a.find('h3').text()).replace(/\s*-\s*حلقة\s*\d+\s*$/,'');const item=row(`sp:stardima:s:${p.slug}`,title,card.find('img').first().attr('src'));item.year=Number(/\b(?:19|20)\d{2}\b/.exec(a.find('span').text())?.[0])||null;Object.assign(item,languages(card.children('div').last().find('p').text()));entries.push({item,episodeId:id});});const newest=new Map();for(const entry of entries)if(!newest.has(entry.item.id))newest.set(entry.item.id,entry);return [...newest.values()];}
export async function fetchStardimaPage({kind='series',page=1,search,collection='',latest=false,fresh=false,read=request,budgetMs=12000}={}){
  if(!Number.isInteger(page)||page<1||page>10000)throw Error('Invalid StarDima page');
  if(latest&&!search&&kind==='series'&&(!collection||collection==='arabic')){
    const deadline=Date.now()+Math.min(15000,Math.max(1,Number(budgetMs)||12000));
    const bounded=async(path,options={})=>{const remaining=deadline-Date.now();if(remaining<=0)throw Error('StarDima latest refresh time budget reached');let timer;
      try{return await Promise.race([Promise.resolve().then(()=>read(path,{fresh,...options,timeoutMs:Math.min(7000,remaining)})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('StarDima latest refresh time budget reached')),remaining);})]);}finally{clearTimeout(timer);}};
    const entries=parseStardimaLatest(await bounded('/newrelases')),selected=entries.slice((page-1)*12,page*12);
    const results=await pool(selected,async entry=>{const data=JSON.parse(await bounded('/series/episode/'+parseStardimaId(entry.episodeId).episodeId,{json:true}));const parsed=parseStardimaEpisode(entry.episodeId,data);return {...entry.item,title:parsed.title||entry.item.title,episodes:[parsed.episode],episodeCount:1,episodesComplete:false,latestEpisode:parsed.episode.id};});
    const errors=results.filter(x=>x.error&&!/requires source access|no supported public player/.test(x.error));return {items:results.flatMap(x=>x.value?[x.value]:[]),page,totalPages:Math.max(1,Math.ceil(entries.length/12)),hasNext:page*12<entries.length,...(errors.length?{partial:true,providerErrors:errors.map(x=>({provider:'stardima',error:x.error}))}:{})};
  }
  const params=new URLSearchParams({premium:'free',page:String(page)});if(search)params.set('query',clean(search).slice(0,200));if(categories[collection])params.set('category',categories[collection]);if(collection==='anime-dub')params.set('language','dub');if(collection==='anime-sub')params.set('language','sub');
  const path=(search?'/search':kind==='film'?'/aflam':'/mosalsalat')+'?'+params;
  return parseStardimaList(await read(path,{fresh,json:true}),{page,kind:search?undefined:kind,collection,freeFiltered:true});
}
export async function resolveStardimaServers(id,{fresh=false,read=request,resolvePlayers=resolveHyperwatchingServers}={}){
  const p=parseStardimaId(id);if(!p||p.type==='s')return [];
  const player=p.type==='e'?parseStardimaEpisode(id,JSON.parse(await read('/series/episode/'+p.episodeId,{fresh:true,json:true}))).player:parseStardimaFilmPlayer(id,await read('/play/'+p.slug,{fresh}));
  return resolvePlayers(player,{fresh});
}
