import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('native WCO search shares one card with a matching series and keeps independent versions playable',async()=>{
 const catalog={product:'flixer',shows:[{id:'fm:t:1',title:'Gravity Falls',kind:'series',year:2012,offerings:[{provider:'fmovies',id:'fm:t:1'}],episodes:[{id:'fm:e:1',season:1,number:1}]}]};
 const wco={id:'sp:wco:s:gravity-falls',title:'Gravity Falls',kind:'series',offerings:[{provider:'wco',id:'sp:wco:s:gravity-falls'}],episodes:[{id:'sp:wco:e:gravity-falls:gravity-falls-episode-1',season:null,number:1}]};
 let native=0;const requests=[];
 const context=vm.createContext({window:{FLIXER_CONFIG:{apiBase:'https://backend.test',live:false},Capacitor:{Plugins:{WcoSource:{}}},FlixerWcoSource:{search:async()=>{native++;return [wco];}},dispatchEvent:()=>{}},console,URL,URLSearchParams,localStorage:{getItem:()=>null,setItem:()=>{}},AbortController,setTimeout,clearTimeout,CustomEvent:class{},fetch:async input=>{
  const u=new URL(String(input),'https://backend.test');requests.push(u.href);
  const body=u.pathname==='/api/search'?u.searchParams.has('providers')?{providers:['fmovies','wco']}:{items:[]}:/services|universes/.test(u.pathname)?{}:catalog;
  return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(body)};
 }});
 for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
 const api=new context.window.Api.FlixerApi();await api.catalog();await api._indexReady;api.liveEnabled=true;
 const result=await api.search('Gravity Falls');assert.equal(native,1);assert.equal(result.items.length,1);
 assert.deepEqual(Array.from(result.items[0].providers,p=>p.id),['fmovies','wco']);
 assert.equal(result.items[0].versions[0].id,wco.id);assert.equal(result.items[0].versions[0].uncertainMatch,true);
 assert.equal(api._byId.get(wco.id).id,wco.id,'a yearless source is not a canonical alias');
 assert.equal(api._byId.get('fm:t:1').episodes.length,1,'uncertain episode numbering is not mixed');
 const detail=await api._build(api._byId.get('fm:t:1'),{guide:false});assert.equal(detail.versions[0].id,wco.id);
 assert.equal((await api._build(api._byId.get(wco.id),{guide:false})).versions[0].id,'fm:t:1');
 assert.equal(requests.some(url=>url.includes('provider=wco')),false,'Android uses the native WCO search');
 const providers=context.window.Api.providersOf({id:'sp:wco:s:x',offerings:[{provider:'wco'},{provider:'wco'},{provider:'tvm'}],tvm:{svc:'Netflix'}});assert.deepEqual(Array.from(providers,p=>p.name),['WCO']);
 api._merge([{id:'fm:t:1',title:'Gravity Falls',kind:'series',episodes:[{id:'sp:frenchstream:e:1:1:1',season:1,number:1,offerings:[{provider:'fmovies',id:'fm:e:1'},{provider:'frenchstream',id:'sp:frenchstream:e:1:1:1',audioMode:'dub'}]}]}]);
 const merged=api._byId.get('fm:t:1');assert.equal(merged.episodes.length,1,'a changed primary episode ID uses the explicit provider aliases');
 assert.equal(merged.episodes[0].id,'fm:e:1','existing playback progress keeps its stable episode ID');
 assert.equal(merged.episodes[0].offerings.find(o=>o.provider==='frenchstream').audioMode,'dub');
 assert.ok(merged.episodes[0].offerings.some(o=>o.id==='fm:e:1'),'the original route remains available');
 api._merge([{id:'fm:t:1',title:'Gravity Falls',kind:'series',episodes:[{id:'sp:frenchstream:e:other-edition:1:1',season:1,number:1,offerings:[{provider:'frenchstream',id:'sp:frenchstream:e:other-edition:1:1'}]}]}]);
 assert.equal(merged.episodes.length,2,'equal numbering without an explicit alias is not proof of the same edition');
 api._merge([{id:'fm:t:2',title:'Gravity Falls',kind:'series',year:2030,tmdbId:999}]);
 const ambiguous=api._groupSearchItems(['fm:t:1','fm:t:2',wco.id]);assert.equal(ambiguous.length,3,'a yearless match does not choose between remakes');
 api.liveEnabled=false;
});

test('Flixer offline search finds Happy & Gay when the user types and or omits punctuation',async()=>{
  const catalog={product:'flixer',shows:[{id:'happy-gay',title:'Happy & Gay',kind:'film',year:2014,tags:['animation']},{id:'holidays',title:'Happy Holidays',kind:'film',tags:['comedy']}]};
  const context=vm.createContext({window:{FLIXER_CONFIG:{live:false},dispatchEvent:()=>{}},console,localStorage:{getItem:()=>null,setItem:()=>{}},AbortController,setTimeout,clearTimeout,CustomEvent:class {},fetch:async url=>({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify((/\/(catalog|bootstrap|index)\.json/.test(String(url)))?catalog:String(url).includes('/universes.json')?{universes:[]}:{services:[]})})});
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  const api=new context.window.Api.FlixerApi();
  for(const query of ['happy and gay','happy & gay','happy gay']){
    const result=await api.search(query);
    assert.deepEqual(Array.from(result.items,item=>item.id),['happy-gay']);
  }
  assert.equal((await api.search('...')).items.length,0);
});


test('Flixer renders its bootstrap before a delayed full index and keeps scroll pages distinct',async()=>{
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const initial={product:'flixer',shows:[{id:'one',kind:'film',title:'One',tags:['animation']}]};
  const requests=[];
  const context=vm.createContext({window:{FLIXER_CONFIG:{live:false},dispatchEvent:()=>{}},console,URLSearchParams,CustomEvent:class {},localStorage:{getItem:()=>null,setItem:()=>{}},AbortController,setTimeout,clearTimeout,fetch:async url=>{
    requests.push(String(url));
    if(String(url).includes('/index.json')) await gate;
    const body=String(url).includes('/index.json')?{product:'flixer',shows:Array.from({length:60},(_,i)=>({id:'item'+i,kind:'film',title:'Item '+i,tags:['animation']}))}:String(url).includes('/bootstrap.json')?initial:{};
    return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(body)};
  }});
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  const api=new context.window.Api.FlixerApi();
  const startup=await api.catalog();
  assert.equal(startup.shows.length,1);
  assert.equal(requests.some(url=>url.includes('/catalog.json')),false);
  release(); await api._indexReady;
  const filters={genres:['animation']};
  const first=await api.discover('movie',filters,1),second=await api.discover('movie',filters,2);
  assert.equal(first.items.length,24); assert.equal(second.items.length,24);
  assert.equal(second.items.some(item=>first.items.some(prior=>item.id===prior.id)),false);
});


test('Flixer latest updates browse includes both media types and does not wait for auxiliary metadata',async()=>{
  let releaseMetadata;
  const metadata=new Promise(resolve=>{releaseMetadata=resolve;});
  const requests=[];
  const catalog={product:'flixer',shows:[
    {id:'movie',kind:'film',title:'Old movie, new update',publishedAt:'2020-01-01',latestAt:'2026-09-01',providerUpdatedAt:'2026-12-01',firstSeenAt:'2026-12-01'},
    {id:'series',kind:'series',title:'Updated series',publishedAt:'2025-01-01',latestAt:'2026-10-01'},
    {id:'added',kind:'film',title:'Recently added',publishedAt:'2026-08-01'}
  ]};
  const context=vm.createContext({window:{FLIXER_CONFIG:{live:false},dispatchEvent:()=>{}},console,URLSearchParams,CustomEvent:class {},localStorage:{getItem:()=>null,setItem:()=>{}},AbortController,setTimeout,clearTimeout,fetch:async input=>{
    const url=String(input);requests.push(url);
    if(url.includes('/services.json')||url.includes('/universes.json'))await metadata;
    const body=url.includes('/api/discover')?{items:[],totalPages:1}:url.includes('/index.json')||url.includes('/bootstrap.json')?catalog:{};
    return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(body)};
  }});
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  const api=new context.window.Api.FlixerApi();await api.catalog();await api._indexReady;
  api.liveEnabled=true;
  const updated=await api.discover('all',{sort:'updated'},1);
  assert.deepEqual(Array.from(updated.items,item=>item.id),['series','movie','added']);
  const calls=requests.filter(url=>url.includes('/api/discover')).map(url=>new URL(url,'https://example.com'));
  assert.deepEqual(calls.map(url=>url.searchParams.get('kind')).sort(),['film','series']);
  assert.ok(calls.every(url=>url.searchParams.get('latest')==='true'));
  api.liveEnabled=false;
  const added=await api.discover('all',{sort:'added'},1);
  assert.deepEqual(Array.from(added.items,item=>item.id),['added','series','movie']);
  releaseMetadata();await api._metadataReady;
});

test('Flixer searches providers concurrently, publishes progressive results and cancels superseded searches',async()=>{
 const catalog={product:'flixer',shows:[]};let release;const gate=new Promise(r=>release=r),started=[];let never=false;const updates=[];
 const context=vm.createContext({window:{FLIXER_CONFIG:{apiBase:'https://backend.test',live:false},dispatchEvent:()=>{}},console,URL,URLSearchParams,localStorage:{getItem:()=>null,setItem:()=>{}},AbortController,setTimeout,clearTimeout,CustomEvent:class {},fetch:async(input,options)=>{
  const u=new URL(String(input),'https://backend.test');let body=catalog;
  if(u.pathname==='/api/search'&&u.searchParams.get('providers'))body={providers:['fmovies','frenchstream','dessinanime']};
  else if(u.pathname==='/api/search'){const provider=u.searchParams.get('provider');started.push(provider);if(never)await new Promise(()=>{});if(provider!=='fmovies')await gate;body={items:[{id:provider,title:'A result '+provider,kind:'film',year:2024}]};}
  else if(/services|universes/.test(u.pathname))body={};
  return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(body)};
 }});
 for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
 const api=new context.window.Api.FlixerApi();await api.catalog();await api._indexReady;api.liveEnabled=true;
 const pending=api.search('A result',{onLocal:r=>updates.push({length:r.items.length,pending:r.pending})});
 await new Promise(r=>setTimeout(r,20));assert.deepEqual(new Set(started),new Set(['fmovies','frenchstream','dessinanime']));assert.ok(updates.some(r=>r.length===1&&r.pending>0));release();assert.equal((await pending).items.length,3);
 const aborted=new AbortController();aborted.abort();const calls=started.length;await api.search('cancelled',{signal:aborted.signal});assert.equal(started.length,calls);
 never=true;const ignoredSignal=new AbortController();const cancelled=api.search('hanging transport',{signal:ignoredSignal.signal});setTimeout(()=>ignoredSignal.abort(),20);await Promise.race([cancelled,new Promise((_,reject)=>setTimeout(()=>reject(Error('Native transport cancellation hung')),300))]);
});
