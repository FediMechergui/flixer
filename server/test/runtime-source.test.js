import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import vm from 'node:vm';
import {buildRuntimePublication} from '../src/runtime-publication.js';import {createRuntimeSource,validateRuntimeManifest} from '../src/runtime-source.js';
const catalog=(day,episodes=1)=>({product:'flixer',generatedAt:`2026-10-${day}T12:00:00Z`,shows:[{id:'fm:s:22',title:'Example',kind:'series',offerings:[{provider:'fmovies',id:'fm:s:22'},{provider:'myflixer',id:'mf:s:example'}],episodes:Array.from({length:episodes},(_,i)=>({id:`fm:e:22:1:${i+1}`,title:'Episode '+(i+1),season:1,number:i+1,offerings:[{provider:'fmovies',id:`fm:e:22:1:${i+1}`}]})),versions:[{id:'hd:s:tv-example-abc12345',title:'Example alternate',kind:'series',episodes:[{id:'hd:s:tv-example-abc12345:1:3',number:3,season:1}]}]}]});

test('published runtime retains catalogue identities, real guides, version owners and bounded client parts',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-runtime-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const manifest=await buildRuntimePublication(catalog('22',3),dir);
 assert.equal(manifest.count,1);validateRuntimeManifest(manifest);
 const read=key=>JSON.parse(gunzipSync(fs.readFileSync(path.join(dir,manifest.files[key].name))));
 assert.equal(read('runtime').shows[0].episodes,undefined);assert.equal(read('runtime').packedTitles,true);
 const index=read(manifest.indexParts[0]);assert.ok(index.shows[0].aliasIds.includes('mf:s:example'));assert.equal(index.shows[0].firstEpisodeId,'fm:e:22:1:1');
 for(const key of [...manifest.indexParts,'bootstrap'])assert.ok(gunzipSync(fs.readFileSync(path.join(dir,manifest.files[key].name))).length<2*1024*1024);
 const titleKey='title-'+(parseInt(createHash('sha256').update('fm:s:22').digest('hex').slice(0,2),16)&252).toString(16).padStart(2,'0');assert.equal(read(titleKey)['fm:s:22'].episodes.length,3);
 const owner='owner-'+(parseInt(createHash('sha256').update('hd:s:tv-example-abc12345:1:3').digest('hex').slice(0,2),16)&252).toString(16).padStart(2,'0');assert.equal(read(owner)['hd:s:tv-example-abc12345:1:3'].id,'hd:s:tv-example-abc12345');
});

test('runtime refresh is bounded, deduplicated and atomic; clients can finish a pinned older index',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-runtime-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const first=await buildRuntimePublication(catalog('22'),dir),second=await buildRuntimePublication(catalog('23',2),dir);let current=first,time=1,requests=0,manifestRequests=0;
 const source=createRuntimeSource({now:()=>time,log:()=>{},fetchImpl:async url=>{requests++;const name=url.split('/').pop().split('?')[0];if(name==='manifest.json'){manifestRequests++;return new Response(JSON.stringify(current))}return new Response(fs.readFileSync(path.join(dir,name)))}});
 await Promise.all([source.check(),source.check()]);assert.equal(requests,1,'part endpoints only need the manifest');assert.equal(source.current(),null);
 await Promise.all([source.refresh(),source.refresh()]);assert.equal(manifestRequests,1);assert.equal(source.current().generatedAt,first.generatedAt);assert.equal((await source.title('fm:s:22')).episodes.length,1);
 time+=120001;current=second;await source.check();assert.equal(source.current().generatedAt,first.generatedAt,'metadata checks cannot partially replace the active library');assert.equal((await source.publishedTitle('fm:s:22')).episodes.length,2,'single-title requests can read the new pack without downloading the entire index');
 const oldIndex=await source.part(first.indexParts[0],first.files[first.indexParts[0]].sha256);assert.equal(oldIndex.shows[0].id,'fm:s:22');
 await source.refresh();assert.equal((await source.episode('fm:e:22:1:2')).episodes.length,2);assert.equal(source.current().generatedAt,second.generatedAt);
 time+=120001;current=first;await source.refresh();assert.equal(source.current().generatedAt,second.generatedAt,'older manifests cannot roll back live data');
 current={...second,generatedAt:'2026-10-24T12:00:00Z',files:{...second.files,runtime:{...second.files.runtime,sha256:'f'.repeat(64),name:'data-'+ 'f'.repeat(64)+'.json.gz'}}};time+=120001;
 await source.refresh();assert.equal(source.current().generatedAt,second.generatedAt);const before=requests;await source.refresh();assert.equal(requests,before,'a failed update cannot trigger a request storm');
});

test('runtime assets reject corruption, oversized warm-cache reads and untrusted manifest names',async()=>{
 const body=gzipSync(JSON.stringify({text:'x'.repeat(1000)})),sha=createHash('sha256').update(body).digest('hex');let corrupt=false;
 const source=createRuntimeSource({fetchImpl:async()=>new Response(corrupt?Buffer.from('not gzip'):body)});
 await source.readHash(sha,2000);await assert.rejects(source.readHash(sha,100),/large/);
 await assert.rejects(source.readHash('../private'),/hash/);corrupt=true;await assert.rejects(source.readHash('f'.repeat(64),2000),/integrity/);
 assert.throws(()=>validateRuntimeManifest({format:1,product:'dahsha'}));
});

test('mobile live index pins every chunk to a manifest and rejects partial generations',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=source.indexOf('    async _loadLiveIndex()'),end=source.indexOf('    /* ----- index ----- */',start);assert.ok(start>0&&end>start);
 let bad=false;const seen=[],context=vm.createContext({API_BASE:'https://backend.example',URLSearchParams,Promise,getJson:async url=>{const u=new URL(url);seen.push(u.searchParams);if(u.searchParams.get('part')==='manifest')return {body:{product:'flixer',generatedAt:'new',count:2,indexParts:[{key:'index-0000',sha256:'abc'},{key:'index-0001',sha256:'def'}]}};return {body:{product:'flixer',generatedAt:bad?'old':'new',shows:[{id:u.searchParams.get('part')}]}};}});
 vm.runInContext('globalThis.api=new(class{'+source.slice(start,end)+'})();',context);const result=await context.api._loadLiveIndex();assert.equal(result.body.shows.length,2);assert.equal(seen[1].get('hash'),'abc');assert.equal(seen[2].get('hash'),'def');bad=true;context.api._liveIndexParts=new Map();await assert.rejects(context.api._loadLiveIndex(),/generation/);
});

test('a new publication reuses unchanged mobile index chunks',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=source.indexOf('    async _loadLiveIndex()'),end=source.indexOf('    /* ----- index ----- */',start);let generation='one',parts=0;
 const context=vm.createContext({API_BASE:'https://backend.example',URLSearchParams,Promise,getJson:async url=>{const u=new URL(url);if(u.searchParams.get('part')==='manifest')return {body:{product:'flixer',generatedAt:generation,count:1,indexParts:[{key:'index-0000',sha256:'unchanged'}]}};parts++;return {body:{product:'flixer',shows:[{id:'retained'}]}};}});
 vm.runInContext('globalThis.api=new(class{'+source.slice(start,end)+'})();',context);await context.api._loadLiveIndex();generation='two';const updated=await context.api._loadLiveIndex();assert.equal(parts,1);assert.equal(updated.body.generatedAt,'two');assert.equal(updated.body.shows[0].id,'retained');
});

test('catalogue reordering and a new title leave unrelated published buckets unchanged',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-runtime-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const first=catalog('22');first.shows=Array.from({length:300},(_,i)=>({...first.shows[0],id:'fm:s:'+i,episodes:[],versions:[]}));
 const before=await buildRuntimePublication(first,dir),after=await buildRuntimePublication({...first,generatedAt:'2026-10-23T12:00:00Z',shows:[{id:'fm:m:new',title:'New film',kind:'film',episodes:[]},...first.shows.toReversed()]},dir);
 const changed=Object.entries(before.files).filter(([key,file])=>/^(index|title|owner)-/.test(key)&&after.files[key]?.sha256!==file.sha256);
 assert.ok(changed.length<=2,'only the new title index and title buckets should change');assert.equal(after.count,301);
});

test('Android reads verified published data and guides without a backend deployment',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-runtime-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const manifest=await buildRuntimePublication(catalog('23',3),dir),calls=[];
 const window={FLIXER_CONFIG:{mobile:true},Capacitor:{isNativePlatform:()=>true}},context=vm.createContext({window,crypto,Blob,TextEncoder,TextDecoder,Uint8Array,DecompressionStream,AbortController,setTimeout,clearTimeout,URL,fetch:async url=>{calls.push(url);const name=url.split('/').pop().split('?')[0];return new Response(name==='manifest.json'?JSON.stringify(manifest):fs.readFileSync(path.join(dir,name)))}});
 vm.runInContext(fs.readFileSync(new URL('../../client-terrarium/js/catalogue-source.js',import.meta.url),'utf8'),context);const source=window.FlixerCatalogueSource;
 assert.equal(source.enabled(),true);const [a,b]=await Promise.all([source.get(),source.get()]);assert.equal(a.generatedAt,b.generatedAt);assert.equal(calls.length,1);
 assert.equal((await source.get(manifest.indexParts[0])).shows.length,1);const title=await source.title('fm:s:22');assert.equal(title.episodes.length,3);assert.ok(calls.every(url=>url.startsWith('https://github.com/FediMechergui/flixer/releases/download/catalogue-runtime/')));
 await assert.rejects(source.get('../private'),/Unknown/);await assert.rejects(source.get(manifest.indexParts[0],'../private'),/hash/);
 const key=manifest.indexParts[0],hash=manifest.files[key].sha256;
 context.fetch=async()=>new Response('corrupt');await assert.rejects(source.get(key,'f'.repeat(64)),/integrity/);
 const bomb=gzipSync(JSON.stringify({text:'x'.repeat(3*1024*1024)})),bombHash=createHash('sha256').update(bomb).digest('hex');context.fetch=async()=>new Response(bomb);await assert.rejects(source.get(key,bombHash),/limit/);
 assert.equal((await source.get(key,hash)).shows.length,1,'a failed asset must preserve verified cached data');
});

test('Android background sync uses publication data without crawling providers on every phone',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=source.indexOf('    async sync()'),end=source.indexOf('    async _refreshSnapshot()',start),events=[];
 const context=vm.createContext({window:{FlixerCatalogueSource:{enabled:()=>true},dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},getJson:()=>{throw Error('Unexpected backend request')},Date,Math});
 vm.runInContext('globalThis.api=new(class{'+source.slice(start,end)+'})();',context);const api=context.api;api._catalog={shows:[]};api._refreshSnapshot=async()=>api._catalog.shows.push({id:'new'});
 assert.equal(await api.sync(),1);assert.equal(api._syncing,false);assert.equal(events.at(-1).detail.ok,true);
 api._refreshSnapshot=async()=>{throw Error('Publication unavailable')};await assert.rejects(api.sync(),/Publication unavailable/);assert.equal(events.at(-1).detail.ok,false);assert.equal(api._syncing,false);
});

test('live index retries a transient part failure and retains verified chunks across failed updates',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=source.indexOf('    async _loadLiveIndex()'),end=source.indexOf('    /* ----- index ----- */',start),calls=new Map();let broken=false;
 const context=vm.createContext({API_BASE:'https://backend.example',URLSearchParams,Promise,setTimeout,Map,getJson:async url=>{const u=new URL(url),part=u.searchParams.get('part');if(part==='manifest')return {body:{product:'flixer',generatedAt:'new',count:2,indexParts:[{key:'index-0000',sha256:'one'},{key:'index-0001',sha256:'two'}]}};calls.set(part,(calls.get(part)||0)+1);if(part==='index-0001'&&(broken||calls.get(part)===1))throw Error('Temporary network failure');return {body:{product:'flixer',shows:[{id:part}]}};}});
 vm.runInContext('globalThis.api=new(class{'+source.slice(start,end)+'})();',context);assert.equal((await context.api._loadLiveIndex()).body.shows.length,2);assert.equal(calls.get('index-0001'),2);
 context.api._liveIndexParts.delete('two');broken=true;await assert.rejects(context.api._loadLiveIndex(),/network/);assert.equal(context.api._liveIndexParts.has('one'),true);broken=false;assert.equal((await context.api._loadLiveIndex()).body.shows.length,2);assert.equal(calls.get('index-0000'),1,'successful chunks must not download again after a failed update');
});

test('provider packs preserve original French and Arabic episode players independently of merged identities',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-source-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const row={id:'sp:dessinanime:s:sample',title:'Dessin',kind:'series',episodes:[{id:'sp:dessinanime:e:sample:1:1',cachedPlayers:[{id:42,language:'VF',name:'Public player'}]}]};const manifest=await buildRuntimePublication(catalog('23'),dir,{providerRows:[row]});
 validateRuntimeManifest(manifest);assert.ok(Object.keys(manifest.providerFiles).length>0);
 const source=createRuntimeSource({fetchImpl:async url=>{const name=new URL(url).pathname.split('/').pop();return new Response(name==='manifest.json'?JSON.stringify(manifest):fs.readFileSync(path.join(dir,name)))}});await source.check();const found=await source.providerSnapshot(row.episodes[0].id);assert.equal(found.id,row.id);assert.equal(found.episodes[0].cachedPlayers[0].id,42);assert.equal(source.current(),null,'source playback metadata must not require the full catalogue');assert.equal(await source.providerSnapshot('sp:dessinanime:s:unknown'),null);
});
