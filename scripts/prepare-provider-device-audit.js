// Resolve a reproducible provider/type matrix without treating links as playback.
import fs from 'node:fs';import path from 'node:path';
import {SPECIALISTS} from '../server/src/specialist-providers.js';
const args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const directory=path.resolve(opt('--out','artifacts/provider-device-audit-2026-10-24')),base=opt('--api','https://flixer-api-fedimechergui.netlify.app');
fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'resolved.private.json');
const providers=['myflixer','fmovies','hdtoday',...Object.keys(SPECIALISTS)],samples=new Map();
const add=row=>{if(row?.id&&!samples.has(row.id))samples.set(row.id,row)};
const provider=id=>id.startsWith('mf:')?'myflixer':id.startsWith('fm:')?'fmovies':id.startsWith('hd:')?'hdtoday':/^sp:([^:]+):/.exec(id)?.[1];
const old=JSON.parse(fs.readFileSync('artifacts/provider-matrix-records.json','utf8'));
for(const row of old)add({id:row.id,provider:provider(row.id),title:row.title,kind:row.kind,episodeId:row.episodes?.[0]?.id});
const index=JSON.parse(fs.readFileSync('client/public/data-flixer/index.json','utf8'));
for(const row of index.shows){const p=provider(row.id);if(!providers.includes(p))continue;
 const needsType=![...samples.values()].some(s=>s.provider===p&&s.kind===row.kind);
 const channel=p==='youtubeoriginals'?/^sp:youtubeoriginals:s:([a-z]+)-/.exec(row.id)?.[1]:null;
 const needsChannel=channel&&![...samples.values()].some(s=>s.id.startsWith('sp:youtubeoriginals:s:'+channel+'-'));
 if(needsType||needsChannel)add({id:row.id,provider:p,title:row.title,kind:row.kind,episodeId:row.firstEpisodeId});
}
for(const row of index.shows.filter(s=>s.id.startsWith('sp:animegg:')).filter(s=>/dub/i.test(s.slug||s.id)).slice(0,1))add({id:row.id,provider:'animegg',title:row.title,kind:row.kind,episodeId:row.firstEpisodeId});
add({id:'fm:m:693134',provider:'fmovies',title:'Dune: Part Two',kind:'film',episodeId:'fm:m:693134'});
for(const [slug,episodeSlug,title]of [['gravity-falls','gravity-falls-episode-1-tourist-trapped','Gravity Falls'],['scooby-doo-where-are-you','scooby-doo-where-are-you-season-1-episode-1-what-a-night-for-a-knight','Scooby-Doo, Where Are You!'],['haikyuu-english-subbed','haikyuu-season-1-episode-1-english-subbed','Haikyuu — English subbed']])add({id:'sp:wco:s:'+slug,provider:'wco',title,kind:'series',episodeId:'sp:wco:e:'+slug+':'+episodeSlug,nativeServer:{id:'wco:'+episodeSlug,name:'Watch Cartoon Online',provider:'wco',type:'wco',embedUrl:'https://www.wcostream.tv/'+episodeSlug}});
const report={startedAt:new Date().toISOString(),api:base,providers,samples:[...samples.values()].map(s=>({...s,status:'pending'})),cases:[],complete:false};
const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(report,null,2));fs.renameSync(file+'.tmp',file)};save();
const json=async route=>{const r=await fetch(base+route,{signal:AbortSignal.timeout(45000)}),body=await r.json();if(!r.ok)throw Error(body.error||'Backend HTTP '+r.status);return body};
let next=0;await Promise.all(Array.from({length:2},async()=>{while(next<report.samples.length){const sample=report.samples[next++],start=Date.now();try{
 let servers;if(sample.nativeServer)servers=[sample.nativeServer];else{
  let id=sample.episodeId;if(!id){const detail=await json('/api/title?'+new URLSearchParams({id:sample.id}));sample.detailErrors=detail.providerErrors;sample.episodes=detail.episodes?.length||0;id=detail.episodes?.[0]?.id;if(!id&&detail.kind==='film')id=detail.id;}
  if(!id){sample.status='no_episode_links';sample.ms=Date.now()-start;save();continue;}sample.episodeId=id;
  const data=await json('/api/stream?'+new URLSearchParams({id,showId:sample.id,transport:'direct'}));servers=data.servers||[];sample.providerErrors=data.providerErrors;
 }
 sample.serverCount=servers.length;sample.status=servers.length?'resolved':'no_servers';
 for(const server of servers){if(/^frenchstream:premium:/i.test(server.id||''))throw Error('Premium slot advertised as public');const url=server.rawStreamUrl||server.streamUrl||server.embedUrl;let host=null;try{host=new URL(url).hostname}catch{}
 report.cases.push({case:report.cases.length+1,titleId:sample.id,episodeId:sample.episodeId,title:sample.title,kind:sample.kind,provider:sample.provider,serverProvider:server.provider,host,id:server.id,name:server.name,type:server.type,server});}
 }catch(error){sample.status='resolution_error';sample.error=error.message;}sample.ms=Date.now()-start;save();console.log(JSON.stringify({provider:sample.provider,title:sample.title,status:sample.status,servers:sample.serverCount,error:sample.error}));}}));
report.complete=true;report.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({samples:report.samples.length,providers:providers.length,routes:report.cases.length}));
