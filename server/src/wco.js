// Public catalogue pages and real episode identities. Media configuration is
// resolved in the Android publisher context, never proxied through Vercel.
import {load} from 'cheerio';
import {safeRemoteFetch} from './stream-security.js';
import {artworkUrl} from '../../shared/artwork.js';
import {matchesSearch} from '../../shared/search.js';
import {matchesCollection} from '../../shared/collections.js';

export const WCO_ORIGIN='https://www.wcostream.tv';
export const WCO_PROVIDERS={wco:{name:'Watch Cartoon Online',origin:WCO_ORIGIN,kind:'series',collections:['cartoons','classic-cartoons','anime','anime-sub','anime-dub']}};
const slug='[a-z0-9][a-z0-9-]{0,159}',cache=new Map();
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function parseWcoId(id){
 const m=new RegExp(`^sp:wco:([se]):(${slug})(?::(${slug}))?$`).exec(String(id));
 if(!m||(m[1]==='e')!==Boolean(m[3]))return null;
 return {provider:'wco',type:m[1],slug:m[2],episodeSlug:m[3]};
}
export function wcoUrl(id){const p=parseWcoId(id);return p?WCO_ORIGIN+(p.type==='s'?'/anime/':'/')+(p.episodeSlug||p.slug):null;}
function local(value){try{const u=new URL(value,WCO_ORIGIN);return u.origin===WCO_ORIGIN&&!u.username&&!u.password&&!u.hash?u:null;}catch{return null;}}
export function wcoIdFromUrl(value){
 const u=local(value);if(!u)return null;
 // Actual publisher breadcrumbs sometimes put the filter after a slash.
 const tail=/^\/anime\/([^/]+)\/(season=[^/]+)$/.exec(u.pathname);
 if(tail){if(u.search)return null;u.pathname='/anime/'+tail[1];u.search=tail[2];}
 const m=new RegExp(`^/anime/(${slug})/?$`).exec(u.pathname),keys=[...u.searchParams.keys()];
 if(!m||['movies','dubbed-anime','subbed-anime','cartoon','cartoons','ova'].includes(m[1])||new Set(keys).size!==keys.length||keys.some(k=>!['lang','season'].includes(k)))return null;
 if(u.searchParams.has('lang')&&!['sub','dub','cartoon'].includes(u.searchParams.get('lang')))return null;
 if(u.searchParams.has('season')&&!/^(?:all|\d+|s\d+-\d+)$/.test(u.searchParams.get('season')))return null;
 return 'sp:wco:s:'+m[1];
}
async function request(path,{fresh=false,method='GET',body}={}){
 const u=local(path);if(!u)throw Error('Invalid WCO source URL');
 const key=method+':'+u.href+':'+(body||''),old=cache.get(key);
 if(!fresh&&old&&Date.now()<old.expires)return old.promise;
 const entry={expires:Date.now()+120000,promise:(async()=>{
  const r=await safeRemoteFetch(u.href,{method,body,timeoutMs:8000,headers:{'User-Agent':'Flixer/1.6.19',Accept:'text/html',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})}});
  if(!r.ok){await r.body?.cancel();throw Error('WCO HTTP '+r.status);}
  if(new URL(r.url).origin!==WCO_ORIGIN){await r.body?.cancel();throw Error('WCO origin changed');}
  const html=await r.text();if(html.length>5000000||!html.trim())throw Error('WCO response unavailable');return html;
 })()};cache.set(key,entry);if(cache.size>150)cache.delete(cache.keys().next().value);
 try{return await entry.promise;}catch(e){if(cache.get(key)===entry)cache.delete(key);throw e;}
}
function base(id,title,mode='',poster){
 const anime=['dub','sub'].includes(mode),year=Number(/\(((?:19|20)\d{2})\)\s*$/.exec(title)?.[1])||null;
 return {id,title:clean(title),kind:'series',year,documentary:false,providerMetadata:true,channelId:'wco',sourceUrl:wcoUrl(id),access:'unverified',tags:['animation',...(anime?['anime']:mode==='cartoon'?['cartoons']:[])],collections:anime?['anime']:mode==='cartoon'?['cartoons']:[],audioModes:anime?[mode]:[],...(mode==='dub'?{audioLanguages:['en']}:mode==='sub'?{subtitleLanguages:['en']}:{ }),poster:poster?{custom:poster}:null,portrait:poster||null,episodes:[],episodeCount:0,offerings:[{provider:'wco',id,sourceUrl:wcoUrl(id)}]};
}
function coordinates(text,url){
 const s=/\bseason[ -]*(\d+)/i.exec(text+' '+url),e=/\bepisode[ -]*(\d+(?:\.\d+)?)/i.exec(text+' '+url);
 const ordinal=/\b(?:(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)[ -]+season|season[ -]+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth))\b/i.exec(text+' '+url);
 return {season:ordinal?['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'].indexOf((ordinal[1]||ordinal[2]).toLowerCase())+1:s?Number(s[1]):null,number:e?Number(e[1]):null};
}
function combine(a,b){a.audioModes=[...new Set([...a.audioModes,...b.audioModes])];a.collections=[...new Set([...a.collections,...b.collections])];return a;}
// WCO labels later seasons explicitly and lists a series' first season as plain
// "Episode N" entries. Only that evidence (later seasons present, no explicit
// season 1) assigns season 1; shorts, specials and arc-labelled entries keep
// source numbering. Mirrors inferFirstSeason in client-terrarium/js/wco-source.js.
export function inferFirstSeason(episodes,seriesSlug){
 const seasons=new Set(episodes.map(e=>e.season).filter(s=>s!==null));
 if(seasons.has(1)||![...seasons].some(s=>s>=2))return episodes;
 const plain=new RegExp(`^sp:wco:e:${seriesSlug}:${seriesSlug}-episode-\\d`);
 for(const e of episodes)if(e.season===null&&e.number!==null&&plain.test(e.id)&&/^episode[ -]*\d/i.test(e.title)){e.season=1;e.absoluteNumber=null;}
 return episodes;
}
export function parseWcoDirectory(html,{mode='',search=false}={}){
 const $=load(html),items=new Map(),anchors=search?$('.aramadabaslik a[href]'):$('#ddmcc_container .ddmcc a[href]');
 if(!anchors.length&&!/no (?:results|anime)|not found/i.test($('#content,#container').text()))throw Error('WCO directory format changed');
 anchors.each((_,n)=>{
  const a=$(n);if(a.closest('.pe-slider,.premium,.premium-releases').length)return;
  const u=local(a.attr('href')),id=u&&wcoIdFromUrl(u.href);if(!id)return;
  const title=clean(a.attr('title')||a.text());if(!title)return;
  const poster=artworkUrl(a.closest('.cerceve,.iccerceve').find('img').attr('src'),WCO_ORIGIN);
  const row=base(id,title,mode||u.searchParams.get('lang')||'',poster),old=items.get(id);
  items.set(id,old?combine(old,row):row);
 });return [...items.values()];
}
export function parseWcoDetails(id,html){
 const p=parseWcoId(id);if(!p||p.type!=='s')throw Error('Invalid WCO series');const $=load(html);
 const canonical=$('link[rel=canonical]').attr('href');if(canonical&&wcoIdFromUrl(canonical)!==id)throw Error('WCO series identity mismatch');
 const heading=clean($('.vsbaslik h2').first().text());if(!heading||!$('#episodeList').length)throw Error('WCO series format changed');
 const poster=artworkUrl($('#cat-img-desc img').first().attr('src'),WCO_ORIGIN),result=base(id,heading,'',poster);
 result.synopsis=clean($('#cat-img-desc .iltext').text());result.altTitles=[...new Set($('.film-name[data-jname]').toArray().map(n=>clean($(n).attr('data-jname'))).filter(t=>t&&t!==result.title))];
 const modes=new Set(),seen=new Set();
 $('#episodeList a.dark-episode-item[href]').each((_,n)=>{
  const a=$(n),u=local(a.attr('href')),m=u&&!u.search&&new RegExp(`^/(${slug})/?$`).exec(u.pathname),mode=a.attr('data-lang')||'';
  if(!m||seen.has(m[1])||a.hasClass('premium')||a.attr('data-premium')==='1'||/^Movie\s*:/i.test(clean(a.find('span').first().text())))return;
  const title=clean(a.find('span').first().text()),coords=coordinates(title,u.pathname),group=/^s(\d+)-\d+$/.exec(a.attr('data-season')||'');if(!title)return;
  // data-season groups mix arcs and specials under s1; only a season actually
  // named in the episode label/URL can establish cross-provider coordinates.
  seen.add(m[1]);modes.add(mode);const epId=`sp:wco:e:${p.slug}:${m[1]}`;
  const evidence={audioModes:['sub','dub'].includes(mode)?[mode]:[],...(mode==='dub'?{audioLanguages:['en']}:mode==='sub'?{subtitleLanguages:['en']}:{})};
  result.episodes.push({id:epId,title,...coords,...evidence,absoluteNumber:coords.season===null?coords.number:null,sourceUrl:wcoUrl(epId),offerings:[{provider:'wco',id:epId,...evidence}]});
 });
 const anime=modes.has('dub')||modes.has('sub');result.tags=['animation',anime?'anime':'cartoons'];result.collections=[anime?'anime':'cartoons'];result.audioModes=[...modes].filter(x=>['dub','sub'].includes(x));
 inferFirstSeason(result.episodes,p.slug);
 result.episodes.sort((a,b)=>(a.season??Number.MAX_SAFE_INTEGER)-(b.season??Number.MAX_SAFE_INTEGER)||(a.number??Number.MAX_SAFE_INTEGER)-(b.number??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id));
 result.episodeCount=result.episodes.length;result.episodesComplete=true;return result;
}
export function inspectWcoPlayer(id,html){
 const p=parseWcoId(id);if(!p||p.type!=='e')return null;const $=load(html);
 const canonical=$('link[rel=canonical]').attr('href');if(canonical&&local(canonical)?.href.replace(/\/$/,'')!==wcoUrl(id))return null;
 if($('.premium-required,.membership-required,.paywall').length)return {status:'restricted'};
 let u;try{u=new URL($('iframe#frameNewcizgifilmuploads0').first().attr('src'));}catch{return null;}
 if(u.origin!=='https://embed.wcostream.com'||u.pathname!=='/inc/embed/index.php'||!/^\d+$/.test(u.searchParams.get('pid')||'')||u.username||u.password)return null;
 // An iframe is only a candidate. Never persist signed player/media queries,
 // remove source limits or label catalogue access as verified playback.
 const title=clean($('.vsbaslik h2').first().text()||$('title').text().split('|')[0]);
 return {status:'unverified',pageUrl:wcoUrl(id),frameOrigin:u.origin,captureMedia:false,...(/English Subbed/i.test(title)?{audioMode:'sub'}:/English Dubbed/i.test(title)?{audioMode:'dub'}:{})};
}
export async function getWcoDetails(id,options={}){
 const p=parseWcoId(id);if(!p)throw Error('Invalid WCO ID');const parent=p.type==='e'?'sp:wco:s:'+p.slug:id;
 return parseWcoDetails(parent,await request(wcoUrl(parent),options));
}
export async function resolveWcoServers(id){
 const p=parseWcoId(id);if(!p||p.type!=='e')return [];
 // An actual media response must still be obtained on the device; this is a
 // resolver descriptor, never a verified stream or a stored signed URL.
 return [{id:'wco:public',provider:'wco',name:'Watch Cartoon Online',type:'wco',embedUrl:wcoUrl(id),captureMedia:false}];
}
export function parseWcoRecent(html){
 const $=load(html),seen=new Set();return $('#country1 .mansetlisteleme a[href]').toArray().flatMap(n=>{
  const a=$(n),u=local(a.attr('href')),title=clean(a.text());
  if(!u||u.search||!new RegExp(`^/(${slug})/?$`).test(u.pathname)||!(/\bepisode[ -]*\d/i.test(title))||seen.has(u.pathname))return [];
  seen.add(u.pathname);return [{title,url:u.href}];
 });
}
export function parseWcoRecentEpisode(html,url){
 const $=load(html),links=$('.ildate a[href]').toArray().map(n=>({id:wcoIdFromUrl($(n).attr('href')),title:clean($(n).text())})).filter(r=>r.id),source=local(url);
 if(links.length!==1||!source||source.search||!new RegExp(`^/(${slug})/?$`).test(source.pathname))throw Error('WCO recent episode identity unavailable');
 const parent=links[0],heading=clean($('title').text().split('|')[0]);if(!heading)throw Error('WCO episode title unavailable');
 const mode=/English Subbed/i.test(heading)?'sub':/English Dubbed/i.test(heading)?'dub':'';
 const row=base(parent.id,parent.title,mode),epId='sp:wco:e:'+parseWcoId(parent.id).slug+':'+source.pathname.replace(/^\/|\/$/g,''),coords=coordinates(heading,source.pathname);
 row.episodes=[{id:epId,title:heading,...coords,audioModes:row.audioModes,sourceUrl:source.href,offerings:[{provider:'wco',id:epId,audioModes:row.audioModes}]}];
 row.episodeCount=1;row.episodesComplete=false;row.latestEpisode=epId;
 return row;
}
export async function fetchWcoPage({page=1,search,kind='series',collection='',latest=false}={}){
 if(kind!=='series')return {items:[],page:1,totalPages:1,hasNext:false};
 const n=Math.max(1,Math.floor(Number(page)||1));let items=[];
 if(latest&&!search){
  const feed=parseWcoRecent(await request('/'));if(!feed.length)throw Error('WCO recent-release format changed');
  const slice=feed.slice((n-1)*6,n*6),results=[];let next=0;
  await Promise.all(Array.from({length:Math.min(3,slice.length)},async()=>{while(next<slice.length){const index=next++;const ep=slice[index];results[index]=parseWcoRecentEpisode(await request(ep.url),ep.url);}}));
  const merged=new Map();for(const row of results){const old=merged.get(row.id);if(old){combine(old,row);old.episodes.push(...row.episodes);old.episodeCount=old.episodes.length;}else merged.set(row.id,row);}
  items=[...merged.values()];if(collection)items=items.filter(r=>matchesCollection(r,collection));
  return {items,page:n,totalPages:Math.ceil(feed.length/6),hasNext:n*6<feed.length};
 }
 if(search)items=parseWcoDirectory(await request('/search',{method:'POST',body:new URLSearchParams({catara:String(search).slice(0,80),konuara:'series'}).toString()}),{search:true});
 else{
  const lanes=collection==='anime-sub'?['sub']:collection==='anime-dub'?['dub']:collection==='anime'?['dub','sub']:['cartoons','classic-cartoons'].includes(collection)?['cartoon']:['cartoon','dub','sub'];
  const results=await Promise.allSettled(lanes.map(async mode=>parseWcoDirectory(await request(mode==='cartoon'?'/cartoon-list':mode==='dub'?'/dubbed-anime-list':'/subbed-anime-list'),{mode})));
  if(results.every(r=>r.status==='rejected'))throw Error('WCO directories unavailable');
  const merged=new Map();for(const row of results.flatMap(r=>r.status==='fulfilled'?r.value:[])){const old=merged.get(row.id);merged.set(row.id,old?combine(old,row):row);}items=[...merged.values()];
  if(results.some(r=>r.status==='rejected'))throw Error('WCO directory coverage incomplete');
 }
 if(search)items=items.filter(r=>matchesSearch([r.title,...(r.altTitles||[])].join(' '),search));
 if(collection)items=items.filter(r=>matchesCollection(r,collection));
 items.sort((a,b)=>a.id.localeCompare(b.id));
 return {items:items.slice((n-1)*48,n*48),page:n,totalPages:Math.ceil(items.length/48),hasNext:n*48<items.length};
}
