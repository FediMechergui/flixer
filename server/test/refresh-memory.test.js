import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync}from'node:child_process';
import {resolveProviderMatches}from'../src/provider-matches.js';

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
