import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const slug='6accbd76b0e02',seriesId=`sp:stardima:s:${slug}`,filmId='sp:stardima:m:video-58';
const episode=(number,season=1)=>({id:`sp:stardima:e:${slug}:${104744+number}`,title:`Episode ${number}`,season,number,sourceUrl:`https://www.stardima.com/tvshow/${slug}/play/${104744+number}`,offerings:[{provider:'stardima',id:`sp:stardima:e:${slug}:${104744+number}`} ]});
const title=(id=seriesId)=>({id,title:'A Public Cartoon',altTitles:['كرتون متاح'],kind:id.includes(':m:')?'film':'series',year:2016,tags:['animation'],collections:['arabic','cartoons'],access:'public',synopsis:'Source synopsis',poster:{custom:'https://www.stardima.com/storage/poster.jpg'},sourceUrl:`https://www.stardima.com/${id.includes(':m:')?'movie':'tvshow'}/${id.split(':').at(-1)}`,offerings:[{provider:'stardima',id}],episodes:[]});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const turn=()=>new Promise(resolve=>setTimeout(resolve,10));
async function bounded(promise,ms=500){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Waited for the hosted request')),ms);})]);}finally{clearTimeout(timer);}}

async function client({source={},shows=[],storage=new Map(),request,catalogueSource}={}){
  const requests=[],events=[],calls={pages:[],search:[],details:[],servers:[]};
  const native={enabled:()=>true,supports:id=>/^sp:stardima:(?:[ms]:(?:[a-f0-9]{13}|video-[1-9]\d{0,9})|e:(?:[a-f0-9]{13}|video-[1-9]\d{0,9}):[1-9]\d{0,11})$/.test(id||''),page:async options=>{calls.pages.push(options);return source.page?source.page(options):{items:[],page:options.page,totalPages:1};},search:async(query,options)=>{calls.search.push({query,...options});return source.search?source.search(query,options):[];},details:async(id,options)=>{calls.details.push({id,...options});return source.details?source.details(id,options):title(id);},servers:async(id,options)=>{calls.servers.push({id,...options});return source.servers?source.servers(id,options):[{id:'star:public',provider:'stardima',type:'embed',embedUrl:'https://v2.hyperwatching.com/watch/PublicPlayer'}];}};
  const catalog={product:'flixer',generatedAt:'2026-01-01T00:00:00Z',shows:structuredClone(shows)};
  const context=vm.createContext({window:{FLIXER_CONFIG:{apiBase:'https://backend.test',dataBase:'https://backend.test',mobile:true,live:false},location:{hash:'#/home'},FlixerStardimaSource:native,...(catalogueSource?{FlixerCatalogueSource:catalogueSource}:{}),dispatchEvent:event=>events.push(event),addEventListener:()=>{},removeEventListener:()=>{}},document:{visibilityState:'visible',addEventListener:()=>{}},console,URL,URLSearchParams,Headers,DOMException,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},AbortController,setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===750?0:ms,...args),clearTimeout,setInterval,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},fetch:async input=>{
    const url=new URL(String(input),'https://backend.test');requests.push(url);
    let body=await request?.(url);
    if(body===undefined)body=url.pathname==='/api/search'?url.searchParams.has('providers')?{providers:['stardima','fmovies']}:{items:[]}:url.pathname==='/api/discover'?{items:[],totalPages:1}:/services|universes/.test(url.pathname)?{}:catalog;
    return {ok:true,status:200,headers:new Headers(),text:async()=>JSON.stringify(body)};
  }});
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  const api=new context.window.Api.FlixerApi();await api.catalog();await api._indexReady;api.liveEnabled=true;
  return {api,native,requests,events,calls,storage,context};
}

test('native StarDima search publishes before the hosted registry and merges explicit Arabic aliases',async()=>{
  const gate=deferred(),updates=[];
  const row={...title(),title:'كرتون متاح',altTitles:['A Public Cartoon']};
  const c=await client({shows:[{id:'fm:t:1',kind:'series',title:'A Public Cartoon',altTitles:['كرتون متاح'],year:2016,offerings:[{provider:'fmovies',id:'fm:t:1'}]}],source:{search:async()=>[row]},request:async url=>url.searchParams.has('providers')?gate.promise:undefined});
  const result=c.api.search('A Public Cartoon',{onLocal:page=>updates.push(page)});
  await turn();assert.equal(c.calls.search.length,1);assert.ok(c.calls.search[0].aliases.includes('كرتون متاح'));
  assert.ok(updates.some(page=>page.items.some(item=>item.providers.some(provider=>provider.id==='stardima'))),'device results appear while registry remains unresolved');
  gate.resolve({providers:['fmovies','stardima']});const found=await bounded(result);
  assert.equal(found.items.length,1);assert.deepEqual(Array.from(found.items[0].providers,p=>p.id),['fmovies','stardima']);
  assert.equal(c.requests.some(url=>url.searchParams.get('provider')==='stardima'),false);
  assert.equal(found.pending,0);
});

test('a cold Latin search retains the source Arabic result before detail aliases exist and after a late canonical index merge',async()=>{
  const sourceId='sp:stardima:s:video-11',canonicalId='mf:s:confirmed-blazing-teens',gate=deferred(),updates=[];
  const row={...title(sourceId),title:'بليزين تينز',altTitles:[],year:null};
  const c=await client({source:{search:async()=>[row]},request:async url=>url.pathname==='/api/search'&&!url.searchParams.has('providers')?{items:[{id:'fm:t:unrelated',title:'Unrelated source default',kind:'series',altTitles:[]}]}:undefined});
  c.api._indexReady=gate.promise.then(async()=>{
    await c.api._mergeIndex([{...row,id:canonicalId,aliasIds:[sourceId],offerings:[{provider:'myflixer',id:canonicalId},{provider:'stardima',id:sourceId}]}],'2026-11-03T12:00:00Z');c.api._reindex();
  });
  const pending=c.api.search('Blazing Teens',{onLocal:page=>updates.push(page)});
  await turn();const progressive=updates.find(page=>page.items.some(item=>item.id===sourceId));
  assert.ok(progressive,'the source result paints before full title details or the pending catalogue');assert.equal(progressive.items[0].title,'بليزين تينز');
  assert.deepEqual(Array.from(progressive.items[0].altTitles),[]);assert.equal(c.calls.details.length,0,'search must not load a large episode guide to discover aliases');
  assert.equal(c.calls.search[0].query,'Blazing Teens');assert.equal(c.requests.some(url=>url.pathname==='/api/title'),false);
  gate.resolve();const result=await bounded(pending);
  assert.equal(result.items.length,1);assert.equal(result.items[0].id,canonicalId);assert.equal(result.items[0].title,'بليزين تينز');
  assert.deepEqual(Array.from(result.items[0].altTitles),[],'query evidence never becomes a fabricated title alias');
  assert.ok(result.items[0].providers.some(provider=>provider.id==='stardima'));assert.ok(result.items[0].providers.some(provider=>provider.id==='myflixer'));
  assert.equal(result.items.some(item=>item.id==='fm:t:unrelated'),false,'other provider defaults still need the existing title filter');
  assert.ok(updates.some(page=>page.items.some(item=>item.id===canonicalId)),'late index repaint follows the canonical source identity');
});

test('native discovery pages progress while hosted discovery is blocked, without repeating titles',async()=>{
  const gate=deferred();
  const c=await client({source:{page:async options=>({items:[{...title(`sp:stardima:s:video-${options.page}`),title:'Public series '+options.page,altTitles:[]}],page:options.page,totalPages:2})},request:async url=>url.pathname==='/api/discover'?gate.promise:undefined});
  const filters={collection:'arabic'};
  const first=await bounded(c.api.discover('tv',filters,1)),second=await bounded(c.api.discover('tv',filters,2));
  assert.deepEqual(first.items.map(item=>item.id).join(','),'sp:stardima:s:video-1');
  assert.deepEqual(second.items.map(item=>item.id).join(','),'sp:stardima:s:video-2');
  assert.deepEqual(c.calls.pages.map(page=>[page.kind,page.collection,page.page]),[['series','arabic',1],['series','arabic',2]]);
  gate.resolve({items:[],totalPages:1});await turn();const last=await bounded(c.api.discover('tv',filters,3));
  assert.equal(last.items.length,0);assert.equal(last.totalPages,3);assert.equal(c.calls.pages.length,2);
});

test('native animation paging uses source category partitions and retries partial pages',async()=>{
  let partial=true;
  const c=await client({source:{page:async options=>({items:[{...title(`sp:stardima:s:video-${options.collection==='anime'?10:20}`),title:options.collection,altTitles:[],tags:['animation',...(options.collection==='anime'?['anime']:[])],collections:['arabic',options.collection]}],totalPages:1,partial:options.collection==='cartoons'&&partial})}});
  const first=await c.api.discover('tv',{genres:['animation']},1);assert.equal(first.items.length,2);partial=false;
  await c.api.discover('tv',{genres:['animation']},2);
  assert.deepEqual(c.calls.pages.map(page=>[page.collection,page.page]),[['cartoons',1],['anime',1],['cartoons',1]]);
  await c.api.discover('tv',{collection:'tunisian'},1);assert.equal(c.calls.pages.length,3,'StarDima does not invent an unsupported regional collection');
});

test('native all-media Arabic browsing applies local year filters to both source lanes',async()=>{
  const c=await client({source:{page:async options=>({items:[{...title(options.kind==='film'?filmId:seriesId),year:options.kind==='film'?2016:2026}],totalPages:1,hasNext:false})}});
  const result=await c.api.discover('all',{collection:'arabic',yearFrom:2020},1);
  assert.deepEqual(Array.from(result.items,item=>[item.type,item.id]),[['tv',seriesId]]);
  assert.deepEqual(c.calls.pages.map(page=>[page.kind,page.collection]),[['film','arabic'],['series','arabic']]);
  assert.equal(c.api._byId.has(filmId),true,'filtered titles remain searchable without violating the visible year filter');
});

test('small native latest refresh persists through index merges and restarts without waiting for the hosted snapshot',async()=>{
  const gate=deferred();let newest=1;
  const storage=new Map(),c=await client({storage,catalogueSource:{enabled:()=>true,get:async()=>gate.promise},source:{page:async options=>({items:options.kind==='film'?[title(filmId)]:[{...title(),episodes:[episode(newest)],latestEpisode:episode(newest).id,episodeUpdateFeed:true}],totalPages:999})}});
  const sync=c.api.sync();await bounded(c.api._stardimaRefresh);
  assert.equal(c.calls.pages.length,2);assert.ok(c.calls.pages.every(page=>page.page===1&&page.latest));
  assert.equal(c.api._catalog.shows.length,2);const initial=c.api._byId.get(seriesId);assert.ok(initial.firstSeenAt);assert.equal(initial.contentUpdatedAt,undefined);
  assert.ok((await c.api.trending()).some(item=>item.id===seriesId&&item.updateKind==='episodes'&&item.updateObserved));
  assert.equal((await c.api.trending()).some(item=>item.id===filmId),false,'an ordinary film catalogue listing has no release evidence');
  await c.api._mergeIndex([{id:'fm:t:other',kind:'series',title:'Other snapshot entry'}],'2026-01-02T00:00:00Z');
  assert.ok(c.api._byId.has(seriesId));
  gate.resolve({product:'flixer',generatedAt:'2026-01-01T00:00:00Z'});await sync;
  c.api._lastStardimaRefresh=0;newest=2;await c.api._refreshNativeStardima();const updated=c.api._byId.get(seriesId).recentUpdate.observedAt;assert.ok(updated);
  c.api._lastStardimaRefresh=0;await c.api._refreshNativeStardima();assert.equal(c.api._byId.get(seriesId).recentUpdate.observedAt,updated,'rechecking the same episode never bumps its update time');
  assert.deepEqual(Array.from(c.api._byId.get(seriesId).episodes,ep=>ep.number),[2,1]);
  const restarted=await client({storage});assert.equal(restarted.api._byId.get(seriesId).firstSeenAt,initial.firstSeenAt);assert.equal(restarted.api._byId.get(seriesId).latestEpisode,episode(2).id);
  assert.ok((await restarted.api.trending()).some(item=>item.id===seriesId&&item.updateKind==='episodes'));
});

test('native title guides and public playback avoid denied hosted lookups and preserve saved episodes',async()=>{
  const c=await client({source:{details:async()=>({...title(),episodes:[episode(1),episode(2,3)],episodesComplete:true})}});
  const show=await bounded(c.api.details('tv',seriesId));
  assert.deepEqual(Array.from(show.episodes,ep=>[ep.season,ep.n]),[[1,1],[3,2]]);
  assert.equal(c.calls.details.length,1);assert.equal(c.requests.some(url=>url.pathname==='/api/title'||url.pathname.startsWith('/data/shows/')),false);
  const abort=new AbortController(),sources=[];
  const play=await bounded(c.api.stream(episode(2).id,episode(2).sourceUrl,show,{fresh:true,signal:abort.signal,onSources:rows=>sources.push(rows)}));
  assert.equal(play.via,'device');assert.equal(play.servers[0].provider,'stardima');assert.equal(c.calls.servers[0].fresh,true);assert.equal(c.calls.servers[0].signal,abort.signal);
  assert.equal(c.requests.some(url=>url.pathname==='/api/stream'),false);assert.ok(sources.length);
  c.storage.set('flixer:delta','[]');
  const restored=await client({storage:c.storage,source:{details:async()=>{throw Error('Offline');}}});const cached=await restored.api.details('tv',seriesId);
  assert.equal(cached.episodes.length,2);assert.equal(restored.calls.details.length,0,'the cached guide survives offline reopening');
});

test('a native StarDima route keeps a confirmed alternate provider available without sending StarDima back to the host',async()=>{
  const gate=deferred(),updates=[],c=await client({request:async url=>url.pathname==='/api/stream'?gate.promise:undefined});
  const ep={...episode(1),offerings:[...episode(1).offerings,{provider:'fmovies',id:'fm:e:99'}]};
  const show={...title(),episodes:[ep],offerings:[...title().offerings,{provider:'fmovies',id:'fm:t:55',sourceUrl:'https://f-movies.org/tv/synthetic'}]};
  const stream=await bounded(c.api.stream(ep.id,ep.sourceUrl,show,{onSources:rows=>updates.push(rows)}));
  assert.ok(stream.servers.some(server=>server.provider==='stardima'));
  const requested=c.requests.find(url=>url.pathname==='/api/stream');assert.equal(requested.searchParams.get('id'),'fm:e:99');assert.equal(requested.searchParams.get('showId'),'fm:t:55');assert.ok(requested.searchParams.getAll('source').every(url=>!url.includes('stardima.com')));
  gate.resolve({servers:[{id:'other',provider:'fmovies',type:'embed',embedUrl:'https://player.test/watch'}]});await turn();
  assert.ok(updates.some(rows=>rows.some(server=>server.provider==='stardima')&&rows.some(server=>server.provider==='fmovies')));
});

test('a merged canonical title uses the StarDima guide and resolves its explicit episode offering inline',async()=>{
  const gate=deferred(),canonical={...title(),id:'mf:s:canonical',offerings:[{provider:'myflixer',id:'mf:s:canonical'},...title().offerings],episodes:[]};
  const c=await client({shows:[canonical],source:{details:async()=>({...title(),episodes:[episode(1)]})},request:async url=>url.pathname==='/api/stream'?gate.promise:undefined});
  const detail=await bounded(c.api.details('tv',canonical.id));assert.equal(c.calls.details[0].id,seriesId);assert.equal(detail.id,canonical.id);assert.equal(detail.episodes.length,1);
  assert.equal(c.requests.some(url=>url.pathname==='/api/title'||url.pathname.startsWith('/data/shows/')),false);
  const ep={...episode(1),id:'mf:e:canonical-episode',offerings:[{provider:'myflixer',id:'mf:e:canonical-episode'},...episode(1).offerings]};
  const playback=await bounded(c.api.stream(ep.id,'',{...detail,episodes:[ep]}));
  assert.equal(c.calls.servers[0].id,episode(1).id);assert.ok(playback.servers.some(server=>server.provider==='stardima'));
  gate.resolve({servers:[]});await turn();
});

test('cancelled native searches and streams do not publish late results or start hosted StarDima requests',async()=>{
  const gate=deferred(),c=await client({source:{search:async()=>gate.promise,servers:async()=>gate.promise},request:async url=>url.searchParams.has('providers')?{providers:['stardima']}:undefined});
  const abort=new AbortController(),updates=[];const search=c.api.search('A Public Cartoon',{signal:abort.signal,onLocal:page=>updates.push(page)});
  await turn();abort.abort();gate.resolve([title()]);await search;
  assert.equal(c.api._byId.has(seriesId),false);assert.ok(updates.every(page=>!page.items.length));
  await assert.rejects(c.api.stream(episode(1).id,'',title(),{signal:abort.signal}),{name:'AbortError'});
  assert.equal(c.requests.some(url=>url.pathname==='/api/stream'||url.searchParams.get('provider')==='stardima'),false);
});
