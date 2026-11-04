import test from 'node:test';
import assert from 'node:assert/strict';
import {specialistJobs} from '../src/specialist-providers.js';
import {extendSpecialistScopes} from '../src/provider-sync.js';
import {STARDIMA_IMPORT_JOBS,stardimaPartitionKey} from '../src/stardima-import.js';

const seeds=()=>[...specialistJobs(),...STARDIMA_IMPORT_JOBS.filter(job=>job.collection).map(job=>({...job,page:1}))];

test('Carateen adds only its own history to a version 10 cache and preserves ongoing provider cursors',()=>{
  const other={provider:'fmovies',kind:'film',page:39,cursor:'keep-film-cursor'};
  const star={provider:'stardima',kind:'series',collection:'anime',page:8,cursor:'keep-star-cursor'};
  const current={provider:'carateen',kind:'series',collection:'',page:3,cursor:'keep-source-cursor'};
  const cache={specialistScopesVersion:10,completed:true,queue:[other,star,current],stardimaCoverage:{version:1,partitions:{'series:anime':{complete:false,nextPage:7}}}};
  extendSpecialistScopes(cache,seeds(),'flixer');
  assert.equal(cache.specialistScopesVersion,11);
  assert.equal(cache.completed,false);
  assert.equal(cache.queue.length,4);
  assert.equal(cache.queue[0],other);assert.equal(cache.queue[1],star);assert.equal(cache.queue[2],current);
  assert.equal(cache.queue[3].provider,'carateen');assert.equal(cache.queue[3].kind,'film');assert.equal(cache.queue[3].page,1);
  const before=[...cache.queue];extendSpecialistScopes(cache,seeds(),'flixer');assert.deepEqual(cache.queue,before);
  cache.specialistScopesVersion=12;extendSpecialistScopes(cache,seeds(),'flixer');assert.equal(cache.specialistScopesVersion,12);assert.deepEqual(cache.queue,before);
});

test('older caches gain Carateen without reopening completed StarDima partitions or changing Dahsha',()=>{
  const other={provider:'hdtoday',kind:'film',page:40};
  const partitions=Object.fromEntries(STARDIMA_IMPORT_JOBS.map(job=>[stardimaPartitionKey(job),{complete:true,nextPage:5}]));
  partitions['series:anime']={complete:false,nextPage:7};
  const cache={specialistScopesVersion:9,completed:true,queue:[other],stardimaCoverage:{version:1,partitions}};
  extendSpecialistScopes(cache,seeds(),'flixer');
  assert.equal(cache.queue[0],other);
  assert.deepEqual(cache.queue.filter(job=>job.provider==='stardima'),[{provider:'stardima',kind:'series',collection:'anime',page:7}]);
  assert.deepEqual(cache.queue.filter(job=>job.provider==='carateen').map(job=>[job.kind,job.page]),[['film',1],['series',1]]);
  assert.equal(cache.queue.length,4);
  const dahsha={specialistScopesVersion:10,completed:true,queue:[other]};
  extendSpecialistScopes(dahsha,seeds(),'dahsha');
  assert.deepEqual(dahsha,{specialistScopesVersion:10,completed:true,queue:[other]});
});

test('Carateen complete snapshot coverage avoids a redundant historical traversal without changing another cursor',()=>{
  const other={provider:'myflixer',kind:'series',page:25},cache={specialistScopesVersion:10,completed:true,queue:[other],carateenCoverage:{version:1,complete:true}};
  extendSpecialistScopes(cache,seeds(),'flixer');
  assert.deepEqual(cache.queue,[other]);
  cache.queue.push({provider:'carateen',kind:'series',page:7});
  extendSpecialistScopes(cache,seeds(),'flixer');
  assert.deepEqual(cache.queue,[other],'a completed metadata backfill is not restarted by the historical queue');
});
