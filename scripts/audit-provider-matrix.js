// Read-only sample audit. HTTP reachability and server resolution do not prove video playback.
import fs from 'node:fs';
import {SPECIALISTS,fetchSpecialistPage,getSpecialistDetails} from '../server/src/specialist-providers.js';
import {fetchFmoviesPage,getFmoviesDetails} from '../server/src/fmovies.js';
import {fetchHdtodayPage,getHdtodayDetails} from '../server/src/hdtoday.js';
import {fetchMovies,fetchSeries,getTitleDetails} from '../server/src/myflixer.js';
import {unifiedStream} from '../server/src/library-service.js';
import {safeRemoteFetch} from '../server/src/stream-security.js';
const jobs=[...['fmovies','hdtoday','myflixer'].flatMap(provider=>['film','series'].map(kind=>({provider,kind}))),...Object.entries(SPECIALISTS).flatMap(([provider,cfg])=>(cfg.kind?[cfg.kind]:['film','series']).map(kind=>({provider,kind})))];
for(const collection of ['arabic','anime','cartoons','turkish','indian'])jobs.push({provider:'cimafu',kind:collection==='indian'?'film':'series',collection});
const selected=process.argv.indexOf('--provider');const queue=selected>=0?jobs.filter(j=>j.provider===process.argv[selected+1]):jobs;
const report={at:new Date().toISOString(),scope:'First listing page and one title per provider/type; extra Cimafu regional/animation samples',results:[]},records=[];
async function bounded(promise,ms=25000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Sample audit time budget exceeded')),ms)})]);}finally{clearTimeout(timer)}}
async function audit(job){const start=Date.now(),result={...job,playbackConfirmed:false};try{
 const page=await bounded(job.provider==='fmovies'?fetchFmoviesPage({...job,page:1}):job.provider==='hdtoday'?fetchHdtodayPage({...job,page:1}):job.provider==='myflixer'?(job.kind==='film'?fetchMovies:fetchSeries)({page:1,perPage:12}):fetchSpecialistPage({...job,page:1}));
 result.catalogue={items:page.items.length,partial:!!page.partial,pages:page.totalPages};const row=page.items[0];if(row){
 const detail=await bounded(job.provider==='fmovies'?getFmoviesDetails(row):job.provider==='hdtoday'?getHdtodayDetails(row):job.provider==='myflixer'?getTitleDetails(row.id):getSpecialistDetails(row.id,{fresh:true}));records.push(detail);
 result.sample={id:detail.id,title:detail.title,genres:detail.tags,originalLanguage:detail.originalLanguage,audioModes:detail.audioModes,audioLanguages:detail.audioLanguages,subtitleLanguages:detail.subtitleLanguages,episodes:detail.episodes?.length,poster:!!(detail.poster?.custom||detail.portrait),synopsis:!!detail.synopsis};
 const ep=detail.episodes?.[0];if(ep){const stream=await bounded(unifiedStream(ep.id,{showId:detail.id,catalog:{product:'flixer',shows:[detail]},product:'flixer'}));result.servers={count:stream?.servers?.length||0,types:[...new Set((stream?.servers||[]).map(s=>s.type))],providerErrors:stream?.providerErrors};const server=stream?.servers?.find(s=>s.embedUrl||s.streamUrl);if(server){try{const response=await safeRemoteFetch(server.embedUrl||server.streamUrl,{timeoutMs:8000,...(server.streamUrl?{headers:{Range:'bytes=0-1023'}}:{})});result.route={status:response.status,type:response.headers.get('content-type')};await response.body?.cancel();}catch(e){result.route={error:e.message}}}}
 }
 }catch(e){result.error=e.message}result.ms=Date.now()-start;report.results.push(result);fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/provider-matrix.json',JSON.stringify(report,null,2));fs.writeFileSync('artifacts/provider-matrix-records.json',JSON.stringify(records));console.log(JSON.stringify(result));}
let next=0;await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{while(next<queue.length)await audit(queue[next++]);}));
