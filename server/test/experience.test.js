import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { leanCatalog } from '../src/export-catalog.js';
import { parseFmoviesList } from '../src/fmovies.js';
import {auditServer} from '../../scripts/audit-server.js';

function fixture(shows, streams = {}, respond, options = {}) {
  const requests=[];
  const catalog={product:'flixer',shows,generatedAt:options.generatedAt};
  const storage=options.storage||new Map();
  const events=[],listeners=new Map();
  const context=vm.createContext({window:{FlixerBrowser:options.browser,FLIXER_CONFIG:{live:false,...options.config},dispatchEvent:e=>{events.push(e);for(const listener of listeners.get(e.type)||[])listener(e);},addEventListener:(type,listener)=>{if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},removeEventListener:(type,listener)=>listeners.get(type)?.delete(listener)},console,URL,URLSearchParams,CustomEvent:class {constructor(type,opts){this.type=type;this.detail=opts?.detail;}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},AbortController,setTimeout,clearTimeout,fetch:async input=>{
    const url=String(input);requests.push(url);
    const custom=options.fetchBody?await options.fetchBody(url):undefined;
    const body=custom!==undefined?custom:url.includes('/data/index.json')&&options.index?await options.index:url.includes('/api/discover?')&&respond?await respond(url):url.includes('/api/stream?')?streams:/\/(bootstrap|index)\.json/.test(url)?catalog:{};
    return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(body)};
  }});
  context.window.FlixerArabicSource=options.arabicSource;
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  return {api:new context.window.Api.FlixerApi(),requests,events};
}

test('small bundled index parts load completely while preserving a newer saved home title',async()=>{
 const generation='2026-10-21',rows=[{id:'one',kind:'film',title:'Old title',aliasIds:['fm:m:1']},{id:'two',kind:'series',title:'Second title',countries:['TN'],collections:['tunisian']}];
 const storage=new Map([['flixer:homeSnapshot',JSON.stringify({product:'flixer',generatedAt:'2026-10-23',shows:[{...rows[0],title:'Current title'}]})]]);
 const {api,requests}=fixture([],{},null,{storage,generatedAt:generation,config:{mobile:true},fetchBody:url=>url==='/data/index.json'?{product:'flixer',generatedAt:generation,count:2,indexParts:['index-0000.json','index-0001.json']}:/^\/data\/index-000[01]\.json$/.test(url)?{product:'flixer',generatedAt:generation,shows:[rows[url.includes('0000')?0:1]]}:undefined});
 await api.catalog();await api._indexReady;await api._metadataReady;
 assert.equal(api._catalog.shows.length,2);assert.equal((await api.show('fm:m:1')).title,'Current title');assert.deepEqual(Array.from((await api.show('two')).collections),['tunisian']);assert.ok(requests.includes('/data/index-0001.json'));
});

test('a partial bundled generation never replaces the saved catalogue',async()=>{
 const {api}=fixture([{id:'saved',kind:'film',title:'Saved title'}],{},null,{config:{mobile:true},fetchBody:url=>url==='/data/index.json'?{product:'flixer',generatedAt:'2026-10-23',count:2,indexParts:['index-0000.json']}:url==='/data/index-0000.json'?{product:'flixer',generatedAt:'2026-10-23',shows:[{id:'partial',kind:'film',title:'Partial'}]}:undefined});
 await api.catalog();await api._indexReady;await api._metadataReady;assert.deepEqual(Array.from(api._catalog.shows,row=>row.id),['saved']);
});

test('an explicit app backend never falls back to Myflixer after a health-check failure',async()=>{
  const row={id:'sp:tuniflix:m:example',title:'A specialist film',kind:'film'};
  const {api,requests}=fixture([],{},null,{config:{apiBase:'https://backend.test'},fetchBody:url=>{if(url.includes('/api/genres')||url.includes('/data/shows/'))throw new Error('Unavailable');if(url.includes('/api/title?'))return row;}});
  assert.equal((await api.show(row.id)).id,row.id);assert.equal(requests.some(url=>url.includes('wp-json')),false);assert.equal(requests.some(url=>url.includes('/api/genres')),false);
  await api._indexReady;await api._metadataReady;
});

test('recent provider responses cannot pin older films ahead of newer releases',async()=>{
  const {api}=fixture([{id:'old',kind:'film',title:'Old film',latestAt:'2026-01-01'},{id:'new',kind:'series',title:'New release',latestAt:'2026-10-16'}]);
  await api.catalog();api._recentIds=new Set(['old']);assert.equal((await api.trending())[0].id,'new');await api._indexReady;await api._metadataReady;
});

test('film detail descriptions load from published source metadata and notify the open screen',async()=>{
  const row={id:'film',kind:'film',title:'A film'};
  const {api,events}=fixture([row],{},null,{fetchBody:url=>url.includes('/data/shows/')?{...row,blurb:'Actual source description',poster:{custom:'https://source.test/poster.jpg'}}:undefined});
  const detail=await api.details(null,row.id);assert.equal(detail.overview,'Actual source description');assert.equal(detail.poster,'https://source.test/poster.jpg');assert.ok(events.some(e=>e.type==='flixer:title'&&e.detail.id===row.id));await api._indexReady;await api._metadataReady;
});

test('saved fresh home feed and canonical provider aliases survive an older bundled index',async()=>{
  const storage=new Map([['flixer:homeSnapshot',JSON.stringify({product:'flixer',generatedAt:'2026-10-16',shows:[{id:'canonical',kind:'film',title:'Fresh title',aliasIds:['fm:m:77'],latestAt:'2026-10-16'}]})]]);
  const {api}=fixture([{id:'canonical',kind:'film',title:'Old title',latestAt:'2026-01-01'}],{},null,{storage,generatedAt:'2026-01-01'});
  await api.catalog();await api._indexReady;assert.equal((await api.show('fm:m:77')).title,'Fresh title');await api._metadataReady;
});

test('all known compatible Myflixer embeds receive the same player policy',async()=>{
  const {api}=fixture([],{servers:[{type:'embed',embedUrl:'https://multiembed.mov/?video_id=tt123'},{type:'embed',embedUrl:'https://balance.medmedia03.wiki/embed/movie/77'},{type:'embed',embedUrl:'https://unknown.test/player'}]});
  const {servers}=await api.stream('mf:m:example');assert.equal(servers[0].sandbox,null);assert.equal(servers[1].sandbox,null);assert.equal(servers[2].sandbox,undefined);
});

test('empty backend results wait for own-device links and late backend servers extend the same list',async()=>{
 const id='sp:tuniflix:m:race',own={id:'own',provider:'tuniflix',type:'embed',embedUrl:'https://uqload.vc/embed-test.html'},other={id:'remote',type:'embed',embedUrl:'https://other.test/player'};
 let finishDevice;const device=new Promise(resolve=>{finishDevice=resolve;}),updates=[];
 const f=fixture([],{servers:[]},null,{arabicSource:{supports:value=>value===id,resolve:()=>device}});
 const pending=f.api.stream(id,null,{}, {onSources:rows=>updates.push(rows)});await new Promise(resolve=>setTimeout(resolve,5));finishDevice([own]);assert.equal((await pending).servers[0].id,'own');
 let finishRemote;const remote=new Promise(resolve=>{finishRemote=resolve;}),g=fixture([],{},null,{arabicSource:{supports:value=>value===id,resolve:async()=>[own]},fetchBody:url=>url.includes('/api/stream?')?remote:undefined});
 const choices=[];assert.equal((await g.api.stream(id,null,{}, {onSources:rows=>choices.push(rows)})).servers[0].id,'own');finishRemote({servers:[other]});await new Promise(resolve=>setTimeout(resolve,5));assert.deepEqual(Array.from(choices.at(-1),row=>row.id),['own','remote']);
});

test('the Android audit applies the same YouTube descriptor conversion as the production data layer',async()=>{
 const raw={id:'official',name:'Official channel',type:'youtube',provider:'youtube',videoId:'abcdefghijk'}, {api}=fixture([],{servers:[raw]});
 const actual=(await api.stream('episode')).servers[0],audited=auditServer(raw);assert.equal(audited.embedUrl,actual.embedUrl);assert.equal(audited.sandbox,actual.sandbox);assert.equal(auditServer({...raw,videoId:'invalid'}).embedUrl,undefined);
});

test('a verified provider alias opens the canonical movie without duplicate title requests',async()=>{
  const {api,requests}=fixture([{id:'mf:m:film',kind:'film',title:'Film',aliasIds:['fm:m:77'],offerings:[{provider:'fmovies',id:'fm:m:77'}]}]);
  const result=await api.episode('fm:m:77','fm:m:77');assert.equal(result.show.id,'mf:m:film');assert.equal(result.episode.id,'mf:m:film');assert.equal(requests.some(url=>url.includes('/api/title')),false);await api._indexReady;await api._metadataReady;
});

test('scrolling saved catalogue pages never waits for a slow provider',async()=>{
  let complete;const remote=new Promise(resolve=>{complete=resolve;});
  const {api}=fixture(Array.from({length:100},(_,i)=>({id:`film-${i}`,kind:'film',title:`Film ${i}`})),{},()=>remote);
  await api.catalog();await api._indexReady;await api._metadataReady;api.liveEnabled=true;
  try{
    const first=await api.discover('movie',{sort:'title'},1);
    const second=await Promise.race([api.discover('movie',{sort:'title'},2),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Saved page blocked on provider')),100))]);
    assert.ok(first.items.length);assert.ok(second.items.length);assert.equal(second.items.some(i=>first.items.some(j=>i.id===j.id)),false);
  }finally{api.liveEnabled=false;complete({items:[],totalPages:1});await Promise.all([...api._browseSessions.values()].map(s=>s.pending));}
});

test('delayed bundled index cannot revert live titles, slugs, artwork or recent ordering',async()=>{
  const old={id:'mf:m:old',kind:'film',title:'Old title',slug:'old',sourceUrl:'https://source.test/old',poster:{custom:'https://source.test/old.jpg'},publishedAt:'2025-01-01'};
  let finish;const index=new Promise(resolve=>{finish=resolve;});
  const {api}=fixture([old],{},{}, {generatedAt:'2026-01-01',index});
  await api.catalog();
  api._merge([{...old,title:'Correct title',slug:'correct',sourceUrl:'https://source.test/correct',poster:{custom:'https://source.test/new.jpg'},latestAt:'2026-10-15'}]);api._reindex();
  finish({product:'flixer',generatedAt:'2026-01-01',shows:[{...old}]});await api._indexReady;await api._metadataReady;
  const item=await api.item(old.id),raw=await api.show(old.id);
  assert.equal(item.title,'Correct title');assert.equal(item.poster,'https://source.test/new.jpg');assert.equal(raw.slug,'correct');assert.equal(item.sourceUrl,'https://source.test/correct');assert.equal(Date.parse(item.updatedAt),Date.parse('2026-10-15'));
});

test('fresh cached entries survive an app restart and alternate providers preserve canonical URLs',async()=>{
  const storage=new Map(),base={id:'mf:m:original',kind:'film',title:'A title',slug:'original',year:2024,sourceUrl:'https://source.test/original'};
  const first=fixture([{...base}],{},null,{storage,generatedAt:'2026-01-01'});await first.api.catalog();await first.api._indexReady;await first.api._metadataReady;
  first.api._merge([{...base,title:'Updated title',slug:'updated',firstEpisodeId:'mf:e:updated',sourceUrl:'https://source.test/updated'}]);first.api._reindex();
  const restarted=fixture([{...base}],{},null,{storage,generatedAt:'2026-01-01'});await restarted.api.catalog();await restarted.api._indexReady;await restarted.api._metadataReady;
  assert.equal((await restarted.api.item(base.id)).title,'Updated title');assert.equal((await restarted.api.item(base.id)).firstEpisodeId,'mf:e:updated');
  restarted.api._merge([{id:'fm:m:other',kind:'film',title:'Updated title',year:2024,sourceUrl:'https://another.test/title'}]);restarted.api._reindex();
  assert.equal((await restarted.api.item(base.id)).sourceUrl,'https://source.test/updated');assert.equal(restarted.api._byId.get('fm:m:other').id,base.id);
});

test('Arabic recent titles remain recent across empty refreshes and app restarts',async()=>{
  const storage=new Map(),row={id:'sp:ahwaktv:m:sample',kind:'film',title:'Arabic title',publishedAt:'2026-10-15'};
  let empty=false;
  const first=fixture([],{},()=>({items:empty?[]:[row],totalPages:1}),{storage,generatedAt:'2026-01-01'});
  await first.api.catalog();await first.api._indexReady;await first.api._metadataReady;
  await first.api.sync();assert.equal((await first.api.trending())[0].id,row.id);
  empty=true;await first.api.sync();assert.equal((await first.api.trending())[0].id,row.id);
  const restarted=fixture([],{},null,{storage,generatedAt:'2026-01-01'});await restarted.api.catalog();await restarted.api._indexReady;await restarted.api._metadataReady;
  assert.equal((await restarted.api.trending())[0].id,row.id);
});

test('source YouTube servers reach the APK player with validated video IDs',async()=>{
  const {api}=fixture([], {servers:[{type:'youtube',videoId:'P4UF0xAnc0M',name:'Source video'},{type:'youtube',videoId:'../invalid'}]});
  const result=await api.stream('sp:streamtunisie:e:example');
  assert.equal(result.servers.length,1);
  assert.equal(result.servers[0].name,'Source video');
  assert.equal(result.servers[0].embedUrl,'https://www.youtube.com/embed/P4UF0xAnc0M?autoplay=1&playsinline=1&rel=0');
});

test('episode cards use source artwork and summaries before the show poster fallback',async()=>{
  const {api}=fixture([{id:'series',kind:'series',title:'A series',portrait:'https://source.test/show.jpg',episodes:[{id:'ep1',season:null,number:1,poster:{custom:'https://source.test/episode.jpg'},synopsis:'An episode summary'},{id:'ep2',season:null,number:2}]}]);
  const detail=await api.details(null,'series');
  assert.equal(detail.episodes[0].still,'https://source.test/episode.jpg');assert.equal(detail.episodes[0].overview,'An episode summary');assert.equal(detail.episodes[1].still,'https://source.test/show.jpg');
  await api._indexReady;await api._metadataReady;
});

test('Arabic titles, bilingual aliases and regional collections remain searchable independently',async()=>{
  const {api}=fixture([{id:'tn',kind:'film',title:'الإبرة',altTitles:['The Needle'],countries:['TN']},{id:'eg',kind:'film',title:'مسرحية',countries:['EG'],collections:['plays'],tags:['theatre']},{id:'us',kind:'film',title:'An English film',countries:['US']}]);
  const found=await api.search('The Needle');assert.equal(found.items[0].id,'tn');
  const arabic=await api.search('الابرة');assert.equal(arabic.items[0].id,'tn');
  const all=await api.all();assert.equal(api.inCollection(all.find(i=>i.id==='tn'),'tunisian'),true);assert.equal(api.inCollection(all.find(i=>i.id==='us'),'arabic'),false);assert.equal(api.inCollection(all.find(i=>i.id==='eg'),'plays'),true);
});

test('known episode playback does not wait for title refresh or the optional episode guide',async()=>{
  const {api,requests}=fixture([{id:'series',kind:'series',title:'A series',tvm:{id:99},episodes:[{id:'ep1',season:1,number:1},{id:'ep2',season:1,number:2}]}]);
  await api.catalog();api.liveEnabled=true;
  api.details=()=>{throw new Error('Must not refresh a known episode');};
  api.tvmaze.episodes=()=>{throw new Error('Must not fetch optional artwork before playback');};
  const result=await api.episode('series','ep1');
  assert.equal(result.episode.id,'ep1');assert.equal(result.next.id,'ep2');
  assert.equal(requests.some(url=>url.includes('/api/title')),false);
  api.liveEnabled=false;await api._indexReady;await api._metadataReady;
});

test('unknown episode still resolves details instead of inventing a playable entry',async()=>{
  const {api}=fixture([{id:'series',kind:'series',title:'A series'}]);
  api.details=async()=>({episodes:[{id:'actual',season:1,number:1}]});
  await assert.rejects(api.episode('series','nonexistent'),/Episode not found/);
  await api._indexReady;await api._metadataReady;
});

test('source episode groups retain unknown numbering and continue within their own provider',async()=>{
  const ep=(provider,slug,number)=>({id:`sp:${provider}:e:${slug}`,season:null,number,offerings:[{provider,id:`sp:${provider}:e:${slug}`}]});
  const {api}=fixture([{id:'mixed',kind:'series',title:'Mixed source numbering',episodes:[
    ep('animegg','first-episode-1',1),ep('yoturkish','other-episode-1',1),ep('animegg','first-episode-2',2),ep('megacartoons','unknown-title',null),
  ]}]);
  const result=await api.episode('mixed','sp:animegg:e:first-episode-1');
  assert.equal(result.next.id,'sp:animegg:e:first-episode-2');assert.equal(result.total,2);
  assert.equal(result.show.episodes.find(e=>e.id==='sp:megacartoons:e:unknown-title').n,null);
  assert.ok(result.show.seasons.some(s=>s.name==='Source episodes - AnimeGG'));
  await api._indexReady;await api._metadataReady;
});

test('collections preserve regional and animation distinctions without inventing sub or dub availability',async()=>{
  const {api}=fixture([
    {id:'kr',kind:'series',title:'Korean drama',tags:['drama'],originalLanguage:'ko'},
    {id:'in',kind:'film',title:'Tamil film',originalLanguage:'ta'},
    {id:'tr',kind:'series',title:'Turkish series',originalLanguage:'tr'},
    {id:'anime',kind:'series',title:'Japanese animation',tags:['animation'],tvm:{c:'JP'}},
    {id:'dub',kind:'series',title:'Confirmed dub',tags:['animation'],originalLanguage:'ja',audioMode:'dub'},
    {id:'cartoon',kind:'series',title:'Old cartoon',tags:['animation'],year:1965,tvm:{c:'US'}},
    {id:'unknown',kind:'film',title:'Unknown metadata'}
  ]);
  await api.catalog();await api._indexReady;
  for(const [collection,ids] of [['kdrama',['kr']],['indian',['in']],['turkish',['tr']],['anime',['anime','dub']],['anime-sub',[]],['anime-dub',['dub']],['classic-cartoons',['cartoon']]]) {
    const result=await api.discover('all',{collection,sort:'title'},1);
    assert.deepEqual(Array.from(result.items,i=>i.id).sort(),ids.sort());
  }
  await api._metadataReady;
});

test('local search results are delivered before wider search and export retains collection evidence',async()=>{
  const {api}=fixture([{id:'film',kind:'film',title:'A Tamil Film',originalLanguage:'ta',countries:['IN'],audioMode:'sub'}]);
  let local;
  const result=await api.search('Tamil',{onLocal:r=>{local=r;}});
  assert.equal(local.items[0].id,'film');assert.equal(result.items[0].id,'film');
  const lean=leanCatalog({shows:[{id:'film',kind:'film',originalLanguage:'ta',countries:['IN'],audioMode:'sub'}]},'flixer');
  assert.equal(lean.shows[0].originalLanguage,'ta');assert.deepEqual(lean.shows[0].countries,['IN']);assert.equal(lean.shows[0].audioMode,'sub');
  await api._metadataReady;
});

test('quality and media badges are never imported as language codes',()=>{
  const html='<a href="/movie/example-123"><article><h3>Example</h3><span>HD</span><span>2024</span></article></a><p>Page 1 of 1</p>';
  const result=parseFmoviesList(html);
  assert.equal(result.items[0].lang,null);assert.equal(result.items[0].contentLang,null);
});

test('French source titles start their actual language-specific players before generic TV alternatives',async()=>{
 const {api,requests}=fixture([],{servers:[{id:'frenchstream:vidzy:vf',provider:'frenchstream',name:'French Stream VF',type:'embed',embedUrl:'https://vidzy.cc/embed-a.html',sandbox:null}]},null,{config:{apiBase:'https://backend.test'}});
 const result=await api.stream('sp:frenchstream:e:123:2:1',null,{id:'sp:frenchstream:s:123',tmdbId:77},{onSources:()=>{}});
 assert.equal(result.servers[0].provider,'frenchstream');assert.equal(requests.filter(url=>url.includes('/api/stream?')).length,1);assert.equal(requests.some(url=>url.includes('mode=quick')),false);
});

test('series details render cached episodes while live checks add new seasons in the background',async()=>{
 let finish;const gate=new Promise(resolve=>finish=resolve);
 const row={id:'sp:frenchstream:s:123',kind:'series',title:'A series',poster:{custom:'https://example.com/a.jpg'},synopsis:'Source synopsis',episodes:[]};
 const prior={id:'sp:frenchstream:e:123:1:1',season:1,number:1,title:'First'};
 const next={id:'sp:frenchstream:e:124:2:1',season:2,number:1,title:'New season'};
 const {api,events}=fixture([row],{},null,{config:{apiBase:'https://backend.test'},fetchBody:async url=>{if(url.includes('/data/shows/'))return {...row,episodes:[prior]};if(url.includes('/api/title?')){await gate;return {...row,episodes:[prior,next]};}}});
 await api.catalog();await api._indexReady;api.liveEnabled=true;
 const detail=await Promise.race([api.details('tv',row.id),new Promise((_,reject)=>setTimeout(()=>reject(Error('Detail page waited for live refresh')),500))]);
 assert.equal(detail.episodes.length,1);const refresh=api._titleRequests.get(row.id);assert.ok(refresh);finish();await refresh;
 assert.equal((await api._build(await api.show(row.id))).seasons.length,2);assert.ok(events.some(e=>e.type==='flixer:title'&&e.detail.id===row.id));
});

test('film artwork recovery tries alternate source posters instead of stopping at a broken primary',async()=>{
 const row={id:'movie',title:'A film',kind:'film',portrait:'https://example.com/broken.jpg',poster:{custom:'https://example.com/good.jpg'}};
 const {api}=fixture([row]);await api.catalog();await api._indexReady;
 assert.equal(await api.posterFallback('movie',['https://example.com/broken.jpg']),'https://example.com/good.jpg');
 assert.equal(await api.posterFallback('movie',['https://example.com/broken.jpg','https://example.com/good.jpg']),null);
});
test('first-open playback waits for a delayed saved episode instead of reporting it missing',async()=>{
 const row={id:'mf:s:cold-series',kind:'series',title:'Cold series'},ep={id:'mf:e:cold-series-s01e01',title:'First',season:1,number:1,offerings:[{provider:'dessinanime',id:'sp:dessinanime:e:456-les-simpson:1:1'}]};
 const {api}=fixture([row],{},null,{fetchBody:async url=>{if(url.includes('/data/shows/')){await new Promise(resolve=>setTimeout(resolve,350));return {...row,episodes:[ep],synopsis:'Source synopsis'};}}});
 const start=Date.now(),result=await api.episode(row.id,ep.id);assert.equal(result.episode.id,ep.id);assert.ok(Date.now()-start<1500);await api._indexReady;await api._metadataReady;
});

test('Android requests direct transport and keeps video segments off the API backend',async()=>{
 const {api,requests}=fixture([],{servers:[{id:'hls',type:'hls',streamUrl:'https://backend.example/api/stream?proxy=1',rawStreamUrl:'https://cdn.example/master.m3u8',headers:{Referer:'https://source.example/'}}]},null,{browser:{hasNativeVideo:()=>true}});
 const result=await api.stream('mf:m:example');assert.equal(result.servers[0].streamUrl,'https://cdn.example/master.m3u8');assert.ok(requests.find(url=>url.includes('/api/stream?')&&url.includes('transport=direct')));assert.equal(result.servers[0].headers.Referer,'https://source.example/');
});

test('numbered seasons are listed before source episode groups',async()=>{
  const ep=(slug,season,number)=>({id:`sp:wco:e:o:${slug}`,season,number,offerings:[{provider:'wco',id:`sp:wco:e:o:${slug}`}]});
  const {api}=fixture([{id:'ordered',kind:'series',title:'Ordered seasons',episodes:[ep('o-shorts-episode-1',null,1),ep('o-season-2-episode-1',2,1),ep('o-episode-1',1,1)]}]);
  const result=await api.episode('ordered','sp:wco:e:o:o-episode-1');
  assert.deepEqual(Array.from(result.show.seasons.slice(0,2),s=>s.season_number),[1,2]);
  assert.ok(result.show.seasons[2].season_number<=0);assert.equal(result.show.seasons[2].name,'Source episodes - Watch Cartoon Online');
  await api._indexReady;await api._metadataReady;
});
