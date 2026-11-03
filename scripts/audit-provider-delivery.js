// Bounded, read-only delivery audit. A media signature is not decoded playback.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SPECIALISTS,fetchSpecialistPage,getSpecialistDetails,resolveSpecialistServers} from '../server/src/specialist-providers.js';
import {fetchFmoviesPage,fmoviesServers} from '../server/src/fmovies.js';
import {fetchHdtodayPage,resolveHdtodayServers} from '../server/src/hdtoday.js';
import {fetchMovies,resolveMyflixerStream} from '../server/src/myflixer.js';
import {safeRemoteFetch} from '../server/src/stream-security.js';
import {diagnosePlayerResponse} from '../server/src/player-diagnostics.js';

const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2),option=(key,value)=>args.includes(key)?args[args.indexOf(key)+1]:value;
const out=path.resolve(root,option('--out','artifacts/provider-delivery-2026-11-03'));
fs.mkdirSync(out,{recursive:true});
const providerOf=id=>id?.startsWith('mf:')?'myflixer':id?.startsWith('fm:')?'fmovies':id?.startsWith('hd:')?'hdtoday':/^sp:([^:]+):/.exec(id||'')?.[1];
const providers=['myflixer','fmovies','hdtoday',...Object.keys(SPECIALISTS)],selected=option('--provider','').split(',').filter(Boolean),queue=selected.length?providers.filter(p=>selected.includes(p)):providers;
const oldFile=path.join(root,'artifacts/provider-matrix-records.json'),old=fs.existsSync(oldFile)?JSON.parse(fs.readFileSync(oldFile,'utf8')):[];
const extra=[
 {id:'fm:m:693134',title:'Dune: Part Two',kind:'film',episodes:[{id:'fm:m:693134'}]},
 {id:'sp:frembed:m:309809',title:'Le Petit Prince',kind:'film',episodes:[{id:'sp:frembed:m:309809'}]},
 {id:'sp:frembed:s:246',title:'Avatar',kind:'series',episodes:[{id:'sp:frembed:e:246:1:1'}]},
 {id:'sp:dessinanimenet:m:RF0zcxWqxa6NJMWGslotkG00UyNSUXuE',title:'Scooby-Doo! Halloween',kind:'film',episodes:[{id:'sp:dessinanimenet:m:RF0zcxWqxa6NJMWGslotkG00UyNSUXuE'}]},
 {id:'sp:dessinanime:m:309809-le-petit-prince',title:'Le Petit Prince',kind:'film',episodes:[{id:'sp:dessinanime:m:309809-le-petit-prince'}]},
 {id:'sp:wco:s:gravity-falls',title:'Gravity Falls',kind:'series',episodes:[{id:'sp:wco:e:gravity-falls:gravity-falls-episode-1-tourist-trapped'}]},
];
const report={at:new Date().toISOString(),environment:'local Node.js, public network access',scope:'One first listing page per provider; one captured title per provider/type, then every returned source route. HLS probes inspect one rendition and first segment only. No Android playback confirmation.',providers:queue,results:[],playbackConfirmed:false};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
async function pool(rows,n,fn){let index=0;await Promise.all(Array.from({length:Math.min(n,rows.length)},async()=>{while(index<rows.length)await fn(rows[index++]);}));}
async function budget(promise,ms=25000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Audit stage time budget exceeded')),ms)})]);}finally{clearTimeout(timer);}}
async function readLimit(response,limit=65536){const reader=response.body?.getReader();if(!reader)return Buffer.alloc(0);const chunks=[];let size=0;try{while(size<limit){const {value,done}=await reader.read();if(done)break;chunks.push(Buffer.from(value).subarray(0,limit-size));size+=value.length;}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks);}
function mediaSignature(bytes){if(bytes.length>=376&&bytes[0]===0x47&&bytes[188]===0x47)return 'mpeg-ts';if(bytes.length>=12&&['ftyp','styp','moof','sidx'].includes(bytes.toString('ascii',4,8)))return 'iso-bmff';if(bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return 'webm';return null;}
async function request(url,headers={},range=false){const response=await safeRemoteFetch(url,{timeoutMs:8000,headers:{'User-Agent':'Mozilla/5.0',...headers,...(range?{Range:'bytes=0-65535'}:{})}});return {response,body:await readLimit(response,range?65536:262144)};}
function statusCategory(response,body){const html=body.toString('utf8'),title=/<title[^>]*>([^<]*)/i.exec(html)?.[1]||'',text=html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();return {category:diagnosePlayerResponse(response.status,{title,text,contentType:response.headers.get('content-type')||'',challenge:response.headers.get('cf-mitigated')==='challenge'}),...(title?{pageTitle:title.slice(0,120)}:{})};}
async function inspect(server){const start=Date.now(),row={name:server.name,type:server.type,provider:server.provider,availability:server.availability,playbackConfirmed:false};const url=server.rawStreamUrl||server.streamUrl||server.embedUrl;
 if(server.type==='youtube'){return {...row,category:'youtube-player-device-test-required'};}
 if(server.type==='dessinanime'||server.type==='wco'){return {...row,category:'device-source-resolver-required'};}
 try{row.host=new URL(url).hostname;const {response,body}=await request(url,server.headers,!!server.streamUrl&&server.type!=='hls');row.status=response.status;row.contentType=response.headers.get('content-type');row.finalHost=new URL(response.url).hostname;Object.assign(row,statusCategory(response,body));
  if(!response.ok)return row;
  if(server.type==='hls'||body.toString('utf8',0,10).startsWith('#EXTM3U')){
   let playlist=body.toString('utf8'),base=response.url;
   if(!playlist.trimStart().startsWith('#EXTM3U')){row.category='invalid-hls-response';return row;}
   const rendition=/#EXT-X-STREAM-INF:[^\r\n]*\r?\n([^\r\n#]+)/.exec(playlist)?.[1];
   if(rendition){const child=await request(new URL(rendition.trim(),base).href,server.headers);row.renditionStatus=child.response.status;if(!child.response.ok){row.category='hls-rendition-unavailable';return row;}playlist=child.body.toString('utf8');base=child.response.url;}
   if(!playlist.trimStart().startsWith('#EXTM3U')){row.category='invalid-hls-rendition';return row;}
   row.encrypted=/#EXT-X-KEY:(?!METHOD=NONE)/.test(playlist);
   const segment=playlist.split(/\r?\n/).find(line=>line.trim()&&!line.startsWith('#'));if(!segment){row.category='hls-no-segments';return row;}
   const media=await request(new URL(segment.trim(),base).href,server.headers,true);row.segmentStatus=media.response.status;row.segmentBytes=media.body.length;row.mediaSignature=mediaSignature(media.body);
   row.category=!media.response.ok?'hls-segment-unavailable':row.mediaSignature?'media-bytes-received-not-decoded':row.encrypted?'encrypted-segment-received-key-and-decode-unverified':'hls-segment-not-recognized';
  }else if(server.streamUrl){row.mediaSignature=mediaSignature(body);row.mediaBytes=body.length;if(row.mediaSignature)row.category='media-bytes-received-not-decoded';}
 }catch(error){row.category=/timeout|aborted|budget/i.test(error.message)?'network-timeout':/ENOTFOUND/.test(error.message)?'dns-failure':'request-error';row.error=error.message;}
 finally{row.ms=Date.now()-start;}
 return row;
}
async function resolver(provider,record,episode){if(provider==='myflixer'){const data=await resolveMyflixerStream(episode.id,'/api/stream',{transport:'direct'});return data.servers||[];}if(provider==='fmovies')return fmoviesServers(episode.id);if(provider==='hdtoday')return resolveHdtodayServers(episode.id,{tmdbId:record.tmdbId});if(provider==='youtubeoriginals')return [{type:'youtube',provider:'youtube',name:'Official YouTube',videoId:episode.id}];return resolveSpecialistServers(episode.id,{fresh:true,transport:'direct'});}
await pool(queue,3,async provider=>{
 const result={provider,catalogue:null,samples:[]};report.results.push(result);let first;
 try{const kind=SPECIALISTS[provider]?.kind||'series',page=await budget(provider==='myflixer'?fetchMovies({page:1,perPage:5}):provider==='fmovies'?fetchFmoviesPage({kind,page:1}):provider==='hdtoday'?fetchHdtodayPage({kind,page:1}):fetchSpecialistPage({provider,kind,page:1}));result.catalogue={count:page.items.length,partial:!!page.partial,totalPages:page.totalPages};first=page.items[0];}catch(error){result.catalogue={error:error.message};}save();
 const records=[...extra,...old].filter(r=>providerOf(r.id)===provider),byKind=new Map();for(const record of records)if(!byKind.has(record.kind))byKind.set(record.kind,record);
 if(!byKind.size&&first)byKind.set(first.kind,first);
 if(!byKind.size){result.missing='No captured title and no live listing sample';save();return;}
 for(let record of byKind.values()){
  const sample={id:record.id,title:record.title,kind:record.kind,routes:[],playbackConfirmed:false};result.samples.push(sample);
  try{let episode=record.episodes?.find(e=>providerOf(e.id)===provider||provider==='youtubeoriginals');
   if(!episode){record=await budget(getSpecialistDetails(record.id,{fresh:true}));episode=record.episodes?.find(e=>providerOf(e.id)===provider||provider==='youtubeoriginals');}
   if(!episode){sample.error='Source has no discovered episode links';continue;}
   // A film's display episode may share its title ID while its own offering
   // points to a separate public watch page (notably MyAsianTV).
   const own=episode.offerings?.find(o=>o.provider===provider);
   if(own?.id)episode={...episode,id:own.id};sample.episodeId=episode.id;
   const servers=await budget(resolver(provider,record,episode));sample.returnedRoutes=servers.length;
   await pool(servers,3,async server=>{sample.routes.push(await inspect(server));save();});
  }catch(error){sample.error=error.message;}
  save();console.log(JSON.stringify({provider,id:sample.id,returnedRoutes:sample.returnedRoutes,error:sample.error,categories:sample.routes.map(r=>r.category)}));
 }
});
report.finishedAt=new Date().toISOString();report.summary={providers:report.results.length,samples:report.results.reduce((n,p)=>n+p.samples.length,0),routes:report.results.reduce((n,p)=>n+p.samples.reduce((m,s)=>m+s.routes.length,0),0),categories:{}};for(const p of report.results)for(const s of p.samples)for(const r of s.routes)report.summary.categories[r.category]=(report.summary.categories[r.category]||0)+1;save();console.log(JSON.stringify(report.summary));
