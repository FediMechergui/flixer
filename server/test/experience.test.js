import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { leanCatalog } from '../src/export-catalog.js';
import { parseFmoviesList } from '../src/fmovies.js';

function fixture(shows) {
  const requests=[];
  const catalog={product:'flixer',shows};
  const context=vm.createContext({window:{FLIXER_CONFIG:{live:false},dispatchEvent:()=>{}},console,URLSearchParams,CustomEvent:class {},localStorage:{getItem:()=>null,setItem:()=>{}},AbortController,setTimeout,clearTimeout,fetch:async input=>{
    const url=String(input);requests.push(url);
    const body=/\/(bootstrap|index)\.json/.test(url)?catalog:{};
    return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(body)};
  }});
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  return {api:new context.window.Api.FlixerApi(),requests};
}

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
