import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {specialistJobs,parseSpecialistId,specialistUrl,specialistIdFromUrl} from '../src/specialist-providers.js';
import {SEARCH_PROVIDERS,unifiedSearch,unifiedStream,unifiedTitle,validPlaybackId} from '../src/library-service.js';
import {mergeLibrary} from '../src/merge-library.js';
import {refreshSeriesEpisodes} from '../src/episode-refresh.js';
import {leanCatalog} from '../src/export-catalog.js';
import {extendSpecialistScopes} from '../src/provider-sync.js';
import {STARDIMA_IMPORT_JOBS,stardimaPartitionKey} from '../src/stardima-import.js';

const slug='6accbd76b0e02',sourceId='sp:stardima:s:'+slug;
const sourceEpisode=(id,season,number)=>({id:`sp:stardima:e:${slug}:${id}`,season,number,title:`Episode ${number}`,audioModes:['dub'],audioLanguages:['ar'],offerings:[{provider:'stardima',id:`sp:stardima:e:${slug}:${id}`,audioModes:['dub'],audioLanguages:['ar']}]});
const sourceShow={id:sourceId,title:'العرض',altTitles:['A Cartoon'],kind:'series',year:2016,tmdbId:77,documentary:false,collections:['arabic','cartoons'],tags:['animation'],audioLanguages:['ar'],sourceUrl:`https://www.stardima.com/tvshow/${slug}`,offerings:[{provider:'stardima',id:sourceId}],episodes:[sourceEpisode(104745,1,1),sourceEpisode(104749,1,9)]};

test('StarDima joins both catalogue lanes and the simultaneous search registry with strict source identities',()=>{
  assert.ok(SEARCH_PROVIDERS.includes('stardima'));
  assert.deepEqual(specialistJobs().filter(row=>row.provider==='stardima').map(row=>row.kind),['film','series']);
  assert.equal(specialistJobs({kind:'series',collection:'arabic',latest:true}).some(row=>row.provider==='stardima'&&row.latest),true);
  assert.equal(parseSpecialistId(sourceId)?.provider,'stardima');
  assert.equal(specialistUrl(sourceId),sourceShow.sourceUrl);
  assert.equal(specialistIdFromUrl(sourceShow.sourceUrl),sourceId);
  assert.ok(validPlaybackId(sourceShow.episodes[0].id));
  assert.equal(specialistIdFromUrl(`https://www.stardima.com.evil.test/tvshow/${slug}`),null);
  assert.equal(specialistIdFromUrl(`https://user@www.stardima.com/tvshow/${slug}`),null);
});

test('adding StarDima historical lanes preserves active crawl cursors and leaves Dahsha untouched',()=>{
  const ongoing={provider:'fmovies',kind:'film',page:39,cursor:'saved-position'},existing={provider:'stardima',kind:'series',collection:'',page:3,cursor:'saved-series'};
  const cache={specialistScopesVersion:9,completed:true,queue:[ongoing,existing]};
  const seeds=[...specialistJobs(),...STARDIMA_IMPORT_JOBS.filter(job=>job.collection).map(job=>({...job,page:1}))];
  extendSpecialistScopes(cache,seeds,'flixer');
  assert.equal(cache.queue[0],ongoing);
  assert.equal(cache.queue[1],existing);
  assert.equal(cache.queue[0].page,39);
  assert.equal(cache.queue[1].cursor,'saved-series');
  assert.equal(cache.queue.filter(row=>row.provider==='stardima'&&row.kind==='series'&&row.collection==='').length,1);
  assert.equal(cache.queue.find(row=>row.provider==='stardima'&&row.kind==='film').page,1);
  assert.equal(cache.queue.length,7,'only the six StarDima partitions join the existing unrelated cursor');
  assert.equal(cache.specialistScopesVersion,10);
  assert.equal(cache.completed,false);
  const size=cache.queue.length;extendSpecialistScopes(cache,seeds,'flixer');assert.equal(cache.queue.length,size);
  const dahsha={specialistScopesVersion:9,completed:true,queue:[ongoing]};
  extendSpecialistScopes(dahsha,seeds,'dahsha');
  assert.deepEqual(dahsha,{specialistScopesVersion:9,completed:true,queue:[ongoing]});
  const covered={specialistScopesVersion:9,completed:true,queue:[ongoing],stardimaCoverage:{version:1,partitions:Object.fromEntries(STARDIMA_IMPORT_JOBS.map(job=>[stardimaPartitionKey(job),{complete:true,nextPage:4}]))}};
  covered.stardimaCoverage.partitions['series:anime']={complete:false,nextPage:7};
  extendSpecialistScopes(covered,seeds,'flixer');
  assert.equal(covered.queue.length,2,'the dedicated backfill must not be restarted by the regular refresh');
  assert.deepEqual(covered.queue[1],{provider:'stardima',kind:'series',collection:'anime',page:7});
});

test('verified StarDima titles retain Arabic alternatives and actual episode routes through merge, export and playback',async()=>{
  const base={id:'mf:s:a-cartoon',title:'A Cartoon',kind:'series',year:2016,tmdbId:77,episodes:[{id:'mf:e:a-cartoon-1',title:'Episode 1',season:1,number:1,offerings:[{provider:'myflixer',id:'mf:e:a-cartoon-1'}]}],offerings:[{provider:'myflixer',id:'mf:s:a-cartoon'}]};
  const {catalog}=mergeLibrary({product:'flixer',shows:[base]},[sourceShow],{product:'flixer'});
  assert.equal(catalog.shows.length,1);
  const show=catalog.shows[0];
  assert.equal(show.id,base.id);
  assert.deepEqual(show.episodes.map(row=>row.number),[1,9],'missing episode numbers must not become placeholder routes');
  assert.equal(show.episodes[0].id,'mf:e:a-cartoon-1');
  assert.equal(show.episodes[0].offerings.find(row=>row.provider==='stardima').id,sourceShow.episodes[0].id);
  const exported=leanCatalog(catalog,'flixer').shows[0];
  assert.ok(exported.altTitles.includes(sourceShow.title));
  assert.deepEqual(exported.audioLanguages,['ar']);
  assert.ok(exported.episodes[0].offerings.some(row=>row.provider==='stardima'));
  const calls=[];
  const streams=await unifiedStream(show.episodes[0].id,{showId:show.id,product:'flixer',catalog,fresh:true,transport:'direct',resolveTitle:async()=>show,resolveMyflixer:async()=>({servers:[]}),resolveSpecialist:async(id,options)=>{calls.push({id,options});return [{id:'stardima:public',provider:'stardima',type:'embed',embedUrl:'https://v2.hyperwatching.com/watch/TestPublicId'}];}});
  assert.deepEqual(calls,[{id:sourceShow.episodes[0].id,options:{fresh:true,transport:'direct'}}]);
  assert.ok(streams.servers.some(row=>row.provider==='stardima'));
  assert.equal(mergeLibrary({shows:[]},[sourceShow],{product:'dahsha'}).catalog.shows.length,0);
  assert.equal(await unifiedTitle(sourceId,{product:'dahsha',catalog:{product:'dahsha',shows:[]}}),null);
  let queried=false;
  assert.deepEqual(await unifiedSearch('A Cartoon',{product:'dahsha',provider:'stardima',catalog:{shows:[]},fetchers:{stardima:async()=>{queried=true;return [sourceShow];}}}),[]);
  assert.equal(queried,false,'documentary-only Dahsha never queries StarDima');
});

test('StarDima episode refresh keeps older real episodes and appends source-confirmed new seasons',async()=>{
  const old={...sourceShow,episodes:[sourceShow.episodes[0]]};
  const updated=await refreshSeriesEpisodes([old],{now:Date.parse('2026-11-03T12:00:00Z'),resolveDetails:async row=>({...row,episodes:[sourceEpisode(110003,2,3)],episodesComplete:false})});
  assert.deepEqual(updated.items[0].episodes.map(row=>[row.season,row.number]),[[1,1],[2,3]]);
  assert.equal(updated.report.addedEpisodes,1);
  assert.equal(updated.items[0].latestEpisode,`sp:stardima:e:${slug}:110003`);
  assert.equal(updated.items[0].episodesComplete,false);
  const blocked=await refreshSeriesEpisodes(updated.items,{now:Date.parse('2026-11-04T12:00:00Z'),resolveDetails:async()=>{throw Error('HTTP 403');}});
  assert.equal(blocked.report.errors[0].provider,'stardima');
  assert.deepEqual(blocked.items[0].episodes,updated.items[0].episodes);
});

test('the APK searches StarDima when provider discovery is unavailable and shows its source badge',async()=>{
  const catalog={product:'flixer',shows:[{id:'mf:s:a-cartoon',title:'A Cartoon',kind:'series',year:2016,tmdbId:77,tags:['animation'],episodes:[]}]};
  const requests=[];
  const context=vm.createContext({window:{FLIXER_CONFIG:{apiBase:'https://backend.test',live:false},dispatchEvent:()=>{}},console,URL,URLSearchParams,localStorage:{getItem:()=>null,setItem:()=>{}},AbortController,setTimeout,clearTimeout,CustomEvent:class{},fetch:async input=>{
    const url=new URL(String(input),'https://backend.test');requests.push(url);
    if(url.pathname==='/api/search'&&url.searchParams.has('providers'))return {ok:false,status:503,headers:{get:()=>null},text:async()=>'{"error":"Unavailable"}'};
    const body=url.pathname==='/api/search'?{items:url.searchParams.get('provider')==='stardima'?[sourceShow]:[]}:/services|universes/.test(url.pathname)?{}:catalog;
    return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(body)};
  }});
  for(const name of ['universes.js','tvmaze.js','api.js'])vm.runInContext(fs.readFileSync(new URL(`../../client-terrarium/js/${name}`,import.meta.url),'utf8'),context);
  const api=new context.window.Api.FlixerApi();await api.catalog();await api._indexReady;api.liveEnabled=true;
  const found=await api.search('A Cartoon');
  assert.ok(requests.some(url=>url.searchParams.get('provider')==='stardima'));
  assert.equal(found.items.length,1);
  assert.ok(found.items[0].providers.some(row=>row.id==='stardima'&&row.name==='StarDima'));
  assert.deepEqual(Array.from(context.window.Api.providersOf(sourceShow),row=>row.name),['StarDima']);
  api.liveEnabled=false;
});
