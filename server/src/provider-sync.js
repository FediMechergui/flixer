import {nextProviderRetry,providerCoolingDown} from './provider-retry.js';
import { readJson, writeJson } from './store.js';
import { fetchFmoviesPage, FMOVIES_GENRES } from './fmovies.js';
import { fetchHdtodayPage } from './hdtoday.js';
import { mergeLibrary, mergeShow } from './merge-library.js';
import { specialistJobs, fetchSpecialistPage } from './specialist-providers.js';
import { validateHdtodayFeed } from './hdtoday-feed.js';
import {fetchMovies,fetchSeries} from './myflixer.js';
import {getSpecialistDetails} from './specialist-providers.js';
import {refreshSeriesEpisodes} from './episode-refresh.js';

const running=new Map();
const filename=product=>`providers-${product}.json`;
export function providerCache(product) {
  return readJson(filename(product),{version:1,items:[],queue:[],completed:false,lastRefreshAt:null,errors:{}});
}
export function mergeCachedProviders(base, product) {
  const cache=providerCache(product);
  const aliases=readJson(`provider-aliases-${product}.json`,{});
  const identities=readJson(`provider-identities-${product}.json`,{});
  const enriched={...base,shows:(base.shows || []).map(s=>({...s,...identities[s.id]?.metadata}))};
  const result=mergeLibrary(enriched,cache.items,{product,aliases});
  result.catalog.providerSync={lastRefreshAt:cache.lastRefreshAt,completed:cache.completed,remainingPartitions:cache.queue.length,errors:cache.errors,sourceRecords:cache.items.length,externalFeeds:cache.externalFeeds||{}};
  if(cache.lastRefreshAt && (!result.catalog.generatedAt || cache.lastRefreshAt>result.catalog.generatedAt))result.catalog.generatedAt=cache.lastRefreshAt;
  return result;
}
export function saveMergeReport(product,report) {
  writeJson(`provider-aliases-${product}.json`,report.aliases);
  writeJson(`provider-matches-${product}.json`,{at:new Date().toISOString(),added:report.added,matched:report.matched,pending:report.pending,rejected:report.rejected});
}
function scopes(product) {
  const documentary=product==='dahsha';
  return [
    {provider:'fmovies',kind:'film',documentary,page:1},
    {provider:'fmovies',kind:'series',documentary,page:1},
    ...(documentary?[{provider:'hdtoday',documentary:true,page:1}]:[{provider:'hdtoday',kind:'film',page:1},{provider:'hdtoday',kind:'series',page:1}]),
    ...(!documentary?[
      {provider:'myflixer',kind:'film',page:1},{provider:'myflixer',kind:'series',page:1},
      ...['film','series'].map(kind=>({provider:'fmovies',kind,language:'fr',page:1})),
      ...['film','series'].map(kind=>({provider:'fmovies',kind,country:'CA',language:'fr',page:1})),
      ...['KR','JP','CN','TW','CA','IN','TR','EG','TN'].flatMap(country=>['film','series'].map(kind=>({provider:'fmovies',kind,country,page:1}))),
      {provider:'fmovies',kind:'series',country:'JP',genre:'animation',page:1},
      ...specialistJobs(),
      ...['film','series'].map(kind=>({provider:'frenchstream',kind,collection:'french-originals',page:1})),
      ...['film','series'].map(kind=>({provider:'dessinanime',kind,collection:'french-cartoons',page:1})),
      ...['film','series'].map(kind=>({provider:'cimafu',kind,collection:'arabic',page:1})),
      {provider:'cimafu',kind:'series',collection:'anime',page:1},
      ...['film','series'].map(kind=>({provider:'cimafu',kind,collection:'cartoons',page:1})),
      ...['arabic','turkish'].flatMap(collection=>['film','series'].map(kind=>({provider:'tuniflix',kind,collection,page:1}))),
      {provider:'streamtunisie',kind:'series',collection:'arabic',page:1},
      {provider:'multimovies',kind:'film',collection:'indian',page:1},
      {provider:'multimovies',kind:'series',collection:'indian',page:1},
      {provider:'kirmalk',kind:'film',collection:'plays',page:1},
    ]:[]),
  ];
}
async function fetchPage(job) {
  if(job.provider==='myflixer')return (job.kind==='film'?fetchMovies:fetchSeries)({...job,perPage:100});
  const result=await (job.provider==='fmovies'?fetchFmoviesPage(job):job.provider==='hdtoday'?fetchHdtodayPage(job):fetchSpecialistPage(job));
  if(['frenchstream','dessinanime','myasiantv'].includes(job.provider)){let cursor=0;await Promise.all(Array.from({length:Math.min(4,result.items.length)},async()=>{while(cursor<result.items.length){const index=cursor++;try{const detail=await getSpecialistDetails(result.items[index].id);result.items[index]={...mergeShow(result.items[index],detail),title:detail.title};}catch{ /* retain discovered catalogue entries when detail access fails */ }}}));}
  return result;
}
export async function refreshProviders({product='dahsha',full=false,latestOnly=false,pageBudget=Number(process.env.PROVIDER_SCAN_PAGES||12),log=console.log}={}) {
  if(running.has(product))return running.get(product);
  const promise=scan({product,full,latestOnly,pageBudget,log}).finally(()=>running.delete(product));running.set(product,promise);return promise;
}
async function scan({product,full,latestOnly,pageBudget,log}) {
  const cache=providerCache(product),items=new Map(cache.items.map(i=>[i.id,i]));
  cache.queue=cache.queue.filter(job=>!(job.provider==='egydead'&&job.collection==='plays'));
  const errors={...cache.errors},attempted=new Set(),failed=new Set();let requests=0;
  const deferred=new Set();
  const unavailable=provider=>failed.has(provider)&&/HTTP (?:401|403|429)|verification required|origin changed/i.test(errors[provider]||'');
  // Cached HDToday data is the default until ordinary hosted access returns.
  // Independent feeds require explicit configuration, never just a file's presence.
  const feed=process.env.HDTODAY_EXTERNAL_FEED==='1'?validateHdtodayFeed(readJson('hdtoday-feed.json',null)):null;
  const paused=new Set([...(feed?['hdtoday']:[]),...Object.entries(cache.retryState||{}).filter(([,state])=>providerCoolingDown(state)).map(([provider])=>provider)]);
  const put=rows=>{for(const row of rows){const old=items.get(row.id);const now=new Date().toISOString();
    const fresh=!old?.latestAt || !row.latestAt || row.latestAt>=old.latestAt;
    const merged=old?mergeShow(old,row):row;
    const priorEpisodes=new Set((old?.episodes||[]).map(e=>e.id));
    const addedEpisodes=!!old&&(row.episodes||[]).some(e=>!priorEpisodes.has(e.id));
    items.set(row.id,{...merged,firstSeenAt:old?.firstSeenAt||now,latestEpisode:fresh?row.latestEpisode||old?.latestEpisode:old.latestEpisode,
      providerUpdatedAt:addedEpisodes || fresh && row.latestEpisode && row.latestEpisode!==old?.latestEpisode ? row.providerUpdatedAt||now : old?.providerUpdatedAt||row.providerUpdatedAt||now});
  }};
  if(feed){
    put(feed.items.filter(row=>product!=='dahsha'||row.documentary===true&&row.tags?.includes('documentary')));
    cache.externalFeeds={...cache.externalFeeds,hdtoday:{updatedAt:feed.updatedAt,records:feed.items.length,complete:feed.complete===true}};
    log(`[providers:${product}] synchronized HDToday snapshot: ${feed.items.length} source titles; updated ${feed.updatedAt}`);
  }else if(cache.externalFeeds?.hdtoday)delete cache.externalFeeds.hdtoday;
  // New releases / new episodes are refreshed independently of the long historical crawl.
  const currentYear=new Date().getUTCFullYear();
  const seeds=scopes(product);
  for(let offset=0;offset<seeds.length;offset+=4){
    const chunk=seeds.slice(offset,offset+4).filter(seed=>!paused.has(seed.provider)&&!unavailable(seed.provider));
    const results=await Promise.allSettled(chunk.map(seed=>{
      attempted.add(seed.provider);
      const sort=seed.kind==='series'?'popularity.desc':'primary_release_date.desc';
      return fetchPage(seed.provider==='fmovies'?{...seed,...(seed.kind==='film'?{year:currentYear}:{}),sort}:{...seed,latest:true});
    }));
    results.forEach((result,index)=>{const provider=chunk[index].provider;if(result.status==='fulfilled'){put(result.value.items);requests++;if(result.value.partial){errors[provider]='Partial source response; cached records retained';failed.add(provider);}else if(!failed.has(provider))delete errors[provider];}else{errors[provider]=result.reason.message;failed.add(provider);}});
  }
  if(!cache.queue.length && !cache.completed)cache.queue=scopes(product);
  // Existing resumable scans keep their cursors when new source families arrive.
  if(product==='flixer' && cache.specialistScopesVersion!==8){
    const key=job=>JSON.stringify([job.provider,job.kind,job.country,job.language,job.genre,job.year,job.collection]);
    const known=new Set(cache.queue.map(key));
    cache.queue.push(...seeds.filter(job=>(job.country||job.language||!['fmovies','hdtoday'].includes(job.provider))&&!known.has(key(job))));
    cache.specialistScopesVersion=8;cache.completed=false;
  }
  if(full && cache.completed){cache.queue=scopes(product);cache.completed=false;}
  let scanned=0;
  while(!latestOnly && cache.queue.length && (full || scanned<pageBudget)) {
    if(cache.queue.every(job=>unavailable(job.provider)||paused.has(job.provider)||deferred.has(job)))break;
    // Give each provider/region a turn. Hundreds of old FMovies year partitions
    // must not keep a new animation or regional catalogue waiting for weeks.
    const lane=job=>`${job.provider}:${job.country||'all'}`;
    const lanes=[...new Set(seeds.map(lane))];
    const start=lanes.indexOf(cache.lastScanLane);
    for(let offset=1;offset<=lanes.length;offset++){
      const next=lanes[(start+offset)%lanes.length];
      const index=cache.queue.findIndex(job=>lane(job)===next&&!unavailable(job.provider)&&!paused.has(job.provider)&&!deferred.has(job));
      if(index>=0){cache.queue.unshift(cache.queue.splice(index,1)[0]);cache.lastScanLane=next;break;}
    }
    if(unavailable(cache.queue[0].provider)||paused.has(cache.queue[0].provider)||deferred.has(cache.queue[0])){cache.queue.push(cache.queue.shift());continue;}
    const job=cache.queue[0];
    try {
      attempted.add(job.provider);const result=await fetchPage(job);put(result.items);requests++;scanned++;
      if(result.partial){failed.add(job.provider);errors[job.provider]='Partial source response; historical page retained for retry';deferred.add(job);cache.queue.push(cache.queue.shift());continue;}
      // Partition capped TMDB discovery by release/first-air year, then genre if necessary.
      if(job.provider==='fmovies' && job.page===1 && result.totalPages>=500 && !job.year){
        cache.queue.shift();
        const years=[...Array.from({length:currentYear+4-1900},(_,i)=>currentYear+3-i),'older'];
        cache.queue.push(...years.map(year=>({...job,year,page:1})));
      } else if(job.provider==='fmovies' && job.page===1 && result.totalPages>=500 && job.year && !job.genre){
        cache.queue.shift();
        const genres=job.documentary?[99]:Object.keys(FMOVIES_GENRES).map(Number);
        cache.queue.push(...genres.map(genre=>({...job,genre,page:1})));
      } else {
        const more=result.hasNext ?? job.page<result.totalPages;
        if(more){job.page++;if(result.nextCursor)job.cursor=result.nextCursor;cache.queue.push(cache.queue.shift());}else cache.queue.shift();
      }
      if(scanned%10===0)log(`[providers:${product}] ${items.size} records; ${cache.queue.length} scan partitions remain`);
      if(scanned%10===0)writeJson(filename(product),{...cache,items:[...items.values()],errors,completed:false});
    }catch(e){
      errors[job.provider]=e.message;failed.add(job.provider);
      deferred.add(job);
      // Keep the failed cursor for the next refresh, but let other providers make progress.
      cache.queue.push(cache.queue.shift());
      if(cache.queue.every(j=>unavailable(j.provider)||paused.has(j.provider)||deferred.has(j)))break;
      if(full && scanned===0 && cache.queue[0].provider===job.provider)break;
      scanned++;
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  cache.items=[...items.values()];cache.errors=errors;cache.completed=cache.queue.length===0;
  if(product==='flixer'){
    const refreshed=await refreshSeriesEpisodes(cache.items,{skipProviders:paused,limit:Number(process.env.PROVIDER_EPISODE_REFRESH_LIMIT||(latestOnly?24:120))});
    cache.items=refreshed.items;cache.episodeRefresh={...refreshed.report,at:new Date().toISOString()};
    log(`[episodes:${product}] ${refreshed.report.checked} series checked; ${refreshed.report.addedEpisodes} episodes added; ${refreshed.report.errors.length} unavailable`);
  }
  cache.retryState||={};for(const provider of attempted){if(failed.has(provider))cache.retryState[provider]=nextProviderRetry(cache.retryState[provider],errors[provider]);else{delete cache.retryState[provider];delete errors[provider];}}
  cache.lastRefreshAt=new Date().toISOString();
  writeJson(filename(product),cache);
  log(`[providers:${product}] ${cache.items.length} source records; complete=${cache.completed}; requests=${requests}${Object.keys(errors).length?`; errors=${JSON.stringify(errors)}`:''}`);
  return cache;
}
