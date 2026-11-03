import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveHdtodayServers} from '../src/hdtoday.js';
import {unifiedStream} from '../src/library-service.js';

test('HDToday refresh replaces cached redirects and does not resurrect removed routes',async()=>{
  const id='hd:s:tv-refresh-fixture-abc12345:1:2';
  let calls=0,target='https://vidfast.pro/tv/77/1/2';
  const fetchPlayer=async()=>{calls++;return target?`<meta http-equiv="refresh" content="0;url=${target}">`:'<title>No player</title>';};
  const first=await resolveHdtodayServers(id,{fetchPlayer});
  assert.ok(first.length);assert.ok(first.every(s=>s.embedUrl===target));
  const before=calls;
  target='https://vidlink.pro/tv/77/1/2';
  assert.deepEqual(await resolveHdtodayServers(id,{fetchPlayer}),first);
  assert.equal(calls,before);
  const renewed=await resolveHdtodayServers(id,{fresh:true,fetchPlayer});
  assert.ok(renewed.length);assert.ok(renewed.every(s=>s.embedUrl===target));
  assert.ok(calls>before);
  target=null;
  assert.deepEqual(await resolveHdtodayServers(id,{fresh:true,fetchPlayer}),[]);
  const after=calls;
  assert.deepEqual(await resolveHdtodayServers(id,{fetchPlayer}),[]);
  assert.ok(calls>after,'an empty refresh must invalidate the old cached redirect');
});

test('unified playback forwards explicit refresh and retains source errors alongside alternatives',async()=>{
  const id='mf:m:refresh-fixture',hd='hd:m:movie-refresh-fixture-abc12345';
  const title={id,title:'Refresh fixture',kind:'film',tmdbId:77,episodes:[{id,season:1,number:1,offerings:[{provider:'myflixer',id},{provider:'hdtoday',id:hd}]}]};
  const calls=[];
  const result=await unifiedStream(id,{showId:id,catalog:{product:'flixer',shows:[title]},product:'flixer',fresh:true,resolveTitle:async()=>title,
    resolveMyflixer:async()=>({servers:[],error:'HTTP 503'}),
    resolveHdtoday:async(requested,options)=>{calls.push({requested,options});return [{id:'source',provider:'hdtoday',type:'embed',embedUrl:'https://vidfast.pro/movie/77?autoPlay=true'}];}});
  assert.deepEqual(calls,[{requested:hd,options:{fresh:true,tmdbId:77}}]);
  assert.ok(result.servers.some(s=>s.provider==='hdtoday'));
  assert.ok(result.providerErrors.some(e=>e.provider==='myflixer'&&e.error==='HTTP 503'));
});
