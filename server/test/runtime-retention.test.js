import test from 'node:test';import assert from 'node:assert/strict';import {planRuntimeCleanup} from '../src/runtime-retention.js';
const now=Date.parse('2026-10-23T14:00:00Z'),name=n=>'data-'+n.toString(16).padStart(64,'0')+'.json.gz',file=n=>({name:name(n),sha256:n.toString(16).padStart(64,'0'),bytes:100});
const manifest=n=>({format:1,product:'flixer',generatedAt:'2026-10-23T13:00:00Z',count:1,indexParts:['index-0000'],files:{runtime:file(n),bootstrap:file(n+1),'index-0000':file(n+2)}});
const asset=(n,age=3600000)=>({id:n+1,name:name(n),created_at:new Date(now-age).toISOString()});

test('a full release makes room before upload while retaining both published and incoming generations',()=>{
 const assets=Array.from({length:1000},(_,n)=>asset(n)),incoming=[file(1001),file(1001),file(1002)];const plan=planRuntimeCleanup({assets,manifests:[manifest(0),manifest(10),manifest(20)],incoming,now});
 assert.equal(plan.projected,900);assert.equal(plan.remove.length,103);assert.ok(plan.remove.every(a=>![0,1,2,10,11,12,20,21,22].includes(a.id-1)));assert.ok(!plan.remove.some(a=>a.name===name(1001)));
});

test('orphan cleanup preserves unrelated APKs, manifests, recent assets and unknown ages',()=>{
 const keep=[{...asset(1),name:'flixer-v1.6.21.apk'},{...asset(2),name:'manifest.json'},{...asset(3),name:'manifest.previous.json'},asset(4,1000),{...asset(5),created_at:'unknown'}],old=Array.from({length:5},(_,n)=>asset(n+10));
 const plan=planRuntimeCleanup({assets:[...keep,...old],now,limit:10,headroom:2});assert.ok(plan.remove.length>0);assert.ok(plan.remove.every(a=>old.includes(a)));
});

test('insufficient safely reclaimable capacity fails before any deletion plan can execute',()=>{
 assert.throws(()=>planRuntimeCleanup({assets:Array.from({length:1000},(_,n)=>asset(n,1000)),incoming:[file(2000)],now}),/no safe upload capacity/);
 assert.throws(()=>planRuntimeCleanup({assets:[],manifests:[{format:1,product:'dahsha'}],now}),/manifest/);
});

test('partial failed uploads needed by the next publication survive cleanup, while old staging pointers can retire',()=>{
 const staged={id:200,name:'manifest.pending-1234.json',created_at:new Date(now-3600000).toISOString()};const plan=planRuntimeCleanup({assets:[staged,asset(1),asset(2),asset(3)],incoming:[file(1),file(10)],now,limit:6,headroom:3});
 assert.ok(!plan.remove.some(a=>a.name===name(1)));assert.ok(plan.remove.includes(staged));assert.equal(plan.projected,3);
 const small=planRuntimeCleanup({assets:[asset(1)],incoming:[file(1)],now});assert.equal(small.remove.length,0);assert.equal(small.projected,2);
});
