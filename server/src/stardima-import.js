import {fetchStardimaPage,parseStardimaId} from './stardima.js';
import {mergeShow} from './merge-library.js';
import {nextProviderRetry,providerCoolingDown} from './provider-retry.js';

export const stardimaPartitionKey=job=>`${job.kind}:${job.collection||'all'}`;
export const STARDIMA_IMPORT_JOBS=['','cartoons','anime'].flatMap(collection=>['film','series'].map(kind=>({provider:'stardima',kind,collection})));
const validPage=value=>Number.isSafeInteger(value)&&value>=1&&value<=10000;

export function alignStardimaQueue(queue,coverage){
  return queue.flatMap(job=>{
    if(job.provider!=='stardima')return [job];
    const progress=coverage?.partitions?.[stardimaPartitionKey(job)];
    if(progress?.complete)return [];
    return validPage(progress?.nextPage)&&progress.nextPage>(job.page||1)?[{...job,page:progress.nextPage}]:[job];
  });
}

// One bounded source request at a time. The caller owns the atomic snapshot
// writer; no provider catalogue is rewritten for each individual source page.
export async function importStardima(cache,{pages=24,maxMs=12*60000,requestMs=10000,delayMs=250,checkpointEvery=50,fetchPage=fetchStardimaPage,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),checkpoint=async()=>{},log=()=>{}}={}){
  if(!Array.isArray(cache?.items)||!Number.isInteger(pages)||pages<1||pages>600||!Number.isFinite(maxMs)||maxMs<=0||!Number.isInteger(checkpointEvery)||checkpointEvery<1)throw Error('Invalid StarDima import options');
  const start=now(),deadline=start+maxMs,at=new Date(start).toISOString(),items=new Map(cache.items.map(row=>[row.id,row]));
  const coverage=cache.stardimaCoverage?.version===1?structuredClone(cache.stardimaCoverage):{version:1,partitions:{}};
  coverage.partitions||={};
  const failed=new Set(),report={at,pages:[],errors:[],beforeRecords:items.size,complete:false};
  if(providerCoolingDown(cache.retryState?.stardima,start))return {...report,requests:0,elapsedMs:0,budgetReached:false,coolingDown:true,coverage,complete:STARDIMA_IMPORT_JOBS.every(job=>coverage.partitions[stardimaPartitionKey(job)]?.complete),sourceRecords:[...items.values()].filter(row=>parseStardimaId(row.id)).length,newRecords:0};
  let requests=0,dirty=false,lastCheckpoint=0;
  const flush=async()=>{
    if(!dirty)return;
    cache.items=[...items.values()];cache.stardimaCoverage=coverage;cache.lastRefreshAt=new Date(now()).toISOString();
    if(Array.isArray(cache.queue))cache.queue=alignStardimaQueue(cache.queue,coverage);
    await checkpoint(cache);dirty=false;lastCheckpoint=requests;
  };
  try{
    while(requests<pages&&now()<deadline){
      let progressed=false;
      const startIndex=Math.max(-1,STARDIMA_IMPORT_JOBS.findIndex(job=>stardimaPartitionKey(job)===coverage.lastKey));
      for(let offset=1;offset<=STARDIMA_IMPORT_JOBS.length&&requests<pages&&now()<deadline;offset++){
        const job=STARDIMA_IMPORT_JOBS[(startIndex+offset)%STARDIMA_IMPORT_JOBS.length],key=stardimaPartitionKey(job),previous=coverage.partitions[key]||{nextPage:1};
        if(previous.complete||failed.has(key))continue;
        const active=cache.queue?.find(row=>row.provider==='stardima'&&stardimaPartitionKey(row)===key);
        const page=Math.max(validPage(previous.nextPage)?previous.nextPage:1,validPage(active?.page)?active.page:1);
        progressed=true;requests++;coverage.lastKey=key;
        let timer;
        try{
          const remaining=deadline-now();if(remaining<=0)break;
          const result=await Promise.race([Promise.resolve().then(()=>fetchPage({...job,page,latest:false})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('StarDima import request time budget reached')),Math.max(1,Math.min(requestMs,remaining)));})]);
          if(!Array.isArray(result?.items)||result.page!==page||!validPage(result.totalPages)||result.totalPages<page)throw Error('Invalid StarDima import page');
          const rows=result.items.filter(row=>{const parsed=parseStardimaId(row.id);return parsed&&parsed.type!=='e'&&row.kind===job.kind&&typeof row.title==='string'&&row.title.trim()&&row.access==='public';});
          for(const row of rows){const old=items.get(row.id);items.set(row.id,{...(old?mergeShow(old,row):row),firstSeenAt:old?.firstSeenAt||at,providerUpdatedAt:old?.providerUpdatedAt||row.providerUpdatedAt||at});}
          const partial=result.partial===true||rows.length!==result.items.length,more=typeof result.hasNext==='boolean'?result.hasNext:page<result.totalPages;
          coverage.partitions[key]={nextPage:partial?page:page+1,complete:!partial&&!more,checkedAt:new Date(now()).toISOString(),totalPages:result.totalPages,sourceEntries:(previous.sourceEntries||0)+(partial?0:rows.length),...(partial?{error:'Partial source page; retry cursor retained'}:{})};
          if(partial){failed.add(key);report.errors.push({source:key,error:'Partial source page; retry cursor retained'});}
          const progress={source:key,page,items:rows.length,hasNext:more,partial};report.pages.push(progress);log(progress);dirty=true;
        }catch(error){
          const message=String(error.message||error).slice(0,240);failed.add(key);coverage.partitions[key]={...previous,nextPage:page,complete:false,error:message,checkedAt:new Date(now()).toISOString()};report.errors.push({source:key,error:message});dirty=true;log({source:key,page,error:message});
          if(/HTTP (?:401|403|429)\b|verification required/i.test(message)){
            for(const other of STARDIMA_IMPORT_JOBS)failed.add(stardimaPartitionKey(other));
            cache.retryState={...cache.retryState,stardima:nextProviderRetry(cache.retryState?.stardima,message,now())};
          }
        }finally{clearTimeout(timer);}
        if(requests-lastCheckpoint>=checkpointEvery)await flush();
        if(delayMs>0&&requests<pages&&now()<deadline)await sleep(Math.min(delayMs,Math.max(0,deadline-now())));
      }
      if(!progressed)break;
    }
  }finally{await flush();}
  report.requests=requests;report.elapsedMs=Math.max(0,now()-start);report.budgetReached=requests>=pages||now()>=deadline;
  report.coverage=coverage;report.complete=STARDIMA_IMPORT_JOBS.every(job=>coverage.partitions[stardimaPartitionKey(job)]?.complete);
  report.sourceRecords=[...items.values()].filter(row=>parseStardimaId(row.id)).length;
  report.newRecords=items.size-report.beforeRecords;
  return report;
}
