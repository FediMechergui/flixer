import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const seriesId='sp:carateen:s:tg-453',filmId='sp:carateen:m:sp-1148159749';
const episode=(number,{section='tg',parent=section==='tg'?'453':'61692478',slug=4000+number}={})=>{
  const id=`sp:carateen:e:${section}-${parent}:${slug}`;
  return {id,title:`Actual episode ${number}`,number,season:null,offerings:[{provider:'carateen',id}],sourceUrl:`https://carateen.tv/watch/${section==='sp'?'sp/':''}${parent}/${slug}`};
};
const title=(id=seriesId,extra={})=>({id,kind:id.includes(':m:')?'film':'series',title:'المحقق كونان',altTitles:[],year:1996,access:'public',collections:['arabic','cartoons'],tags:['animation'],synopsis:'Source description',poster:{custom:'https://cdn.spacetoongo.com/public/poster.jpg'},sourceUrl:`https://carateen.tv/watch/${id.split(':').at(-1).replace('tg-','').replace('sp-','sp/')}`,offerings:[{provider:'carateen',id}],episodes:[],...extra});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const turn=()=>new Promise(resolve=>setTimeout(resolve,10));
async function bounded(promise,ms=400){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Waited for a blocked hosted or unrelated source request')),ms);})]);}finally{clearTimeout(timer);}}

async function client({shows=[],storage=new Map(),source={},star,request,catalogueSource}={}){
  const calls={pages:[],search:[],details:[],servers:[]},requests=[],events=[];
  const native={enabled:()=>true,supports:id=>/^sp:carateen:(?:[ms]:(?:tg|sp)-\d+|e:(?:tg|sp)-\d+:\d+)$/.test(id||''),page:async options=>{calls.pages.push(options);return source.page?source.page(options):{items:[],totalPages:1};},search:async(query,options)=>{calls.search.push({query,...options});return source.search?source.search(query,options):[];},details:async(id,options)=>{calls.details.push({id,...options});return source.details?source.details(id,options):title(id);},servers:async(id,options)=>{calls.servers.push({id,...options});return source.servers?source.servers(id,options):[{id:'carateen:public',provider:'carateen',type:'hls',streamUrl:'https://pegasus.5387692.xyz/api/hls/539/playlist.m3u8'}];}};
  const catalog={product:'flixer',generatedAt:'2026-01-01T00:00:00Z',shows:structuredClone(shows)};
  const context=vm.createContext({window:{FLIXER_CONFIG:{apiBase:'https://backend.test',dataBase:'https://backend.test',mobile:true,live:false},location:{hash:'#/home'},FlixerCarateenSource:native,FlixerStardimaSource:star,...(catalogueSource?{FlixerCatalogueSource:catalogueSource}:{}),dispatchEvent:event=>events.push(event),addEventListener(){},removeEventListener(){}},document:{visibilityState:'visible',addEventListener(){}},console,URL,URLSearchParams,Headers,DOMException,AbortController,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===750?0:ms,...args),clearTimeout,setInterval,fetch:async input=>{
    const url=new URL(String(input),'https://backend.test');requests.push(url);
    let body=await request?.(url);
    if(body===undefined)body=url.pathname==='/api/search'?url.searchParams.has('providers')?{providers:['carateen','stardima','fmovies']}:{items:[]}:url.pathname==='/api/discover'?{items:[],totalPages:1}:/services|universes/.test(url.pathname)?{}:catalog;
    return {ok:true,status:200,headers:new Headers(),text:async()=>JSON.stringify(body)};
  }});
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  const api=new context.window.Api.FlixerApi();await api.catalog();await api._indexReady;await api._metadataReady;api.liveEnabled=true;
  return {api,native,calls,requests,events,storage};
}

test('Carateen publishes native Arabic search results before the hosted registry and another native source',async()=>{
  const registry=deferred(),starSearch=deferred(),updates=[],star={enabled:()=>true,supports:id=>/^sp:stardima:/.test(id),search:()=>starSearch.promise};
  const c=await client({star,source:{search:async()=>[title()]},request:url=>url.searchParams.has('providers')?registry.promise:undefined});
  const pending=c.api.search('Detective Conan',{onLocal:page=>updates.push(page)});await turn();
  assert.ok(updates.some(page=>page.items.some(item=>item.id===seriesId)));assert.equal(c.calls.search[0].query,'Detective Conan');
  registry.resolve({providers:['carateen','stardima','fmovies']});starSearch.resolve([]);const result=await bounded(pending);
  assert.equal(result.items.length,1);assert.equal(result.items[0].title,'المحقق كونان');assert.deepEqual(Array.from(result.items[0].altTitles),[]);
  assert.equal(result.pending,0);assert.equal(c.requests.some(url=>['carateen','stardima'].includes(url.searchParams.get('provider'))),false);
});

test('native Carateen collection pages advance while the hosted discovery is blocked and retry partial pages',async()=>{
  const gate=deferred();let partial=true;
  const c=await client({source:{page:async options=>({items:[title(`sp:carateen:s:tg-${453+options.page}`,{title:'Native page '+options.page})],totalPages:2,partial:options.page===1&&partial})},request:url=>url.pathname==='/api/discover'?gate.promise:undefined});
  const first=await bounded(c.api.discover('tv',{collection:'arabic'},1));assert.equal(first.items.length,1);partial=false;
  const next=await bounded(c.api.discover('tv',{collection:'arabic'},2));
  assert.equal(next.items[0].id,'sp:carateen:s:tg-455');assert.deepEqual(c.calls.pages.map(page=>page.page),[1,1,2]);
  gate.resolve({items:[],totalPages:1});await turn();
  await c.api.discover('tv',{collection:'tunisian'},1);assert.equal(c.calls.pages.length,3,'unsupported regional filters do not invent Carateen availability');
});

test('native recent Carateen updates use real episode numbers rather than nonmonotonic SP slugs and persist offline',async()=>{
  const gate=deferred(),storage=new Map();let number=1,slug=900;
  const row=()=>{const ep=episode(number,{section:'sp',slug});return title('sp:carateen:s:sp-61692478',{episodes:[ep],latestEpisode:ep.id,episodeUpdateFeed:true});};
  const c=await client({storage,catalogueSource:{enabled:()=>true,get:()=>gate.promise},source:{page:async options=>({items:options.kind==='series'?[row()]:[],totalPages:1})}});
  const sync=c.api.sync();await bounded(c.api._carateenRefresh);
  const initial=c.api._byId.get(row().id);assert.ok(initial.firstSeenAt);assert.equal(initial.contentUpdatedAt,undefined);assert.equal(initial.recentUpdate.kind,'episodes');assert.equal(initial.recentUpdate.at,'');assert.ok(initial.recentUpdate.observedAt);
  c.api._lastCarateenRefresh=0;number=2;slug=100;await c.api._refreshNativeCarateen();
  const updated=c.api._byId.get(row().id).recentUpdate.observedAt;assert.ok(updated);assert.equal((await c.api.item(row().id)).recentEpisode.number,2);
  c.api._lastCarateenRefresh=0;await c.api._refreshNativeCarateen();assert.equal(c.api._byId.get(row().id).recentUpdate.observedAt,updated);
  gate.resolve({product:'flixer',generatedAt:'2026-01-01T00:00:00Z'});await sync;
  const restarted=await client({storage});const item=await restarted.api.item(row().id);assert.equal(item.recentEpisode.number,2);assert.equal(item.updateKind,'episodes');
});

test('a first precise recent-feed observation updates a known catalogue title and never leaks its feed marker into details',async()=>{
  const c=await client({shows:[title()]});
  const ep=episode(3);
  c.api._mergeNativeCarateen([title(seriesId,{episodes:[ep],latestEpisode:ep.id,episodeUpdateFeed:true})],{latest:true});c.api._reindex();
  const current=c.api._byId.get(seriesId),at=current.recentUpdate.observedAt;
  assert.ok(at);assert.equal(current.episodeUpdateFeed,undefined);assert.equal((await c.api.item(seriesId)).recentEpisode.number,3);
  const saved=JSON.parse(c.storage.get('flixer:delta')).find(row=>row.id===seriesId);assert.equal(saved.episodeUpdateFeed,undefined);
  c.api._mergeNativeCarateen([title(seriesId,{episodes:[episode(4)],latestEpisode:episode(4).id})],{latest:true});
  assert.equal(current.recentUpdate.observedAt,at,'an ordinary full guide never inherits the recent-feed marker');
  assert.equal(current.recentUpdate.episodeId,ep.id,'guide metadata cannot relabel a previously observed source update');
  const noEvidence=title('sp:carateen:s:tg-999',{title:'A different catalogue title'});c.api._merge([noEvidence]);
  c.api._mergeNativeCarateen([{...noEvidence,episodeUpdateFeed:true,latestEpisode:'sp:carateen:e:tg-999:5000'}],{latest:true});
  assert.equal(c.api._byId.get(noEvidence.id).contentUpdatedAt,undefined,'an unsupported pointer is not a precise episode observation');
});

test('classic cartoons can browse saved Carateen titles without calling an unsupported source partition',async()=>{
  const c=await client({shows:[title()]});
  const page=await c.api.discover('tv',{collection:'classic-cartoons'},1);
  assert.equal(page.items[0].id,seriesId);assert.equal(c.calls.pages.length,0);
});

test('native Carateen guides retain separate TG and SP unknown-season sequences and direct playback avoids hosted lookup',async()=>{
  const tg1=episode(1),tg2=episode(2),sp1=episode(1,{section:'sp',slug:36872801});
  const c=await client({source:{details:async()=>title(seriesId,{episodes:[tg1,sp1,tg2]})}});
  const detail=await bounded(c.api.details('tv',seriesId));
  assert.equal(detail.seasonCount,2);assert.notEqual(detail.episodes[0].season,detail.episodes[1].season);
  assert.match(detail.seasons.find(season=>season.season_number===detail.episodes[1].season).name,/Spacetoon/);
  const current=await c.api.episode(seriesId,tg1.id);assert.equal(current.next.id,tg2.id);assert.equal(current.total,2);
  const played=await bounded(c.api.stream(tg1.id,tg1.sourceUrl,detail));assert.equal(played.via,'device');assert.equal(played.servers[0].type,'hls');
  assert.equal(c.requests.some(url=>url.pathname==='/api/title'||url.pathname==='/api/stream'),false);
});

test('Carateen film language editions remain server choices and never become autoplay episodes',async()=>{
  const c=await client({source:{details:async()=>title(filmId,{filmVersions:[episode(1),episode(2)]}),servers:async()=>[{id:'arabic',provider:'carateen',type:'hls',audioLanguages:['ar'],streamUrl:'https://pegasus.5387692.xyz/api/sp/hls/11111111-1111-4111-8111-111111111111/playlist.m3u8'},{id:'japanese',provider:'carateen',type:'hls',audioLanguages:['ja'],streamUrl:'https://pegasus.5387692.xyz/api/sp/hls/22222222-2222-4222-8222-222222222222/playlist.m3u8'}]}});
  const detail=await c.api.details('movie',filmId);assert.equal(detail.episodes.length,1);assert.equal(detail.episodes[0].id,filmId);
  const playback=await c.api.stream(filmId,detail.sourceUrl,detail);assert.equal(playback.servers.length,2);assert.deepEqual(Array.from(playback.servers,server=>server.audioLanguages[0]),['ar','ja']);
  assert.equal((await c.api.episode(filmId,filmId)).next,null);
});

test('native Carateen plays before a delayed alternate provider and keeps that provider available',async()=>{
  const gate=deferred(),updates=[],ep={...episode(1),offerings:[...episode(1).offerings,{provider:'fmovies',id:'fm:e:99'}]};
  const c=await client({request:url=>url.pathname==='/api/stream'?gate.promise:undefined});
  const show=title(seriesId,{episodes:[ep],offerings:[...title().offerings,{provider:'fmovies',id:'fm:t:55',sourceUrl:'https://f-movies.org/tv/confirmed'}]});
  const result=await bounded(c.api.stream(ep.id,ep.sourceUrl,show,{onSources:servers=>updates.push(servers)}));assert.equal(result.servers[0].provider,'carateen');
  const requested=c.requests.find(url=>url.pathname==='/api/stream');assert.equal(requested.searchParams.get('id'),'fm:e:99');assert.equal(requested.searchParams.get('showId'),'fm:t:55');assert.ok(requested.searchParams.getAll('source').every(url=>!url.includes('carateen.tv')));
  gate.resolve({servers:[{id:'other',provider:'fmovies',type:'embed',embedUrl:'https://player.test/watch'}]});await turn();assert.ok(updates.some(rows=>rows.length===2));
});

test('a delayed native StarDima route cannot hold a confirmed Carateen route on the same episode',async()=>{
  const gate=deferred(),starId='sp:stardima:e:video-11:104745',updates=[],star={enabled:()=>true,supports:id=>/^sp:stardima:/.test(id),servers:()=>gate.promise};
  const c=await client({star}),ep={...episode(1),offerings:[...episode(1).offerings,{provider:'stardima',id:starId}]};
  const result=await bounded(c.api.stream(ep.id,ep.sourceUrl,title(seriesId,{episodes:[ep]}),{onSources:rows=>updates.push(rows)}));assert.equal(result.servers[0].provider,'carateen');
  gate.resolve([{id:'star',provider:'stardima',type:'embed',embedUrl:'https://v2.hyperwatching.com/watch/Public'}]);await turn();assert.ok(updates.some(rows=>rows.length===2));
  assert.equal(c.requests.some(url=>url.pathname==='/api/stream'),false);
});
