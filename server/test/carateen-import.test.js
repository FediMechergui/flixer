import test from 'node:test';
import assert from 'node:assert/strict';
import {importCarateen,alignCarateenQueue} from '../src/carateen-import.js';

const row=(kind,id)=>({id:`sp:carateen:${kind==='film'?'m':'s'}:tg-${id}`,kind,title:'Public source '+id,access:'public',documentary:false,episodes:[],offerings:[{provider:'carateen',id:`sp:carateen:${kind==='film'?'m':'s'}:tg-${id}`,availability:'unverified'}]});

test('Carateen imports the complete metadata snapshot once without fetching guides or manufacturing update dates',async()=>{
  const unrelated={id:'mf:m:kept',title:'Keep',kind:'film'},old={...row('film',11),firstSeenAt:'2025-01-01T00:00:00Z',contentUpdatedAt:'2025-03-01T00:00:00Z',episodes:[{id:'sp:carateen:e:tg-11:112',number:1,offerings:[]}]};
  const otherCursor={provider:'fmovies',kind:'film',page:19,cursor:'kept'};
  const cache={items:[unrelated,old],queue:[otherCursor,{provider:'carateen',kind:'film',page:7},{provider:'carateen',kind:'series',page:1}],stardimaCoverage:{kept:true},lastRefreshAt:'unchanged'};
  let reads=0,writes=0;const result=await importCarateen(cache,{checkpoint:async()=>writes++,fetchCatalogue:async options=>{reads++;assert.equal(options.fresh,true);return {items:[row('film',11),row('film',12),row('series',21),row('series',22)]};}});
  assert.equal(reads,1);assert.equal(writes,1);assert.equal(result.complete,true);assert.equal(result.snapshotReads,1);assert.equal(result.sourceRecords,4);assert.equal(result.newRecords,3);assert.equal(result.playbackVerified,false);
  assert.equal(cache.items[0],unrelated);assert.deepEqual(cache.stardimaCoverage,{kept:true});assert.equal(cache.lastRefreshAt,'unchanged');assert.deepEqual(cache.queue,[otherCursor]);
  const retained=cache.items.find(item=>item.id===old.id);assert.deepEqual(retained.episodes,old.episodes);assert.equal(retained.firstSeenAt,old.firstSeenAt);assert.equal(retained.contentUpdatedAt,old.contentUpdatedAt);
  const added=cache.items.find(item=>item.id==='sp:carateen:s:tg-21');assert.ok(added.firstSeenAt);assert.equal(added.contentUpdatedAt,undefined);assert.equal(added.providerUpdatedAt,undefined);assert.equal(added.offerings[0].availability,'unverified');
});

test('partial source snapshots retain valid metadata, existing titles and exact scan cursors',async()=>{
  const old=row('series',44),other={provider:'fmovies',kind:'film',page:19,cursor:'kept'},sourceCursor={provider:'carateen',kind:'series',page:7};
  const cache={items:[old],queue:[other,sourceCursor]};
  const first=await importCarateen(cache,{fetchCatalogue:async()=>({items:[row('film',11)],providerErrors:[{source:'sp',error:'Source unavailable'}]})});
  assert.equal(first.complete,false);assert.equal(first.errors.length,1);assert.equal(cache.items.length,2);assert.equal(cache.items[0],old);assert.deepEqual(cache.queue,[other,sourceCursor]);
  assert.equal(cache.carateenCoverage.complete,false);
  const second=await importCarateen(cache,{fetchCatalogue:async()=>({items:[row('film',12),row('series',22)]})});
  assert.equal(second.complete,true);assert.equal(cache.items.length,4);assert.deepEqual(cache.queue,[other]);
});

test('denied Carateen access stops the import and retains cached titles with a source cooldown',async()=>{
  const old=row('series',44),cache={items:[old],queue:[]};let reads=0,writes=0;
  const first=await importCarateen(cache,{fetchCatalogue:async()=>{reads++;throw Error('Carateen HTTP 403');},checkpoint:async()=>writes++});
  assert.equal(reads,1);assert.equal(writes,1);assert.equal(first.complete,false);assert.equal(first.newRecords,0);assert.equal(cache.items[0],old);assert.equal(cache.carateenCoverage.complete,false);assert.ok(cache.retryState.carateen);
  const second=await importCarateen(cache,{fetchCatalogue:async()=>{throw Error('Must respect cooldown');},checkpoint:async()=>writes++});
  assert.equal(second.coolingDown,true);assert.equal(second.snapshotReads,0);assert.equal(writes,1);
});

test('an explicit later snapshot refresh can add titles without repeating a historical crawl or changing original observation dates',async()=>{
  const old={...row('film',11),firstSeenAt:'2025-01-01T00:00:00Z'},cache={items:[old],queue:[],carateenCoverage:{version:1,complete:true}};
  const next=await importCarateen(cache,{fetchCatalogue:async()=>({items:[row('film',11),row('film',12)]})});
  assert.equal(next.snapshotReads,1);assert.equal(next.newRecords,1);assert.equal(cache.items[0].firstSeenAt,old.firstSeenAt);assert.equal(cache.items[1].contentUpdatedAt,undefined);
  assert.equal(alignCarateenQueue([{provider:'carateen',kind:'film',collection:'anime',page:2}],cache.carateenCoverage).length,1,'generic coverage does not pretend an independently tracked category scope was traversed');
});

test('empty, malformed and mismatched records cannot mark source history complete',async()=>{
  const old=row('series',44),cursor={provider:'carateen',kind:'series',page:7},empty={items:[old],queue:[cursor]};
  const failed=await importCarateen(empty,{fetchCatalogue:async()=>({items:[]})});
  assert.equal(failed.complete,false);assert.equal(failed.newRecords,0);assert.equal(empty.items[0],old);assert.equal(empty.queue[0],cursor);
  const invalid={items:[],queue:[]},result=await importCarateen(invalid,{fetchCatalogue:async()=>({items:[row('film',11),{...row('series',22),id:'http://127.0.0.1/private'}]})});
  assert.equal(result.complete,false);assert.equal(result.importedRecords,1);assert.equal(result.sourceRecords,1);assert.ok(result.errors.length);
  await assert.rejects(importCarateen({items:[]},{maxMs:180001}),/Invalid Carateen import options/);
});

test('a timed-out snapshot cannot write late results into the saved catalogue',async()=>{
  const old=row('series',44),cache={items:[old],queue:[]};let resolve,writes=0;
  const pending=new Promise(done=>resolve=done),result=await importCarateen(cache,{maxMs:10,fetchCatalogue:()=>pending,checkpoint:async()=>writes++});
  assert.equal(result.complete,false);assert.match(result.errors[0].error,/time budget/);assert.equal(writes,1);
  resolve({items:[row('film',11)]});await new Promise(done=>setImmediate(done));
  assert.deepEqual(cache.items,[old]);assert.equal(cache.carateenCoverage.complete,false);assert.equal(writes,1);
});
