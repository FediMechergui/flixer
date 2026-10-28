// Single-writer source backfill; scheduled alongside, never during, another refresh.
import fs from 'node:fs';import path from 'node:path';
import {providerCache} from '../server/src/provider-sync.js';
import {writeJson} from '../server/src/store.js';
import {fetchAloulaPage,getAloulaDetails} from '../server/src/aloula.js';
import {fetchOfficialPage} from '../server/src/youtube-originals.js';
import {mergeShow} from '../server/src/merge-library.js';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback,dry=args.includes('--dry-run'),budget=Number(option('--pages','24'));
if(!Number.isSafeInteger(budget)||budget<1||budget>200)throw Error('Invalid official Arabic page budget');
const cache=dry?{items:[]}:providerCache('flixer'),items=new Map(cache.items.map(row=>[row.id,row])),before=items.size,coverage=cache.officialArabicCoverage||{},report={at:new Date().toISOString(),pages:[],errors:[],beforeRecords:before};
const jobs=[{key:'aloula:series',provider:'aloula',kind:'series'},{key:'watania:series',provider:'youtubeoriginals',kind:'series',collection:'tunisian'},{key:'watania:film',provider:'youtubeoriginals',kind:'film',collection:'tunisian'}],failed=new Set();let scanned=0;
while(scanned<budget){let progressed=false;
 for(const job of jobs){if(scanned>=budget)break;const state=coverage[job.key]||{nextPage:1};if(state.complete||failed.has(job.key))continue;progressed=true;
  try{const page=job.provider==='aloula'?await fetchAloulaPage({page:state.nextPage}):await fetchOfficialPage({...job,page:state.nextPage});
   if(page.partial)throw Error('Partial source page; retry cursor retained');
   for(const row of page.items){const old=items.get(row.id),added=!!old&&(row.episodes||[]).some(e=>!(old.episodes||[]).some(previous=>previous.id===e.id));items.set(row.id,{...(old?mergeShow(old,row):row),firstSeenAt:old?.firstSeenAt||report.at,contentUpdatedAt:added?report.at:old?.contentUpdatedAt||row.contentUpdatedAt});}
   coverage[job.key]={nextPage:state.nextPage+1,complete:!page.hasNext,checkedAt:new Date().toISOString(),sourceEntries:(state.sourceEntries||0)+page.items.length};
   const progress={source:job.key,page:state.nextPage,items:page.items.length,hasNext:page.hasNext};report.pages.push(progress);console.log(JSON.stringify(progress));
  }catch(error){failed.add(job.key);coverage[job.key]={...state,error:error.message,checkedAt:new Date().toISOString()};report.errors.push({source:job.key,error:error.message});console.log('[official-arabic]',job.key,error.message);}
  scanned++;
 }
 if(!progressed)break;
}
// Prewarm a few real guides; other programmes resolve their public source guide on opening.
for(const row of [...items.values()].filter(row=>row.channelId==='aloula'&&!row.episodes?.length).slice(0,4))try{items.set(row.id,{...mergeShow(row,await getAloulaDetails(row.id,{fresh:true})),episodesCheckedAt:report.at});}catch(error){report.errors.push({source:'aloula',id:row.id,error:error.message});}
report.sourceRows=[...items.values()].filter(row=>row.channelId==='aloula'||/^sp:youtubeoriginals:[sm]:watania-/.test(row.id));report.sourceRecords=report.sourceRows.length;report.sourceEpisodes=report.sourceRows.reduce((n,row)=>n+(row.episodes?.length||0),0);report.newRecords=items.size-before;report.coverage=coverage;
const output=path.resolve(option('--out','artifacts/official-arabic-import.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
if(!dry){cache.items=[...items.values()];cache.officialArabicCoverage=coverage;cache.lastRefreshAt=new Date().toISOString();writeJson('providers-flixer.json',cache);}
console.log('[official-arabic]',JSON.stringify({dry,sourceRecords:report.sourceRecords,sourceEpisodes:report.sourceEpisodes,newRecords:report.newRecords,coverage}));
