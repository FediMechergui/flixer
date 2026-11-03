import test from 'node:test';
import assert from 'node:assert/strict';
import {importStardima,STARDIMA_IMPORT_JOBS,stardimaPartitionKey} from '../src/stardima-import.js';

const sourceRow=job=>({id:`sp:stardima:${job.kind==='film'?'m':'s'}:video-${job.kind==='film'?1:2}`,title:job.kind==='film'?'A film':'A series',kind:job.kind,documentary:false,access:'public',tags:job.collection?['animation',...(job.collection==='anime'?['anime']:[])]:[],collections:['arabic',...(job.collection?[job.collection]:[])],episodes:[],offerings:[{provider:'stardima',id:`sp:stardima:${job.kind==='film'?'m':'s'}:video-${job.kind==='film'?1:2}`}]});
const complete=()=>Object.fromEntries(STARDIMA_IMPORT_JOBS.map(job=>[stardimaPartitionKey(job),{complete:true,nextPage:3}]));

test('StarDima backfill fairly traverses six source partitions with one request in flight and one batch checkpoint',async()=>{
  const untouched={id:'mf:m:keep',title:'Keep',kind:'film',episodes:[]},episode={id:'sp:stardima:m:video-1',title:'Full film',number:1,season:1,offerings:[{provider:'stardima',id:'sp:stardima:m:video-1'}]};
  const cache={items:[untouched,{...sourceRow(STARDIMA_IMPORT_JOBS[0]),episodes:[episode],synopsis:'Existing complete synopsis',providerUpdatedAt:'2025-01-01'}],queue:[],officialArabicCoverage:{kept:true}};
  let active=0,maximum=0,writes=0;
  const calls=[];
  const report=await importStardima(cache,{pages:6,delayMs:0,checkpoint:async()=>{writes++;},fetchPage:async job=>{calls.push(job);maximum=Math.max(maximum,++active);await new Promise(resolve=>setImmediate(resolve));active--;return {items:[sourceRow(job)],page:job.page,totalPages:2,hasNext:true};}});
  assert.equal(maximum,1);
  assert.equal(writes,1,'large provider cache is not written per page');
  assert.deepEqual(calls.map(stardimaPartitionKey),STARDIMA_IMPORT_JOBS.map(stardimaPartitionKey));
  assert.ok(calls.every(job=>job.latest===false&&job.page===1));
  assert.equal(cache.items.length,3,'overlapping category pages merge under the same source title');
  assert.equal(cache.items[0],untouched);
  assert.deepEqual(cache.items.find(row=>row.id===episode.id).episodes,[episode]);
  assert.equal(cache.items.find(row=>row.id===episode.id).synopsis,'Existing complete synopsis');
  assert.deepEqual(cache.officialArabicCoverage,{kept:true});
  assert.ok(Object.values(cache.stardimaCoverage.partitions).every(state=>state.nextPage===2&&!state.complete));
  assert.equal(report.complete,false);
  assert.equal(report.sourceRecords,2);
});

test('partial StarDima responses retain valid rows and the exact retry cursor while other partitions complete',async()=>{
  const ongoing={provider:'fmovies',kind:'film',page:27,cursor:'unchanged'};
  const cache={items:[],queue:[ongoing,{provider:'stardima',kind:'film',collection:'anime',page:1}]};
  const firstCalls=[];
  const first=await importStardima(cache,{pages:12,delayMs:0,fetchPage:async job=>{
    const key=stardimaPartitionKey(job);firstCalls.push(key);
    if(key==='series:all')throw Error('StarDima HTTP 503');
    return {items:[sourceRow(job)],page:job.page,totalPages:1,hasNext:false,...(key==='film:all'?{partial:true}:{})};
  }});
  assert.equal(first.requests,6,'a failed lane is not repeatedly polled during one run');
  assert.equal(first.errors.length,2);
  assert.equal(cache.stardimaCoverage.partitions['film:all'].nextPage,1);
  assert.equal(cache.stardimaCoverage.partitions['series:all'].nextPage,1);
  assert.ok(cache.items.some(row=>row.id==='sp:stardima:m:video-1'),'valid partial entries survive');
  assert.equal(cache.queue.length,1,'completed StarDima history is removed from the regular scan queue');
  assert.equal(cache.queue[0],ongoing);
  const retried=[];
  const second=await importStardima(cache,{pages:24,delayMs:0,fetchPage:async job=>{retried.push([stardimaPartitionKey(job),job.page]);return {items:[sourceRow(job)],page:job.page,totalPages:1,hasNext:false};}});
  assert.deepEqual(retried,[['film:all',1],['series:all',1]]);
  assert.equal(second.complete,true);
  assert.equal(cache.items.length,2);
});

test('backfill resumes the furthest saved StarDima cursor without rewinding another provider',async()=>{
  const coverage={version:1,partitions:complete()};coverage.partitions['series:anime']={nextPage:4,complete:false};
  const unrelated={provider:'hdtoday',kind:'film',page:40};
  const cache={items:[],stardimaCoverage:coverage,queue:[unrelated,{provider:'stardima',kind:'series',collection:'anime',page:8}]};
  const calls=[];
  await importStardima(cache,{pages:1,delayMs:0,fetchPage:async job=>{calls.push(job.page);return {items:[sourceRow(job)],page:job.page,totalPages:10,hasNext:true};}});
  assert.deepEqual(calls,[8]);
  assert.equal(cache.stardimaCoverage.partitions['series:anime'].nextPage,9);
  assert.equal(cache.queue[0],unrelated);
  assert.equal(cache.queue[1].page,9);
});

test('completed StarDima coverage makes later scheduled backfills a network-free no-op',async()=>{
  const cache={items:[],stardimaCoverage:{version:1,partitions:complete()},lastRefreshAt:'unchanged'};let writes=0;
  const result=await importStardima(cache,{fetchPage:()=>{throw Error('Must not fetch completed history');},checkpoint:async()=>{writes++;}});
  assert.equal(result.requests,0);assert.equal(result.complete,true);assert.equal(writes,0);assert.equal(cache.lastRefreshAt,'unchanged');
});

test('a source-wide denial stops all StarDima lanes and shares the existing provider cooldown',async()=>{
  const cache={items:[],queue:[],retryState:{hdtoday:{retryAt:'2027-01-01T00:00:00Z'}}};let requests=0,writes=0;
  const report=await importStardima(cache,{pages:600,delayMs:0,checkpoint:async()=>{writes++;},fetchPage:async()=>{requests++;throw Error('StarDima HTTP 403; cached data retained');}});
  assert.equal(requests,1);assert.equal(writes,1);assert.equal(report.complete,false);
  assert.equal(cache.stardimaCoverage.partitions['film:all'].nextPage,1);
  assert.equal(Object.keys(cache.stardimaCoverage.partitions).length,1,'unvisited cursors must remain unadvanced');
  assert.ok(Date.parse(cache.retryState.stardima.retryAt)>Date.now());
  assert.equal(cache.retryState.hdtoday.retryAt,'2027-01-01T00:00:00Z');
  const quiet=await importStardima(cache,{fetchPage:()=>{throw Error('Must respect saved cooldown');},checkpoint:async()=>{throw Error('No update needs writing');}});
  assert.equal(quiet.requests,0);assert.equal(quiet.coolingDown,true);
});

test('the source request deadline stops a hung backfill and persists its retry position',async()=>{
  const cache={items:[],queue:[]};let writes=0;
  const report=await importStardima(cache,{pages:1,delayMs:0,requestMs:10,maxMs:1000,checkpoint:async()=>{writes++;},fetchPage:()=>new Promise(()=>{})});
  assert.equal(report.requests,1);assert.equal(writes,1);
  assert.match(report.errors[0].error,/time budget/);
  assert.equal(cache.stardimaCoverage.partitions['film:all'].nextPage,1);
  assert.equal(report.complete,false);
});

test('malformed and foreign source records cannot silently advance StarDima coverage',async()=>{
  const cache={items:[],queue:[]};
  const result=await importStardima(cache,{pages:1,delayMs:0,fetchPage:async job=>({items:[sourceRow(job),{id:'mf:m:foreign',title:'Wrong source',kind:'film'}],page:job.page,totalPages:1,hasNext:false})});
  assert.equal(cache.items.length,1);
  assert.equal(cache.stardimaCoverage.partitions['film:all'].nextPage,1);
  assert.equal(cache.stardimaCoverage.partitions['film:all'].complete,false);
  assert.equal(result.errors.length,1);
});
