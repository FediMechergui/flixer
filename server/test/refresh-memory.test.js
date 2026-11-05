import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync}from'node:child_process';
import {resolveProviderMatches,identityRecord}from'../src/provider-matches.js';
import {mergeLibrary}from'../src/merge-library.js';
import {leanCatalog,leanShow}from'../src/export-catalog.js';

test('zero identity-match budget skips catalogue traversal and cache reads',async()=>{
 const base=new Proxy({},{get(){throw Error('Disabled matching accessed the catalogue')}});
 assert.deepEqual(await resolveProviderMatches(base,'flixer',{limit:0}),{});
});

test('provider merge uses the supplied refreshed cache instead of rereading the saved archive',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-refresh-'));
 try{
  fs.writeFileSync(path.join(dir,'providers-flixer.json'),JSON.stringify({items:[{id:'old',kind:'film',title:'Stale disk title'}],queue:[]}));
  const result=spawnSync(process.execPath,['--input-type=module','-e',`import{mergeCachedProviders}from'./server/src/provider-sync.js';const base={shows:[{id:'base',kind:'film',title:'Base film',episodes:[]}]};const cache={items:[{id:'fresh',kind:'film',title:'Fresh source film',episodes:[]}],queue:[],lastRefreshAt:'2026-10-21T00:00:00Z',completed:true,errors:{}};const r=mergeCachedProviders(base,'flixer',{cache});console.log(JSON.stringify({ids:r.catalog.shows.map(s=>s.id),sync:r.catalog.providerSync,baseIds:base.shows.map(s=>s.id)}));`],{cwd:new URL('../../',import.meta.url),env:{...process.env,DATA_DIR:dir},encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);
  assert.deepEqual(data.ids,['base','fresh']);assert.deepEqual(data.baseIds,['base']);assert.equal(data.sync.sourceRecords,1);assert.equal(data.sync.lastRefreshAt,'2026-10-21T00:00:00Z');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('large catalogue exports complete within a small heap without serializing the entire array',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-export-memory-'));
 try{
  const result=spawnSync(process.execPath,['--max-old-space-size=64','--input-type=module','-e',`import fs from'node:fs';import path from'node:path';import{writeCatalog}from'./server/src/export-catalog.js';const title='ع'.repeat(12000);const shows=Array.from({length:3000},(_,i)=>({id:'fm:m:'+i,kind:'film',title:'Film '+i,episodes:[{id:'fm:m:'+i,title}]}));const out=process.env.TEST_EXPORT_DIR;writeCatalog(out,{generatedAt:'2026-10-21',shows},'flixer',{titleFiles:false});console.log(JSON.stringify({bytes:fs.statSync(path.join(out,'catalog.json')).size,items:JSON.parse(fs.readFileSync(path.join(out,'index.json'))).shows.length}));`],{cwd:new URL('../../',import.meta.url),env:{...process.env,TEST_EXPORT_DIR:dir},encoding:'utf8',timeout:30000,windowsHide:true});
  assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);assert.equal(data.items,3000);assert.ok(data.bytes>64*1024*1024);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('owned streamed merge preserves matching, episodes, uncertain editions and documentary exclusions',()=>{
 const episode={id:'old-episode',season:1,number:1,title:'Original',cachedPlayers:[{id:'original-player'}]};
 const base={shows:[{id:'base',title:'A series',kind:'series',year:2024,episodes:[episode]},{id:'uncertain',title:'Uncertain',kind:'series',episodes:[]}]};
 const rows=[{id:'source',title:'A series',kind:'series',year:2024,episodes:[{id:'new-source-one',season:1,number:1,title:'Original',offerings:[{provider:'fmovies',id:'new-source-one'}]},{id:'new-source-two',season:2,number:1,title:'New season'}]},{id:'edition',title:'Uncertain',kind:'series',episodes:[{id:'edition-episode',season:1,number:1}]}];
 const original=structuredClone(base),expected=mergeLibrary(base,rows),owned=structuredClone(base);
 function* streamed(){yield* structuredClone(rows);}
 const actual=mergeLibrary(owned,streamed(),{consume:true});
 assert.deepEqual(actual,expected);assert.deepEqual(base,original);assert.equal(actual.catalog.shows,owned.shows);
 assert.equal(actual.catalog.shows[0].episodes[0].id,'old-episode');assert.equal(actual.catalog.shows[0].episodes[1].season,2);
 assert.equal(actual.catalog.shows[1].versions[0].episodes[0].id,'edition-episode');
 assert.equal(mergeLibrary({shows:[]},streamed(),{consume:true,product:'dahsha'}).catalog.shows.length,0);
});

test('metadata-only identity records cannot retain episode/player graphs',()=>{
 const full={id:'one',title:'A show',year:2024,kind:'series',offerings:[{id:'source',provider:'fmovies'}],episodes:[{id:'episode',cachedPlayers:[{id:'player'}]}],versions:[{id:'edition',title:'A show',kind:'series',episodes:[{id:'edition-episode'}]}]};
 const identity=identityRecord(full);assert.equal(identity.episodes,undefined);assert.equal(identity.versions[0].episodes,undefined);assert.equal(identity.offerings[0].id,'source');
 const {episodes,...oldLean}=leanCatalog({shows:[full]},'flixer').shows[0];
 const {episodes:omitted,...newLean}=leanShow(full,{episodes:false});assert.equal(omitted,undefined);assert.deepEqual(newLean,oldLean);
});

test('streamed cache merge retains trailing sync metadata and applies reviewed source identities',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-stream-merge-'));
 try{
  fs.writeFileSync(path.join(dir,'providers-flixer.json'),JSON.stringify({items:[{id:'source',kind:'film',title:'Source spelling',episodes:[{id:'source',cachedPlayers:[{id:7}]}]}],queue:[{page:3}],completed:false,lastRefreshAt:'2026-11-05T00:00:00Z',errors:{hdtoday:'HTTP 429'}}));
  fs.writeFileSync(path.join(dir,'provider-identities-flixer.json'),JSON.stringify({source:{metadata:{title:'Reviewed title',year:2024}}}));
  const result=spawnSync(process.execPath,['--input-type=module','-e',`import{mergeCachedProviders}from'./server/src/provider-sync.js';const result=mergeCachedProviders({shows:[]},'flixer',{stream:true,consume:true});console.log(JSON.stringify(result.catalog));`],{cwd:new URL('../../',import.meta.url),env:{...process.env,DATA_DIR:dir},encoding:'utf8',timeout:15000,windowsHide:true});
  assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);assert.equal(data.shows[0].title,'Reviewed title');assert.equal(data.shows[0].episodes[0].cachedPlayers[0].id,7);assert.equal(data.providerSync.sourceRecords,1);assert.equal(data.providerSync.remainingPartitions,1);assert.equal(data.providerSync.errors.hdtoday,'HTTP 429');assert.equal(data.generatedAt,'2026-11-05T00:00:00Z');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
