import { load } from 'cheerio';
import { HDTODAY_PLAYER_ROUTES } from '../../shared/hdtoday-player-routes.js';
import { safeRemoteFetch } from './stream-security.js';
import { text } from './fmovies.js';

export const HDTODAY_BASE = 'https://hdtoday.sx';
const slugPattern = /^(movie|tv)-[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function parseHdtodayId(id) {
  const m = /^hd:([ms]):([a-z0-9]+(?:-[a-z0-9]+)*)(?::(\d+):([1-9]\d*))?$/.exec(String(id));
  if (!m || !slugPattern.test(m[2]) || (m[1] === 'm') !== m[2].startsWith('movie-')) return null;
  if(m[3]!=null&&(m[1]==='m'||!Number.isSafeInteger(Number(m[3]))||!Number.isSafeInteger(Number(m[4]))))return null;
  return {id,kind:m[1] === 'm' ? 'film':'series',slug:m[2],season:m[3] == null ? null:Number(m[3]),number:m[4] == null ? null:Number(m[4])};
}
const tag = label => ({'Science Fiction':'sci-fi','Sci-Fi & Fantasy':'sci-fi','Action & Adventure':'action','War & Politics':'war'}[label] || label.toLowerCase().replace(/[^a-z0-9]+/g,'-'));
function record({slug,title,year,poster,tags=[],tmdbId,synopsis='',lang=null}) {
  const kind = slug.startsWith('movie-') ? 'film':'series';
  const id = `hd:${kind === 'film'?'m':'s'}:${slug}`;
  const sourceUrl = `${HDTODAY_BASE}/watch/${slug}`;
  const documentary = tags.includes('documentary');
  const item = {id,kind,title:title.replace(/\s+-\s+Season\s+\d+$/i,''),year:year || null,tmdbId:tmdbId || null,lang,contentLang:lang,sourceUrl,synopsis,tags,documentary,
    channelId:'hdtoday',poster:poster?{custom:poster}:null,portrait:poster || null,providerMetadata:true,episodes:[],episodeCount:0,seasons:[],altTitles:[],totalDurationSec:null,totalViews:null,
    offerings:[{provider:'hdtoday',id,slug,kind,sourceUrl,documentary}]};
  if (kind === 'film') { item.episodes=[{id,title:item.title,season:1,number:1,sourceUrl,offerings:item.offerings,thumbs:item.poster}]; item.episodeCount=1; }
  return item;
}
export function parseHdtodayList(html, {kind,documentary=false,page=1} = {}) {
  if (/<title>\s*Quick check/i.test(html) || /<title>[^<]*(?:Just a moment|Access denied)/i.test(html)) throw new Error('HDToday requires browser verification; cached data retained');
  const items = new Map();
  for (const m of html.matchAll(/<a\b([^>]*class="bf-card"[^>]*)>([\s\S]*?)<\/a>/g)) {
    const slug = /href="\/watch\/([^"?#/]+)/.exec(m[1])?.[1];
    if (!slug || !slugPattern.test(slug)) continue;
    const full = text(/title="([^"]+)"/.exec(m[1])?.[1] || /class="bf-card__name"[^>]*>([^<]+)/.exec(m[2])?.[1]);
    const year = Number(/\((\d{4})\)$/.exec(full)?.[1]) || null;
    let title = full.replace(/\s*\(\d{4}\)$/,'');
    if (/\.\.$/.test(title)) title=slug.replace(/^(movie|tv)-/,'').replace(/-[a-z0-9]{8}$/,'').replace(/-/g,' ');
    const tags = text(/class="bf-card__genre"[^>]*>([^<]*)/.exec(m[2])?.[1]).split(/,\s*/).filter(Boolean).map(tag);
    // The actual card genres must confirm documentary membership; the route alone is insufficient.
    if (documentary && !tags.includes('documentary')) continue;
    const poster = /<img[^>]*src="(https:\/\/image\.tmdb\.org\/[^" ]+)"/.exec(m[2])?.[1];
    const item=record({slug,title,year,poster,tags});
    const slot=/<b>S(\d+)\s+E(\d+)<\/b>/.exec(m[2]);
    if(item.kind==='series' && slot) {
      const season=Number(slot[1]),number=Number(slot[2]),id=`${item.id}:${season}:${number}`;
      item.episodes=[{id,title:`Episode ${number}`,season,number,sourceUrl:`${item.sourceUrl}?s=${season}&e=${number}`,offerings:[{...item.offerings[0],id,season,number}]}];
      item.episodeCount=1;item.seasons=[season];item.latestEpisode=`${season}:${number}`;
    }
    const age=/\b(\d+)\s*(h|days?|minutes?)\s+ago\b/.exec(text(m[2]));
    if(age)item.providerUpdatedAt=new Date(Date.now()-Number(age[1])*({h:3600000,day:86400000,days:86400000,minute:60000,minutes:60000}[age[2]])).toISOString();
    else if(/\byesterday\b/.test(text(m[2])))item.providerUpdatedAt=new Date(Date.now()-86400000).toISOString();
    if (!kind || item.kind===kind) items.set(item.id,item);
  }
  const links=[...html.matchAll(/<a\b([^>]*href="[^"]*[?&](?:amp;)?page=(\d+)[^"]*"[^>]*)>/g)];
  const last=links.filter(m=>/rel="last"/.test(m[1])).map(m=>Number(m[2]));
  const next=links.filter(m=>/rel="next"/.test(m[1])).map(m=>Number(m[2]));
  if (!items.size && !/class="bf-card"/.test(html) && !/no (?:movies|results|series|titles)|nothing found/i.test(text(html))) throw new Error('HDToday listing format changed');
  return {items:[...items.values()],page,totalPages:Math.max(page,...last,...next),hasNext:next.length>0};
}
export function createHdtodayRequest({fetchRemote=safeRemoteFetch,now=Date.now}={}) {
  let retryAt=0,blockedReason=null;
  const contexts=new Map(),pending=new Map();
  function challenge() {
    retryAt=now()+600000;
    blockedReason='HDToday browser verification required on this host; cached data retained';
    return new Error(blockedReason);
  }
  async function read(url,timeoutMs,referer=HDTODAY_BASE+'/home') {
    if(now()<retryAt)throw new Error(blockedReason);
    const deadline=Date.now()+timeoutMs;
    let current=url;
    for(let hop=0;hop<=3;hop++) {
      const remaining=deadline-Date.now();
      if(remaining<=0)throw new Error('HDToday source refresh time budget reached');
      // The shared transport gives every automatic redirect a new timeout.
      // Handle source redirects here so all hops share this one deadline.
      const r=await fetchRemote(current.href,{timeoutMs:remaining,manualRedirect:true,headers:{'User-Agent':'Mozilla/5.0','Referer':referer,'Accept':'text/html,application/json;q=0.9,*/*;q=0.8'}});
      if(Date.now()>=deadline){await r.body?.cancel();throw new Error('HDToday source refresh time budget reached');}
      if(r.headers.get('cf-mitigated')==='challenge'){
        await r.body?.cancel();throw challenge();
      }
      if([301,302,303,307,308].includes(r.status)&&r.headers.get('location')){
        await r.body?.cancel();
        const next=new URL(r.headers.get('location'),current);
        if(next.protocol!=='https:'||next.username||next.password||next.port||next.origin!==url.origin)throw new Error('Invalid HDToday source redirect');
        if(hop===3)throw new Error('Too many HDToday source redirects');
        current=next;
        continue;
      }
      if(!r.ok){
        if(r.status===429){retryAt=now()+Math.max(60,Number(r.headers.get('retry-after'))||60)*1000;blockedReason='HDToday rate limited; cached data retained until retry';}
        await r.body?.cancel();throw new Error(`HDToday HTTP ${r.status}`);
      }
      const html=await r.text();
      if(Date.now()>=deadline)throw new Error('HDToday source refresh time budget reached');
      if(/<title[^>]*>\s*(?:Quick check|Just a quick check|Just a moment|Access denied)/i.test(html))throw challenge();
      return {html,url:new URL(r.url||current.href)};
    }
  }
  async function titlePage(url,timeoutMs) {
    const deadline=Date.now()+timeoutMs;
    const readPage=(next,referer)=>{
      const remaining=deadline-Date.now();
      if(remaining<=0)throw new Error('HDToday source refresh time budget reached');
      return read(next,remaining,referer);
    };
    let page=await readPage(url);
    const $=load(page.html),migration=$('a.dummy-go__btn[href]').attr('href');
    if(migration){
      const hop=new URL(migration,url);
      const destination=new URL(hop.searchParams.get('to')||'',HDTODAY_BASE);
      if(hop.origin!==HDTODAY_BASE||hop.pathname!=='/home-v1'||destination.origin!==HDTODAY_BASE||destination.pathname!==url.pathname)throw new Error('Invalid HDToday migration');
      // Follow only the publisher's explicit migration link. Do not try other
      // mirrors or manufacture verification cookies if its page challenges.
      const landing=await readPage(hop,url.href),link=load(landing.html)('a[href]').first().attr('href');
      if(!link)throw new Error('HDToday migration destination unavailable');
      const handoff=new URL(link);
      const target=new URL(handoff.searchParams.get('to')||'',HDTODAY_BASE);
      if(handoff.protocol!=='https:'||handoff.username||handoff.password||handoff.port||!/^flix[a-z0-9-]+\.cyou$/.test(handoff.hostname)||handoff.pathname!=='/__handoff'||target.origin!==HDTODAY_BASE||target.pathname!==url.pathname)throw new Error('Invalid HDToday migration destination');
      page=await readPage(handoff,hop.href);
      if(page.url.origin!==handoff.origin||page.url.pathname!==url.pathname)throw new Error('Invalid HDToday migrated title');
    }
    const doc=load(page.html),choices=[];
    doc('#opt-list button[name="x"]').each((_,node)=>{
      const button=doc(node),index=button.attr('value'),name=button.text().replace(/\s+/g,' ').trim();
      if(/^\d{1,3}$/.test(index||'')&&name&&!choices.some(c=>c.index===Number(index)))choices.push({index:Number(index),name});
    });
    if(choices.length) {
      contexts.set(url.pathname,{at:now(),origin:page.url.origin,choices});
      if(contexts.size>300)contexts.delete(contexts.keys().next().value);
    }else contexts.delete(url.pathname);
    return page.html;
  }
  async function prepare(url,timeoutMs) {
    if(pending.has(url.pathname))return pending.get(url.pathname);
    const promise=titlePage(url,timeoutMs);
    pending.set(url.pathname,promise);
    try{return await promise;}finally{pending.delete(url.pathname);}
  }
  async function request(path,{timeoutMs=12000}={}) {
    const deadline=Date.now()+timeoutMs;
    if(now()<retryAt)throw new Error(blockedReason);
    const url=new URL(path,HDTODAY_BASE);
    if(url.origin!==HDTODAY_BASE||url.username||url.password)throw new Error('Invalid HDToday URL');
    if(/^\/watch\/(movie|tv)-[a-z0-9-]+$/.test(url.pathname))return prepare(url,timeoutMs);
    if(url.pathname==='/api/go') {
      const slug=url.searchParams.get('slug');
      if(!slugPattern.test(slug||''))throw new Error('Invalid HDToday player');
      const watch=new URL(`/watch/${slug}`,HDTODAY_BASE);
      for(const key of ['s','e'])if(url.searchParams.has(key))watch.searchParams.set(key,url.searchParams.get(key));
      let context=contexts.get(watch.pathname);
      if(!context||now()-context.at>=600000){await prepare(watch,timeoutMs);context=contexts.get(watch.pathname);}
      if(context){
        if(!context.choices.some(c=>c.index===Number(url.searchParams.get('x'))))throw new Error('HDToday server no longer listed');
        const remaining=deadline-Date.now();
        if(remaining<=0)throw new Error('HDToday source refresh time budget reached');
        return (await read(new URL(url.pathname+url.search,context.origin),remaining,new URL(watch.pathname+watch.search,context.origin).href)).html;
      }
    }
    const remaining=deadline-Date.now();
    if(remaining<=0)throw new Error('HDToday source refresh time budget reached');
    return (await read(url,remaining)).html;
  }
  request.playerChoices=async(id,{timeoutMs=5000,fresh=false}={})=>{
    const parsed=parseHdtodayId(id);
    if(!parsed||(parsed.kind==='series'&&parsed.season==null))return [];
    const path=`/watch/${parsed.slug}`,url=new URL(path,HDTODAY_BASE);
    if(parsed.kind==='series'){url.searchParams.set('s',String(parsed.season));url.searchParams.set('e',String(parsed.number));}
    let context=contexts.get(path);
    if(fresh||!context||now()-context.at>=600000){await prepare(url,timeoutMs);context=contexts.get(path);}
    if(!context)return [];
    return context.choices.map(({index,name})=>{
      const params=new URLSearchParams({t:parsed.kind==='film'?'movie':'tv',slug:parsed.slug,x:String(index)});
      if(parsed.kind==='series'){params.set('s',String(parsed.season));params.set('e',String(parsed.number));}
      return {id:`hdtoday:${index}`,name:`HDToday · ${name}`,provider:'hdtoday',type:'embed',embedUrl:`${HDTODAY_BASE}/api/go?${params}`,sourceUrl:`${context.origin}/api/go?${params}`,availability:'unverified'};
    });
  };
  return request;
}
const request=createHdtodayRequest();
export async function fetchHdtodayPage({kind='film',documentary=false,page=1,latest=false,genre}={}) {
  if(genre && !/^[a-z-]+$/.test(genre))throw new Error('Invalid HDToday genre');
  const slug=genre==='sci-fi'?(kind==='film'?'science-fiction':'sci-fi-fantasy'):genre;
  const route=latest&&kind==='series'?'/new-episodes':documentary?'/genre/documentary':slug?`/genre/${slug}`:kind==='film'?'/movie':'/tv';
  return parseHdtodayList(await request(`${route}?page=${page}`),{kind:documentary?undefined:kind,documentary,page});
}
export function parseHdtodayDetails(html, sourceUrl) {
  const url=new URL(sourceUrl,HDTODAY_BASE),slug=/^\/watch\/([^/]+)$/.exec(url.pathname)?.[1];
  if(url.origin!==HDTODAY_BASE||!slugPattern.test(slug || ''))throw new Error('Invalid HDToday title');
  let data;
  for(const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)){
    try{const d=JSON.parse(m[1]);data=(d['@graph']||[d]).find(n=>['Movie','TVSeries','TVEpisode'].includes(n['@type']));if(data)break;}catch{}
  }
  if(!data?.name)throw new Error('HDToday details unavailable or format changed');
  const tmdbId=Number(/name="tmdb_id"\s+value="(\d+)"/.exec(html)?.[1] || /id="cm-root"[^>]*data-id="(\d+)"/.exec(html)?.[1])||null;
  const item=record({slug,title:text(data.name),year:Number((data.datePublished||'').slice(0,4))||null,poster:data.image,tmdbId,tags:(data.genre||[]).map(tag),synopsis:text(data.description),lang:data.inLanguage || null});
  const duration=/^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(data.duration || '');
  if(duration)item.totalDurationSec=Number(duration[1]||0)*3600+Number(duration[2]||0)*60;
  const seen=new Map();
  for(const m of html.matchAll(/href="([^"<>]*(?:\?|&(?:amp;)?)(?:s|season)=\d+[^"<>]*)"/g)){
    const link=new URL(text(m[1]),url);
    if(link.origin!==HDTODAY_BASE||link.pathname!==url.pathname)continue;
    const season=Number(link.searchParams.get('s')??link.searchParams.get('season'));
    const number=Number(link.searchParams.get('e')??link.searchParams.get('episode'));
    if(!Number.isInteger(season)||!Number.isInteger(number)||number<1)continue;
    const id=`${item.id}:${season}:${number}`;
    seen.set(id,{id,title:`Episode ${number}`,season,number,sourceUrl:link.href,thumbs:item.poster,offerings:[{...item.offerings[0],id,season,number}]});
  }
  if(item.kind==='series'){
    item.episodes=[...seen.values()].sort((a,b)=>a.season-b.season||a.number-b.number);
    item.episodeCount=item.episodes.length;item.seasons=[...new Set(item.episodes.map(e=>e.season))];
  }else item.episodes[0].durationSec=item.totalDurationSec;
  return item;
}
const cache=new Map();
export async function getHdtodayDetails(source) {
  const url=typeof source==='string'?source:source.sourceUrl;
  const entry=cache.get(url);
  if(entry && Date.now()-entry.at<5*60e3)return entry.value;
  const value=parseHdtodayDetails(await request(url),url);cache.set(url,{at:Date.now(),value});
  if(cache.size>300)cache.delete(cache.keys().next().value);
  return value;
}
export async function searchHdtoday(query,{documentary=false}={}) {
  const rows=JSON.parse(await request(`/api/suggest?q=${encodeURIComponent(query)}`));
  const items=[];
  for(const r of rows){
    if(!slugPattern.test(r.slug||''))continue;
    let item=record({slug:r.slug,title:text(r.title),year:Number(r.year)||null,poster:r.poster});
    if(documentary){try{item=await getHdtodayDetails(item);}catch{continue;}if(!item.documentary)continue;}
    items.push(item);
  }
  return items;
}
export function hdtodayServers(id) {
  const p=parseHdtodayId(id);
  if(!p||(p.kind==='series' && p.season==null))return [];
  return HDTODAY_PLAYER_ROUTES.map(({name})=>name).map((name,index)=>{
    const params=new URLSearchParams({t:p.kind==='film'?'movie':'tv',slug:p.slug,x:String(index)});
    if(p.kind==='series'){params.set('s',String(p.season));params.set('e',String(p.number));}
    return {id:`hdtoday:${index}`,name:`HDToday · ${name}`,provider:'hdtoday',type:'embed',embedUrl:`${HDTODAY_BASE}/api/go?${params}`,availability:'unverified'};
  });
}

const playerHosts = new Set([...HDTODAY_PLAYER_ROUTES.map(({tv})=>new URL(tv).hostname),'vidsrc.mov','vidsrc.fyi','embed.vidsrc.si','vidfast.pro','vidup.to','vidrock.net','vidnest.fun','vidlink.pro','111movies.net','multiembed.mov','mappletv.uk','moviesapi.to','player.vidlove.cc']);
export function parseHdtodayPlayer(html) {
  if (/<title>\s*(?:Quick check|Just a moment)/i.test(html)) return null;
  const target = /<meta\b[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*?url=([^"']+)/i.exec(html)?.[1];
  if (!target) return null;
  try {
    const url = new URL(text(target));
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && playerHosts.has(url.hostname) ? url.href : null;
  } catch { return null; }
}
const playerCache = new Map();
export function documentedMovieServers({tmdbId}={}) {
  if(!Number.isSafeInteger(Number(tmdbId))||Number(tmdbId)<1)return [];
  const id=Number(tmdbId);
  return [
    {id:'vidsrc:movie',name:'VidSrc',provider:'vidsrc',embedUrl:`https://vidsrc.mov/embed/movie/${id}`},
    {id:'vidfast:movie',name:'VidFast',provider:'vidfast',embedUrl:`https://vidfast.pro/movie/${id}?autoPlay=true`},
    {id:'vidlink:movie',name:'VidLink',provider:'vidlink',embedUrl:`https://vidlink.pro/movie/${id}?autoplay=true&title=true`},
  ].map(server=>({...server,type:'embed',sandbox:null,resolution:'documented-provider-route',availability:'unverified'}));
}
export function documentedTvServers({tmdbId,season,number}={}) {
  if(!Number.isSafeInteger(Number(tmdbId)) || Number(tmdbId)<1 || !Number.isInteger(season) || season<0 || !Number.isInteger(number) || number<1)return [];
  const slot=`${Number(tmdbId)}/${season}/${number}`;
  return [
    {id:'vidsrc:tv',name:'VidSrc',provider:'vidsrc',embedUrl:`https://vidsrc.mov/embed/tv/${slot}`},
    {id:'vidfast:tv',name:'VidFast',provider:'vidfast',embedUrl:`https://vidfast.pro/tv/${slot}?autoPlay=true`},
    {id:'vidlink:tv',name:'VidLink',provider:'vidlink',embedUrl:`https://vidlink.pro/tv/${slot}`},
  ].map(server=>({...server,type:'embed',sandbox:null,resolution:'documented-provider-route',availability:'unverified'}));
}
export function hdtodayTvFallbacks(id,tmdbId) {
  const parsed=parseHdtodayId(id), numericId=Number(tmdbId);
  if(!parsed || parsed.kind!=='series' || parsed.season==null || !Number.isSafeInteger(numericId) || numericId<1)return [];
  return hdtodayServers(id).map((server,index)=>({...server,
    embedUrl:HDTODAY_PLAYER_ROUTES[index].tv.replaceAll('{id}',String(numericId)).replaceAll('{season}',String(parsed.season)).replaceAll('{episode}',String(parsed.number)),
    sandbox:null,sourceUrl:server.embedUrl,resolution:'documented-provider-route',availability:'unverified'}));
}
export function hdtodayMovieFallbacks(id,tmdbId) {
  const parsed=parseHdtodayId(id), numericId=Number(tmdbId);
  if(!parsed || parsed.kind!=='film' || !Number.isSafeInteger(numericId) || numericId<1)return [];
  return hdtodayServers(id).map((server,index)=>({...server,embedUrl:HDTODAY_PLAYER_ROUTES[index].movie.replaceAll('{id}',String(numericId)),sandbox:null,sourceUrl:server.embedUrl,resolution:'documented-provider-route',availability:'unverified'}));
}
const fetchPlayerDefault=(path,{timeoutMs=5000}={})=>request(path,{timeoutMs});
export async function resolveHdtodayServers(id,{tmdbId,fresh=false,fetchPlayer=fetchPlayerDefault,fetchChoices=fetchPlayer===fetchPlayerDefault?(id,options)=>request.playerChoices(id,options):null,refreshBudgetMs=10000}={}) {
  const fallback=[...hdtodayTvFallbacks(id,tmdbId),...hdtodayMovieFallbacks(id,tmdbId)];
  const cacheKey=`${id}|${Number.isSafeInteger(Number(tmdbId))&&Number(tmdbId)>0?Number(tmdbId):'unknown'}`;
  const cached = playerCache.get(cacheKey);
  if (!fresh && cached && Date.now()-cached.at < 10*60e3) return cached.value;
  // Known identities still open immediately while a deliberate source refresh
  // can replace old redirects, names and removed servers.
  if(!fresh && fallback.length)return prioritizeHdtodayServers(fallback);
  // A user-requested refresh must not resurrect an old redirect on the next
  // request if the source no longer advertises any player.
  if (fresh) playerCache.delete(cacheKey);
  const deadline=Date.now()+Math.max(1,Math.min(15000,Number(refreshBudgetMs)||10000));
  async function withinBudget(work) {
    const timeoutMs=Math.min(5000,deadline-Date.now());
    if(timeoutMs<=0)throw new Error('HDToday source refresh time budget reached');
    let timer;
    try{return await Promise.race([Promise.resolve().then(()=>work(timeoutMs)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('HDToday source refresh time budget reached')),timeoutMs);})]);}
    finally{clearTimeout(timer);}
  }
  let choices;
  try { choices=fetchChoices?await withinBudget(timeoutMs=>fetchChoices(id,{fresh,timeoutMs})):hdtodayServers(id); }
  catch { return prioritizeHdtodayServers(fallback); }
  const resolved = [];
  let next = 0, inferred=null;
  await Promise.all(Array.from({length:Math.min(4,choices.length)},async()=>{
    while (next < choices.length && !inferred && Date.now()<deadline) {
      const index=next++, server=choices[index];
      try {
        const target=parseHdtodayPlayer(await withinBudget(timeoutMs=>fetchPlayer(server.embedUrl,{timeoutMs})));
        if(target){
          resolved[index]={...server,embedUrl:target,sandbox:null,sourceUrl:server.sourceUrl||server.embedUrl,routeResolved:true};
          const url=new URL(target), movieId=/\/(?:embed\/)?movie\/([1-9]\d*)(?:\/|$)/.exec(url.pathname)?.[1] || (url.hostname==='multiembed.mov' && url.searchParams.get('tmdb')==='1' ? url.searchParams.get('video_id'):null);
          if(movieId&&!fresh&&!fetchChoices)inferred=hdtodayMovieFallbacks(id,Number(movieId));
          if(!inferred?.length)inferred=null;
        }
      } catch { /* Never return HDToday wrapper pages as iframe players. */ }
    }
  }));
  const fallbackById=new Map(fallback.map(server=>[server.id,server]));
  const serverLabel=server=>String(server.name||'').replace(/^HDToday\s*[·:-]\s*/i,'').replace(/\s+/g,' ').trim().toLowerCase();
  // Preserve the currently advertised choices when only some wrappers answer
  // within the budget. Numeric identity is still required for each template.
  const current=choices.map((server,index)=>{
    if(resolved[index])return resolved[index];
    const route=fallbackById.get(server.id);
    // Source indices are not permanent host identities. If an index now has a
    // different label, its redirect must resolve before we can return a route.
    return route&&serverLabel(server)===serverLabel(route)?{...route,name:server.name||route.name,sourceUrl:server.sourceUrl||server.embedUrl}:null;
  }).filter(Boolean);
  const result=prioritizeHdtodayServers(inferred || current);
  if(result.length)playerCache.set(cacheKey,{at:Date.now(),value:result});
  if(playerCache.size>300)playerCache.delete(playerCache.keys().next().value);
  return result;
}

function prioritizeHdtodayServers(options) {
  // The public TV Vidcore route was confirmed in the Android inline player on
  // 2026-11-03 (advancing playback); this is not a claim about every title.
  const rank=server=>server.embedUrl.startsWith('https://vidcore.io/tv/')?2:server.embedUrl.startsWith('https://vidfast.pro/tv/')?1:0;
  return options.toSorted((a,b)=>rank(b)-rank(a));
}
