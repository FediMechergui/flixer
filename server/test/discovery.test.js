import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverLibrary } from '../src/library-service.js';

test('hosted browsing pages the combined publication without starting provider crawls',async()=>{
 let calls=0;const shows=Array.from({length:55},(_,n)=>({id:'source-'+n,kind:'series',title:'Series '+n,countries:['TN'],tags:['comedy'],providerUpdatedAt:'2026-10-'+String(1+n%20).padStart(2,'0')}));
 shows.push({id:'foreign',kind:'series',title:'Other country',countries:['TR']},{id:'film',kind:'film',title:'Film',countries:['TN']});
 const catalog={product:'flixer',generatedAt:'2026-10-23',shows},fetchers=[async()=>{calls++;throw Error('Must not crawl from the app request')}];
 const first=await discoverLibrary({kind:'series',collection:'tunisian',catalog,fetchers,cachedOnly:true}),second=await discoverLibrary({kind:'series',collection:'tunisian',page:2,catalog,fetchers,cachedOnly:true});
 assert.equal(calls,0);assert.equal(first.total,55);assert.equal(first.totalPages,3);assert.equal(first.items.length,24);assert.equal(first.generatedAt,catalog.generatedAt);assert.ok(!second.items.some(row=>first.items.some(previous=>previous.id===row.id)));
 assert.equal((await discoverLibrary({kind:'series',collection:'tunisian',genre:'animation',catalog,cachedOnly:true})).items.length,0);
});

test('published catalogue pagination reaches titles beyond the upstream 500-page crawl cap',async()=>{
 const shows=Array.from({length:12030},(_,n)=>({id:'film-'+n,kind:'film',title:'Film '+n}));const result=await discoverLibrary({kind:'film',page:501,catalog:{product:'flixer',shows},cachedOnly:true});
 assert.equal(result.page,501);assert.equal(result.items[0].id,'film-12000');assert.equal(result.totalPages,502);
});
import { parseHdtodayList } from '../src/hdtoday.js';
import { fmoviesServers } from '../src/fmovies.js';
import { fetchFmoviesPage } from '../src/fmovies.js';
import { unifiedStream } from '../src/library-service.js';

test('regional discovery rejects invalid filters and never widens Dahsha',async()=>{
  await assert.rejects(discoverLibrary({collection:'invalid',catalog:{shows:[]}}),/Invalid collection/);
  await assert.rejects(discoverLibrary({product:'dahsha',collection:'indian',catalog:{shows:[]}}),/Invalid collection/);
  const result=await discoverLibrary({product:'flixer',kind:'film',collection:'kdrama',catalog:{shows:[]},fetchers:[()=>{throw new Error('Must not request films for K-drama');}]});
  assert.deepEqual(result.items,[]);
});

test('imported Flixer episodes resolve their existing servers without title network enrichment',async()=>{
  const id='fm:e:123:2:3';
  const catalog={product:'flixer',shows:[{id:'fm:s:123',kind:'series',tmdbId:123,episodes:[{id,season:2,number:3,offerings:[{provider:'fmovies',id}]}]}]};
  const result=await unifiedStream(id,{showId:'fm:s:123',product:'flixer',catalog});
  assert.ok(result.servers.length>=3);
  assert.ok(result.servers.some(s=>s.embedUrl.includes('season=2') || s.embedUrl.includes('/2/3') || s.embedUrl.includes('s=2&e=3')));
  assert.equal(await unifiedStream('fm:e:123:2:99',{showId:'fm:s:123',product:'flixer',catalog,resolveTitle:async()=>catalog.shows[0]}),null);
});

const row=(id,title='Shared',extra={})=>({id,title,kind:'film',year:2024,tags:['animation'],...extra});

test('refresh bypasses saved specialist players and reports resolver failures alongside alternatives',async()=>{
  const id='sp:tuniflix:m:example',show={id,kind:'film',title:'Example',episodes:[{id,offerings:[{provider:'tuniflix',id},{provider:'fmovies',id:'fm:m:123'}]}]};
  let options;
  const result=await unifiedStream(id,{showId:id,catalog:{product:'flixer',shows:[show]},product:'flixer',fresh:true,resolveSpecialist:async(_,opts)=>{options=opts;throw Error('Source unavailable');}});
  assert.equal(options.fresh,true);
  assert.ok(result.servers.some(s=>s.provider==='fmovies'));
  assert.deepEqual(result.providerErrors,[{provider:'tuniflix',error:'Source unavailable'}]);
});

test('quick playback returns verified servers without waiting on other source resolvers',async()=>{
  const id='fm:e:123:2:3',catalog={product:'flixer',shows:[{id:'show',kind:'series',tmdbId:123,episodes:[{id,season:2,number:3,offerings:[{provider:'fmovies',id},{provider:'myflixer',id:'mf:e:example'}]}]}]};
  const result=await unifiedStream(id,{showId:'show',catalog,product:'flixer',quick:true,resolveTitle:()=>{throw new Error('Must not enrich known episode');},resolveMyflixer:()=>{throw new Error('Must not wait for slow source');}});
  assert.ok(result.servers.length>=3);assert.equal(result.servers.some(s=>s.provider==='myflixer'),false);
  const unknown=await unifiedStream('fm:e:123:2:99',{showId:'show',catalog,product:'flixer',quick:true});assert.deepEqual(unknown.servers,[]);
});

test('provider failure cache retains matching regional titles without leaking other collections',async()=>{
  const shows=[{id:'mf:s:korean',kind:'series',title:'Korean series',countries:['KR']},{id:'mf:s:american',kind:'series',title:'American series',countries:['US']}];
  const result=await discoverLibrary({kind:'series',collection:'kdrama',product:'flixer',catalog:{shows},fetchers:[async()=>({items:[],totalPages:1}),async()=>({items:[],totalPages:1}),async()=>{throw new Error('Upstream timeout');}]});
  assert.deepEqual(result.items.map(s=>s.id),['mf:s:korean']);assert.equal(result.providers[2].cached,true);
});
test('regional pages retry inconsistent empty query variants instead of truncating the catalogue',async()=>{
  const calls=[],filter='<select name="country"><option value="KR" selected>Korea</option></select>';
  const result=await fetchFmoviesPage({country:'KR',kind:'series',page:6,fetchHtml:async path=>{
    calls.push(path);return filter+(calls.length===1?'Page 6 of 1 No results':'<a href="/tv/example-123"><article><h3>Example</h3></article></a> Page 6 of 42');
  }});
  assert.equal(calls.length,2);assert.equal(result.totalPages,42);assert.equal(result.items.length,1);assert.deepEqual(result.items[0].countries,['KR']);
  await assert.rejects(fetchFmoviesPage({country:'KR',kind:'series',page:6,fetchHtml:async()=>filter+'Page 6 of 1 No results'}),/cursor retained/);
});

test('unfiltered FMovies films retry an empty cached first page before giving up',async()=>{
 let calls=0;const result=await fetchFmoviesPage({kind:'film',fetchHtml:async()=>++calls===1?'Page 1 of 1 No results':'<a href="/movie/actual-123"><article><h3>Actual film</h3></article></a> Page 1 of 500'});
 assert.equal(calls,2);assert.equal(result.items[0].id,'fm:m:123');assert.equal(result.totalPages,500);
});
test('discovery combines all three providers, preserves canonical IDs and survives one failure',async()=>{
  const result=await discoverLibrary({product:'flixer',kind:'film',page:2,genre:'animation',catalog:{shows:[row('mf:m:shared')]},fetchers:[
    async()=>({items:[row('fm:m:12','Shared',{offerings:[{provider:'fmovies',id:'fm:m:12',tmdbId:12}]})],totalPages:5}),
    async()=>{throw new Error('Rate limited');},
    async()=>({items:[row('mf:m:new','New')],totalPages:8}),
  ]});
  assert.deepEqual(result.items.map(s=>s.id),['mf:m:shared','mf:m:new']);
  assert.equal(result.items[0].offerings.length,2);
  assert.equal(result.totalPages,8);
  assert.equal(result.providerErrors[0].provider,'hdtoday');
});
test('discovery retains documentary policy and never caches complete provider failure as empty success',async()=>{
  const result=await discoverLibrary({product:'dahsha',catalog:{shows:[]},fetchers:[async()=>({items:[row('fm:m:12'),row('fm:m:13','Documentary',{documentary:true,tags:['documentary']})],totalPages:1})]});
  assert.deepEqual(result.items.map(s=>s.id),['fm:m:13']);
  await assert.rejects(discoverLibrary({catalog:{shows:[]},fetchers:[async()=>{throw new Error('offline');}]}),/unavailable/);
});
test('HDToday updates import the advertised episode without inventing earlier episodes',()=>{
  const {items}=parseHdtodayList('<a class="bf-card" href="/watch/tv-example-abcd1234" title="Example - Season 6"><span class="bf-card__genre">Animation</span><span class="bf-card__stamp"><b>S6 E5</b><span>18 h ago</span></span></a>',{kind:'series'});
  assert.equal(items[0].title,'Example');
  assert.deepEqual(items[0].episodes.map(e=>[e.season,e.number]),[[6,5]]);
  assert.ok(items[0].providerUpdatedAt);
});
test('each FMovies player receives its required iframe policy',()=>{
  for(const id of ['fm:m:12','fm:e:12:2:4']) assert.ok(fmoviesServers(id).every(s=>s.sandbox===null));
});

test('a blocked provider retains its imported catalogue page with explicit cached status',async()=>{
  const cached=row('hd:m:movie-cached-abcd1234','Cached',{offerings:[{provider:'hdtoday',id:'hd:m:movie-cached-abcd1234'}]});
  const result=await discoverLibrary({product:'flixer',catalog:{shows:[cached]},fetchers:[async()=>({items:[],totalPages:1}),async()=>{throw new Error('HTTP 403');},async()=>({items:[],totalPages:1})]});
  assert.deepEqual(result.items.map(s=>s.id),[cached.id]);
  assert.equal(result.providers[1].cached,true);
  assert.equal(result.providers[1].ok,false);
});
