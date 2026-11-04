import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {rankRecentTitles} from '../../shared/recent-updates.js';
import {contentFreshness} from '../../shared/freshness.js';

const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const episode=(number,{provider='carateen',parent='tg-453',season=null,id}={})=>{
  const key=id||`sp:${provider}:e:${parent}:${4000+number}`;
  return {id:key,title:`A real episode ${number}`,season,number,offerings:[{provider,id:key}]};
};
const show=(ep,extra={})=>({id:'sp:carateen:s:tg-453',kind:'series',title:'المحقق كونان',year:1996,access:'public',offerings:[{provider:'carateen',id:'sp:carateen:s:tg-453'}],episodes:ep?[ep]:[],latestEpisode:ep?.id,contentUpdatedAt:'2026-11-01T12:00:00Z',...extra});

async function client({shows=[],storage=new Map(),index,request}={}){
  const catalog={product:'flixer',generatedAt:'2026-11-01T00:00:00Z',shows:structuredClone(shows)};
  const requests=[];
  const context=vm.createContext({window:{FLIXER_CONFIG:{apiBase:'https://backend.test',dataBase:'https://backend.test',mobile:true,live:false},location:{hash:'#/home'},dispatchEvent(){},addEventListener(){},removeEventListener(){}},document:{visibilityState:'visible',addEventListener(){}},console,URL,URLSearchParams,Headers,DOMException,AbortController,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===750?0:ms,...args),clearTimeout,setInterval,fetch:async input=>{
    const url=new URL(String(input),'https://backend.test');requests.push(url);
    let body=await request?.(url);
    if(body===undefined)body=url.pathname==='/data/index.json'&&index?await index:/\/(bootstrap|index)\.json$/.test(url.pathname)?catalog:url.pathname==='/api/search'?url.searchParams.has('providers')?{providers:['carateen','fmovies']}:{items:[]}:{};
    return {ok:true,status:200,headers:new Headers(),text:async()=>JSON.stringify(body)};
  }});
  for(const name of ['universes.js','tvmaze.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  vm.runInContext(source,context);
  const api=new context.window.Api.FlixerApi();await api.catalog();
  return {api,storage,requests,ready:async()=>{await api._indexReady;await api._metadataReady;}};
}

test('an older index arriving after a live episode cannot revert the latest episode card',async()=>{
  const gate=deferred(),old=show(episode(2)),fresh=show(episode(4),{contentUpdatedAt:'2026-11-03T12:00:00Z'});
  const c=await client({shows:[show(episode(1))],index:gate.promise});
  try{
    c.api._merge([fresh]);c.api._reindex();
    assert.equal((await c.api.item(fresh.id)).recentEpisode.number,4);
    gate.resolve({product:'flixer',generatedAt:'2026-11-02T00:00:00Z',shows:[old]});await c.ready();
    const item=await c.api.item(fresh.id);
    assert.equal(item.recentEpisode.number,4);assert.equal(item.recentEpisode.title,'A real episode 4');
    assert.equal(item.updatedAt,'2026-11-03T12:00:00.000Z');
    assert.equal(c.api._byId.get(fresh.id).latestEpisode,fresh.latestEpisode);
  }finally{gate.resolve({product:'flixer',shows:[]});await c.ready();}
});

test('canonical episode aliases survive compact delta persistence and a cold restart without guide hydration',async()=>{
  const alias=episode(8),canonical={...alias,id:'mf:e:canonical-eight',offerings:[{provider:'myflixer',id:'mf:e:canonical-eight'},...alias.offerings]};
  const row=show(canonical,{latestEpisode:alias.id,contentUpdatedAt:'2026-11-03T12:00:00Z'}),storage=new Map();
  const c=await client({storage});await c.ready();c.api._merge([row]);c.api._reindex();
  assert.equal((await c.api.item(row.id)).recentEpisode.id,canonical.id);
  const saved=JSON.parse(storage.get('flixer:delta')).find(item=>item.id===row.id);
  assert.equal(saved.latestEpisode,canonical.id);assert.equal(saved.recentEpisode.number,8);
  assert.equal(saved.episodes,undefined,'the home delta must stay compact rather than storing entire guides');
  const restarted=await client({storage});await restarted.ready();
  const item=await restarted.api.item(row.id);
  assert.equal(item.recentEpisode.id,canonical.id);assert.equal(item.recentEpisode.number,8);
  assert.equal(item.recentEpisode.season,null);assert.equal(item.updateKind,'episodes');
  assert.deepEqual(Array.from(item.recentEpisode.providers),['myflixer','carateen']);
  assert.equal(restarted.requests.some(url=>url.pathname==='/api/title'||url.pathname.startsWith('/data/shows/')),false);
});

test('a saved new episode remains visible after restarting against an older bundled guide',async()=>{
  const storage=new Map(),base=show(episode(1)),c=await client({storage,shows:[base]});await c.ready();
  c.api._merge([show(episode(7),{contentUpdatedAt:'2026-11-03T12:00:00Z'})]);c.api._reindex();
  const restarted=await client({storage,shows:[base]});await restarted.ready();
  const item=await restarted.api.item(base.id);
  assert.equal(item.recentEpisode.number,7);assert.equal(item.recentEpisode.title,'A real episode 7');
  assert.equal(item.updatedAt,'2026-11-03T12:00:00.000Z');
});

test('unknown-season episode numbers advance only within the same source parent without newer timestamp evidence',async()=>{
  const c=await client({shows:[show(episode(4))]});await c.ready();
  c.api._merge([show(episode(400,{provider:'wco',parent:'another-guide'}))]);c.api._reindex();
  assert.equal((await c.api.item(show().id)).recentEpisode.number,4,'another source guide does not win merely because its number is larger');
  c.api._merge([show(episode(5))]);c.api._reindex();
  assert.equal((await c.api.item(show().id)).recentEpisode.number,5);
  c.api._merge([show(episode(2),{contentUpdatedAt:'2026-11-03T12:00:00Z'})]);c.api._reindex();
  assert.equal((await c.api.item(show().id)).recentEpisode.number,5,'later observation of an older numbered episode cannot move the pointer backwards');
});

test('Carateen Latin query evidence retains Arabic results and canonical aliases without accepting another provider default',async()=>{
  const canonical=show(null,{id:'fm:t:canonical',offerings:[{provider:'fmovies',id:'fm:t:canonical'}],latestEpisode:null});
  const c=await client({shows:[canonical],request:url=>url.pathname==='/api/search'&&!url.searchParams.has('providers')?{items:url.searchParams.get('provider')==='carateen'?[show(null,{latestEpisode:null,altTitles:[]})]:[{id:'fm:t:unrelated',kind:'series',title:'Unrelated provider default'}]}:undefined});
  await c.ready();c.api.liveEnabled=true;
  const progressive=[],result=await c.api.search('Detective Conan',{onLocal:page=>progressive.push(page)});
  assert.deepEqual(Array.from(result.items,item=>item.id),[canonical.id]);
  assert.equal(result.items[0].title,'المحقق كونان');assert.deepEqual(Array.from(result.items[0].altTitles),[]);
  assert.ok(progressive.some(page=>page.items.some(item=>item.id===canonical.id)));
  assert.ok(result.items[0].providers.some(provider=>provider.id==='carateen'));
  assert.equal(c.requests.some(url=>url.pathname==='/api/title'),false);
});

test('source search keywords survive offline restarts without becoming merge aliases',async()=>{
  const storage=new Map(),c=await client({storage});await c.ready();
  c.api._merge([show(null,{sourceSearchText:'Detective Conan Case Closed',altTitles:[],latestEpisode:null})]);c.api._reindex();
  const restarted=await client({storage});await restarted.ready();
  const result=await restarted.api.search('Case Closed');
  assert.equal(result.items.length,1);assert.equal(result.items[0].title,'المحقق كونان');
  assert.deepEqual(Array.from(result.items[0].altTitles),[]);assert.match(result.items[0].sourceSearchText,/Case Closed/);
  assert.equal(restarted.requests.some(url=>url.pathname==='/api/search'),false);
});

test('home and See all preserve shared chronology and source diversity without repeats or response-arrival priority',async()=>{
  const rows=[];
  for(const [provider,count] of [['fmovies',40],['wco',4],['carateen',4]])for(let i=0;i<count;i++)rows.push({id:`sp:${provider}:s:series-${String(i).padStart(3,'0')}`,kind:'series',title:`${provider} ${i}`,offerings:[{provider,id:`sp:${provider}:s:series-${String(i).padStart(3,'0')}`}],contentUpdatedAt:'2026-11-03T12:00:00Z'});
  rows.push({id:'fm:t:newest',kind:'series',title:'Actually newer',contentUpdatedAt:'2026-11-03T12:00:01Z'});
  const c=await client({shows:rows});await c.ready();
  const expected=rankRecentTitles(rows).map(row=>row.id);
  assert.deepEqual(Array.from(await c.api.trending(),item=>item.id),expected.slice(0,24));
  const filters={sort:'updated'},first=await c.api.discover('all',filters,1);
  assert.deepEqual(Array.from(first.items,item=>item.id),expected.slice(0,24));
  const old={id:'sp:carateen:s:old-page',kind:'series',title:'Old source page arriving later',contentUpdatedAt:'2025-01-01T00:00:00Z'};
  c.api._merge([old]);c.api._reindex();c.api._browseSessions.get(JSON.stringify(['all',filters])).buffer.push(old.id);
  const second=await c.api.discover('all',filters,2),third=await c.api.discover('all',filters,3);
  const seen=[...first.items,...second.items,...third.items].map(item=>item.id);
  assert.deepEqual(seen,rankRecentTitles([...rows,old]).map(row=>row.id));
  assert.equal(new Set(seen).size,seen.length);assert.equal(seen.at(-1),old.id);
});

test('large recent home selection sorts only bounded provider candidates and matches full shared ranking',()=>{
  const start=source.indexOf('  const recentProvider='),end=source.indexOf('  const byYearDesc',start);
  const context=vm.createContext({});
  vm.runInContext("const byUpdated=(a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')||String(a.id).localeCompare(String(b.id));const sizes=[];const originalSort=Array.prototype.sort;Array.prototype.sort=function(...args){sizes.push(this.length);return originalSort.apply(this,args);};"+source.slice(start,end)+';globalThis.select=topRecentItems;globalThis.sortSizes=sizes;',context);
  const providers=['fmovies','carateen','hdtoday','wco'];
  const rows=Array.from({length:50000},(_,i)=>{const provider=providers[i%11<8?0:1+(i%11-8)],id=`sp:${provider}:s:${String(i).padStart(6,'0')}`;return Object.freeze({id,kind:'series',title:`Show ${i}`,offerings:[{provider,id}],contentUpdatedAt:new Date(Date.UTC(2026,10,3,12,0,i%7)).toISOString()});});
  const items=Object.freeze(rows.map(row=>Object.freeze({...row,updatedAt:contentFreshness(row).at}))),before=Array.from(items);
  const expected=rankRecentTitles(rows,{limit:24}).map(row=>row.id),actual=context.select(items,24);
  assert.deepEqual(Array.from(actual,item=>item.id),expected);assert.equal(actual.length,24);
  assert.ok(Math.max(...context.sortSizes)<=24*providers.length,'the catalogue itself must never be sorted for the home row');
  assert.deepEqual(Array.from(items),before);assert.deepEqual(Array.from(context.select(items,0)),[]);
  assert.deepEqual(Array.from(context.select([...items,items[0]],24),item=>item.id),expected,'duplicate canonical IDs do not consume another candidate slot');
});
