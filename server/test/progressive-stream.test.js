import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {unifiedStream} from '../src/library-service.js';
const id='mf:m:test',other='sp:tuniflix:m:test';
const episode={id,season:1,number:1,offerings:[{id,provider:'myflixer'},{id:other,provider:'tuniflix'}]};
const title={id,title:'Test film',kind:'film',episodes:[episode]};
test('one provider can resolve without touching a slow unrelated provider or adding unauthorized sources',async()=>{
  let slowCalls=0;
  const options={showId:id,catalog:{product:'flixer',shows:[title]},product:'flixer',resolveTitle:async()=>title,
    resolveMyflixer:async()=>{slowCalls++;throw Error('Slow source should not run');},
    resolveSpecialist:async()=>[{id:'ready',provider:'tuniflix',type:'embed',embedUrl:'https://uqload.vc/embed-ready.html'}]};
  const ready=await unifiedStream(id,{...options,provider:'tuniflix'});assert.equal(ready.servers.length,1);assert.equal(slowCalls,0);
  assert.equal((await unifiedStream(id,{...options,provider:'not-in-this-title'})).servers.length,0);
});
test('the client returns the first ready hosted provider and delivers later alternatives without restarting',async()=>{
  let release;const slow=new Promise(resolve=>release=resolve),updates=[],calls=[];
  const context=vm.createContext({window:{FLIXER_CONFIG:{apiBase:'https://backend.test'},FlixerTvMaze:{TvMaze:class{}}},localStorage:{getItem:()=>null},URL,URLSearchParams,Headers,AbortController,DOMException,setTimeout,clearTimeout,console,
    fetch:async url=>{const query=new URL(url).searchParams;calls.push(query.get('provider'));if(query.get('provider')==='myflixer')await slow;return Response.json({servers:[{id:query.get('provider'),provider:query.get('provider'),type:'embed',embedUrl:'https://source.test/'+query.get('provider')}]});}});
  vm.runInContext(fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),context);
  const api=new context.window.Api.FlixerApi();
  const controller=new AbortController();
  try{
    const result=await Promise.race([api.stream(id,null,title,{signal:controller.signal,onSources:servers=>updates.push(servers.length)}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Waited for slow provider')),500))]);
    assert.equal(result.servers[0].provider,'tuniflix');assert.deepEqual(calls.sort(),['myflixer','tuniflix']);
    release();await new Promise(resolve=>setImmediate(resolve));assert.ok(updates.includes(2));
  }finally{release();controller.abort();}
});
