import {getCarateenCatalogue,parseCarateenId} from './carateen.js';
import {mergeShow} from './merge-library.js';
import {nextProviderRetry,providerCoolingDown} from './provider-retry.js';

export function alignCarateenQueue(queue,coverage){
  return coverage?.version===1&&coverage.complete===true?queue.filter(job=>job.provider!=='carateen'||job.collection):queue;
}
function sourceTitle(row){const parsed=parseCarateenId(row?.id);return parsed&&parsed.type!=='e';}

// Carateen publishes two bounded full catalogue responses. Import their public
// metadata once; do not walk every title's guide or resolve any player here.
export async function importCarateen(cache,{maxMs=90000,fetchCatalogue=getCarateenCatalogue,checkpoint=async()=>{},now=Date.now}={}){
  if(!Array.isArray(cache?.items)||!Number.isFinite(maxMs)||maxMs<=0||maxMs>180000)throw Error('Invalid Carateen import options');
  const start=now(),at=new Date(start).toISOString(),items=new Map(cache.items.map(row=>[row.id,row]));
  const report={at,beforeRecords:items.size,snapshotReads:0,importedRecords:0,complete:false,playbackVerified:false,errors:[]};
  const finish=()=>({...report,elapsedMs:Math.max(0,now()-start),sourceRecords:[...items.values()].filter(sourceTitle).length,newRecords:items.size-report.beforeRecords,coverage:cache.carateenCoverage||null});
  if(providerCoolingDown(cache.retryState?.carateen,start))return {...finish(),coolingDown:true};
  let timer;
  try{
    report.snapshotReads=1;
    const result=await Promise.race([Promise.resolve().then(()=>fetchCatalogue({fresh:true})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Carateen import time budget reached')),maxMs);})]);
    if(!Array.isArray(result?.items)||!result.items.length||result.items.length>50000)throw Error('Empty or invalid Carateen catalogue snapshot; cached records retained');
    const valid=result.items.filter(row=>sourceTitle(row)&&['film','series'].includes(row.kind)&&typeof row.title==='string'&&row.title.trim()&&row.access==='public');
    const rows=[...new Map(valid.map(row=>[row.id,row])).values()];
    report.errors=(Array.isArray(result.providerErrors)?result.providerErrors:[]).map(row=>({provider:'carateen',error:String(row?.error||row?.message||row||'Source unavailable').slice(0,240)}));
    const partial=result.partial===true||valid.length!==result.items.length||report.errors.length>0;
    for(const row of rows){
      const old=items.get(row.id),merged=old?mergeShow(old,row):row;
      // Observation time is an Added date, never an invented release date.
      items.set(row.id,{...merged,firstSeenAt:old?.firstSeenAt||row.firstSeenAt||at});
    }
    report.importedRecords=rows.length;report.complete=!partial;
    if(partial&&!report.errors.length)report.errors.push({provider:'carateen',error:'Partial catalogue snapshot; existing records and scan cursors retained'});
    cache.items=[...items.values()];
    cache.carateenCoverage={version:1,complete:report.complete,checkedAt:new Date(now()).toISOString(),sourceRecords:rows.length,errors:report.errors};
    if(Array.isArray(cache.queue))cache.queue=alignCarateenQueue(cache.queue,cache.carateenCoverage);
    if(report.complete&&cache.retryState)delete cache.retryState.carateen;
  }catch(error){
    const message=String(error.message||error).slice(0,240);report.errors.push({provider:'carateen',error:message});
    cache.carateenCoverage={...cache.carateenCoverage,version:1,complete:false,checkedAt:new Date(now()).toISOString(),errors:report.errors};
    if(/HTTP (?:401|403|429)\b|verification required/i.test(message))cache.retryState={...cache.retryState,carateen:nextProviderRetry(cache.retryState?.carateen,message,now())};
  }finally{clearTimeout(timer);}
  // One atomic provider-cache checkpoint, including a denied source's reason.
  await checkpoint(cache);
  return finish();
}
