import { readJson, writeJson } from './store.js';
import { fetchFmoviesPage, FMOVIES_GENRES } from './fmovies.js';
import { fetchHdtodayPage } from './hdtoday.js';
import { mergeLibrary, mergeShow } from './merge-library.js';
import { specialistJobs, fetchSpecialistPage } from './specialist-providers.js';

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
  result.catalog.providerSync={lastRefreshAt:cache.lastRefreshAt,completed:cache.completed,remainingPartitions:cache.queue.length,errors:cache.errors,sourceRecords:cache.items.length};
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
      ...['KR','IN','TR'].flatMap(country=>['film','series'].map(kind=>({provider:'fmovies',kind,country,page:1}))),
      {provider:'fmovies',kind:'series',country:'JP',genre:'animation',page:1},
      ...specialistJobs(),
      {provider:'multimovies',kind:'film',collection:'indian',page:1},
      {provider:'multimovies',kind:'series',collection:'indian',page:1},
    ]:[]),
  ];
}
async function fetchPage(job) {
  return job.provider==='fmovies'?fetchFmoviesPage(job):job.provider==='hdtoday'?fetchHdtodayPage(job):fetchSpecialistPage(job);
}
export async function refreshProviders({product='dahsha',full=false,pageBudget=Number(process.env.PROVIDER_SCAN_PAGES||12),log=console.log}={}) {
  if(running.has(product))return running.get(product);
  const promise=scan({product,full,pageBudget,log}).finally(()=>running.delete(product));running.set(product,promise);return promise;
}
async function scan({product,full,pageBudget,log}) {
  const cache=providerCache(product),items=new Map(cache.items.map(i=>[i.id,i]));
  const errors={};let requests=0;
  const put=rows=>{for(const row of rows){const old=items.get(row.id);const now=new Date().toISOString();
    const fresh=!old?.latestAt || !row.latestAt || row.latestAt>=old.latestAt;
    const merged=old?mergeShow(old,row):row;
    items.set(row.id,{...merged,firstSeenAt:old?.firstSeenAt||now,latestEpisode:fresh?row.latestEpisode||old?.latestEpisode:old.latestEpisode,
      providerUpdatedAt:fresh && row.latestEpisode && row.latestEpisode!==old?.latestEpisode ? row.providerUpdatedAt||now : old?.providerUpdatedAt||row.providerUpdatedAt||now});
  }};
  // New releases / new episodes are refreshed independently of the long historical crawl.
  const currentYear=new Date().getUTCFullYear();
  const seeds=scopes(product);
  for(let offset=0;offset<seeds.length;offset+=4){
    const chunk=seeds.slice(offset,offset+4);
    const results=await Promise.allSettled(chunk.map(seed=>{
      const sort=seed.kind==='series'?'first_air_date.desc':'primary_release_date.desc';
      return fetchPage(seed.provider==='fmovies'?{...seed,year:currentYear,sort}:{...seed,latest:true});
    }));
    results.forEach((result,index)=>{if(result.status==='fulfilled'){put(result.value.items);requests++;}else errors[chunk[index].provider]=result.reason.message;});
  }
  if(!cache.queue.length && !cache.completed)cache.queue=scopes(product);
  // Existing resumable scans keep their cursors when new source families arrive.
  if(product==='flixer' && cache.specialistScopesVersion!==2){
    const key=job=>JSON.stringify([job.provider,job.kind,job.country,job.genre,job.year,job.collection]);
    const known=new Set(cache.queue.map(key));
    cache.queue.push(...seeds.filter(job=>(job.country||!['fmovies','hdtoday'].includes(job.provider))&&!known.has(key(job))));
    cache.specialistScopesVersion=2;cache.completed=false;
  }
  if(full && cache.completed){cache.queue=scopes(product);cache.completed=false;}
  let scanned=0;
  while(cache.queue.length && (full || scanned<pageBudget)) {
    if(cache.queue.every(job=>errors[job.provider]))break;
    // Give each provider/region a turn. Hundreds of old FMovies year partitions
    // must not keep a new animation or regional catalogue waiting for weeks.
    const lane=job=>`${job.provider}:${job.country||'all'}`;
    const lanes=[...new Set(seeds.map(lane))];
    const start=lanes.indexOf(cache.lastScanLane);
    for(let offset=1;offset<=lanes.length;offset++){
      const next=lanes[(start+offset)%lanes.length];
      const index=cache.queue.findIndex(job=>lane(job)===next&&!errors[job.provider]);
      if(index>=0){cache.queue.unshift(cache.queue.splice(index,1)[0]);cache.lastScanLane=next;break;}
    }
    if(errors[cache.queue[0].provider]){cache.queue.push(cache.queue.shift());continue;}
    const job=cache.queue[0];
    try {
      const result=await fetchPage(job);put(result.items);requests++;scanned++;
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
        if(more){job.page++;cache.queue.push(cache.queue.shift());}else cache.queue.shift();
      }
      if(scanned%10===0)log(`[providers:${product}] ${items.size} records; ${cache.queue.length} scan partitions remain`);
      if(scanned%10===0)writeJson(filename(product),{...cache,items:[...items.values()],errors,completed:false});
    }catch(e){
      errors[job.provider]=e.message;
      // Keep the failed cursor for the next refresh, but let other providers make progress.
      cache.queue.push(cache.queue.shift());
      if(cache.queue.every(j=>errors[j.provider]))break;
      if(full && scanned===0 && cache.queue[0].provider===job.provider)break;
      scanned++;
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  cache.items=[...items.values()];cache.errors=errors;cache.completed=cache.queue.length===0;
  cache.lastRefreshAt=new Date().toISOString();
  writeJson(filename(product),cache);
  log(`[providers:${product}] ${cache.items.length} source records; complete=${cache.completed}; requests=${requests}${Object.keys(errors).length?`; errors=${JSON.stringify(errors)}`:''}`);
  return cache;
}
