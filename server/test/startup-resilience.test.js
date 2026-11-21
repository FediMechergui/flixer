import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8');
const base='https://backend.test';
const snapshot={product:'flixer',generatedAt:'2026-11-20T12:00:00Z',shows:[{id:'fm:m:1',kind:'film',title:'Saved title'}]};
function client({fetchImpl,cached,direct}={}){
  const calls=[],storage=new Map(cached?[['flixer:homeSnapshot',JSON.stringify(cached)]]:[]);
  const context=vm.createContext({window:{FLIXER_CONFIG:{mobile:true,dataBase:base,apiBase:base,live:false},FlixerCatalogueSource:direct,FlixerTvMaze:{TvMaze:class{}},location:{hash:'#/home'},dispatchEvent(){}},document:{visibilityState:'visible'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async(url,opts)=>{calls.push(url);return fetchImpl?fetchImpl(url,opts):Response.json({error:'Offline'},{status:503});},console,Headers,URL,URLSearchParams,AbortController,DOMException,CustomEvent:class{},setTimeout:(fn,ms)=>setTimeout(fn,ms===750?0:ms),clearTimeout});
  vm.runInContext(source.replace('window.Api = { FlixerApi, providersOf };','window.Api = { FlixerApi, providersOf, getJson };'),context);
  const api=new context.window.Api.FlixerApi();api._reindex=()=>{};api._mergeIndex=async()=>{};api._loadBundledIndex=async()=>({body:snapshot});
  return {api,calls,storage,getJson:context.window.Api.getJson};
}

test('a clean Android install falls back from a missing bundle to the hosted bootstrap',async()=>{
  const c=client({fetchImpl:async url=>Response.json(url===base+'/data/bootstrap.json'?snapshot:{error:'Not found'},{status:url===base+'/data/bootstrap.json'?200:404})});
  assert.equal((await c.api.catalog()).shows[0].id,'fm:m:1');
  assert.deepEqual(c.calls.slice(0,3),['/data/bootstrap.json',base+'/api/catalogue?part=bootstrap',base+'/data/bootstrap.json']);
  assert.ok(!c.calls.some(url=>url.endsWith('/catalog.json')));
  await c.api._indexReady;await c.api._metadataReady;
});

test('saved home data opens offline without waiting for any bootstrap request',async()=>{
  const c=client({cached:snapshot});assert.equal((await c.api.catalog()).shows[0].title,'Saved title');
  assert.ok(!c.calls.some(url=>url.includes('bootstrap')||url.endsWith('/catalog.json')));
  assert.equal(c.api._fullIndexAt,null,'a home snapshot is not a loaded full index');
  await c.api._indexReady;await c.api._metadataReady;
});

test('client title matching rejects conflicting IMDb IDs, including an old alias',async()=>{
  const original={...snapshot.shows[0],year:2020,imdbId:'tt100'},incoming={...original,id:'fm:m:2',imdbId:'tt200'};
  const c=client({cached:{...snapshot,shows:[original]}});await c.api.catalog();await c.api._indexReady;await c.api._metadataReady;
  c.api._byId.set(incoming.id,c.api._byId.get(original.id));
  c.api._merge([incoming],{persist:false});
  assert.equal(c.api._catalog.shows.length,2);assert.equal(c.api._byId.get(incoming.id).imdbId,'tt200');assert.equal(c.api._byId.get(original.id).imdbId,'tt100');
});

test('a rejected or slow direct catalogue request falls back within the caller deadline',async()=>{
  for(const get of [async()=>{throw Error('Direct host unavailable');},()=>new Promise(()=>{})]){
    const c=client({direct:{enabled:()=>true,get},fetchImpl:async()=>Response.json(snapshot)});
    const result=await c.getJson(base+'/api/catalogue?part=bootstrap',150);
    assert.equal(result.body.product,'flixer');assert.equal(c.calls.length,1);
  }
});

test('cancellation bounds native catalogue work and prevents a backend request',async()=>{
  const c=client({direct:{enabled:()=>true,get:()=>new Promise(()=>{})}}),controller=new AbortController();
  const request=c.getJson(base+'/api/catalogue?part=manifest',60,controller.signal);controller.abort();
  await assert.rejects(request,{name:'AbortError'});await new Promise(resolve=>setTimeout(resolve,30));assert.equal(c.calls.length,0);
});
