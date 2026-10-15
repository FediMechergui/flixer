import fs from 'node:fs';
import {fetchArabicPage,getArabicDetails,resolveArabicServers,ARABIC_PROVIDERS,collectArabicPages} from '../server/src/arabic-providers.js';
import {readJson,writeJson} from '../server/src/store.js';
import {mergeShow} from '../server/src/merge-library.js';

// Single writer: do not run alongside refresh-providers or another importer.
const args=process.argv.slice(2),value=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const budget=Number(value('--pages','30')),sampleCount=Number(value('--samples','2'));
const cache=readJson('providers-flixer.json',{}),items=new Map((cache.items||[]).map(r=>[r.id,r]));
const jobs=Object.keys(ARABIC_PROVIDERS).flatMap(provider=>(provider==='cinetimes'?['film']:['film','series']).map(kind=>({provider,kind,collection:['tuniflix','cimatn','streamtunisie','cinetimes'].includes(provider)?'tunisian':kind==='series'?'egyptian':'arabic'})));
jobs.push(...['arabic','turkish'].flatMap(collection=>['film','series'].map(kind=>({provider:'tuniflix',kind,collection}))),{provider:'streamtunisie',kind:'series',collection:'arabic'},{provider:'kirmalk',kind:'film',collection:'plays'});
const key=j=>[j.provider,j.kind,j.collection].join(':');
const coverage=cache.arabicCoverage||{},report={at:new Date().toISOString(),pages:[],playback:[],coverage};
delete coverage['egydead:film:plays'];
for(const job of jobs){const id=key(job),state=coverage[id];if(args.includes('--rescan')||state?.complete&&Date.now()-Date.parse(state.checkedAt||0)>7*86400000)coverage[id]={nextPage:1,sourceEntries:0,pages:0,complete:false};}
const put=row=>{const old=items.get(row.id);items.set(row.id,{...(old?mergeShow(old,row):row),firstSeenAt:old?.firstSeenAt||report.at});};
const save=()=>{cache.items=[...items.values()];cache.arabicCoverage=coverage;cache.lastRefreshAt=new Date().toISOString();writeJson('providers-flixer.json',cache);fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/arabic-audit.json',JSON.stringify(report,null,2));};
if(args.includes('--crawl')){
  let scanned=0;const failed=new Set();
  while(scanned<budget){
    const pending=jobs.filter(j=>!coverage[key(j)]?.complete&&!failed.has(key(j)));if(!pending.length)break;
    for(let offset=0;offset<pending.length&&scanned<budget;offset+=2){
      const batch=[];
      for(const job of pending.slice(offset,offset+2)){
        const state=coverage[key(job)]||{nextPage:1};
        const count=Math.min(4,Math.max(1,(state.totalPages||state.nextPage)-state.nextPage+1),budget-scanned-batch.length);
        for(let n=0;n<count;n++)batch.push({...job,page:state.nextPage+n});
      }
      const results=await collectArabicPages(batch,async j=>{const start=performance.now();return {result:await fetchArabicPage(j),ms:Math.round(performance.now()-start)};});
      results.forEach((response,index)=>{
        const j=batch[index],id=key(j);
        if(response.status==='rejected'){failed.add(id);coverage[id]={...(coverage[id]||{nextPage:1,sourceEntries:0,pages:0}),complete:false,error:response.reason.message};console.log(`${id}: ${response.reason.message}`);return;}
        const {result,ms}=response.value;
        result.items.forEach(put);
        const state=coverage[id]||{nextPage:1,sourceEntries:0,pages:0};
        if(failed.has(id)||j.page!==state.nextPage)return;
        const fingerprint=result.sourceFingerprint||result.items.map(r=>r.id).sort().join('|');
        if(state.nextPage>1&&fingerprint&&fingerprint===state.fingerprint){failed.add(id);coverage[id]={...state,complete:false,error:'Repeated listing page; cursor retained'};return;}
        coverage[id]={nextPage:state.nextPage+1,totalPages:result.totalPages,sourceEntries:state.sourceEntries+result.items.length,pages:state.pages+1,complete:!result.hasNext&&!result.incomplete,fingerprint,unavailablePosts:(state.unavailablePosts||0)+(result.unavailablePosts||0),checkedAt:new Date().toISOString()};
        const entry={...j,items:result.items.length,totalPages:result.totalPages,ms};report.pages.push(entry);console.log(JSON.stringify(entry));
      });
      scanned+=batch.length;save();
      await new Promise(resolve=>setTimeout(resolve,300));
    }
  }
}
for(const provider of Object.keys(ARABIC_PROVIDERS))for(const kind of provider==='cinetimes'?['film']:['film','series']){
  const rows=[...items.values()].filter(r=>r.channelId===provider&&r.kind===kind);
  const selected=[...new Map(Array.from({length:Math.min(sampleCount,rows.length)},(_,i)=>{const row=rows[Math.floor(i*(rows.length-1)/Math.max(1,sampleCount-1))];return [row.id,row];})).values()];
  for(const row of selected){
    const start=performance.now();let result={provider,kind,id:row.id,title:row.title};
    try{
      const detail=await getArabicDetails(row.id,{fresh:true});detail.detailsFetchedAt=new Date().toISOString();
      const episodes=[...new Map([detail.episodes[0],detail.episodes.at(-1)].filter(Boolean).map(e=>[e.id,e])).values()];
      const servers=await Promise.allSettled(episodes.map(async e=>{const choices=await resolveArabicServers(e.id,{fresh:true});e.cachedPlayers=choices;return {id:e.id,servers:choices.length,types:[...new Set(choices.map(s=>s.type))]};}));
      result={...result,episodes:detail.episodes.length,episodesComplete:detail.episodesComplete!==false,poster:!!detail.portrait,synopsis:!!detail.synopsis,players:servers.map(r=>r.status==='fulfilled'?r.value:{error:r.reason.message})};put(detail);
    }catch(error){result.error=error.message;}
    result.ms=Math.round(performance.now()-start);report.playback.push(result);console.log(JSON.stringify(result));save();
  }
}
console.log(JSON.stringify({completed:Object.values(coverage).filter(s=>s.complete).length,partitions:jobs.length,sourceRecords:items.size,report:'artifacts/arabic-audit.json'}));
