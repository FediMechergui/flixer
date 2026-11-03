import test from 'node:test';
import assert from 'node:assert/strict';
import {hyperwatchingId,parseHyperwatchingPage,parseHyperwatchingServer,resolveHyperwatchingServers} from '../src/hyperwatching.js';

const watch='https://v2.hyperwatching.com/watch/ydvjuqtT2Mil';
const free={id:1497961,name:'Uqload',type:'iframe',status:'completed',is_vip:false};
const page=(servers=[free],props={})=>'<div data-page="'+JSON.stringify({component:'Video/Embed',props:{is_vip:false,video:{hashid:'ydvjuqtT2Mil',servers},...props}}).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></div>';

test('Hyperwatching accepts only public published watch identities and completed free choices',()=>{
  assert.equal(hyperwatchingId(watch),'ydvjuqtT2Mil');
  for(const u of [watch+'?vip=1',watch+'#other',watch.replace('https:','http:'),watch.replace('v2.','user@v2.'),watch.replace('.com','.com.evil.org')])assert.equal(hyperwatchingId(u),null);
  assert.deepEqual(parseHyperwatchingPage(page([free,free,{...free,id:2,is_vip:true},{...free,id:3,is_vip:undefined},{...free,id:4,status:'processing'}]),'ydvjuqtT2Mil'),[{id:1497961,name:'Uqload'}]);
  assert.throws(()=>parseHyperwatchingPage(page([],{is_vip:true}),'ydvjuqtT2Mil'),/not publicly/);
  assert.throws(()=>parseHyperwatchingPage(page(),'otherId'),/identity/);
  assert.throws(()=>parseHyperwatchingPage('<h1>Verify your browser</h1>','ydvjuqtT2Mil'),/format/);
});

test('source replies authorize only observed iframe routes and no credential forwarding',()=>{
  for(const url of ['https://uqload.vc/embed-4x8ocux5qd97.html','https://hgcloud.to/e/e30xv9mj0sot','https://mixdrop.top/e/l7794nqzcqgxjqg','https://lulustream.com/e/ca89bh8wwo66','https://savefiles.com/e/4rn4sgkkvy4r']){
    const result=parseHyperwatchingServer({player:'iframe',watch_url:url,headers:{Cookie:'PRIVATE',Authorization:'PRIVATE'}},free,watch);
    assert.equal(result.embedUrl,url);assert.deepEqual(result.headers,{Referer:watch});assert.equal(result.provider,'stardima');
  }
  for(const url of ['https://127.0.0.1/e/abc','https://evil.org/e/abc','https://savefiles.com/account','https://savefiles.com/e/abc?redirect=bad','https://user@savefiles.com/e/abc','https://savefiles.com:8443/e/abc','http://savefiles.com/e/abc'])assert.equal(parseHyperwatchingServer({player:'iframe',watch_url:url},free,watch),null);
  assert.equal(parseHyperwatchingServer({player:'vip',watch_url:'https://savefiles.com/e/abc'},free,watch),null);
});

test('resolver calls only published non-VIP IDs, tolerates partial failure and preserves source order',async()=>{
  const seen=[];
  const servers=await resolveHyperwatchingServers(watch,{request:async path=>{
    seen.push(path);
    if(path===watch)return page([free,{...free,id:2,name:'HG'},{...free,id:3},{...free,id:4,is_vip:true}]);
    if(path.endsWith('/2/url'))throw Error('timeout');
    return JSON.stringify({player:'iframe',watch_url:'https://uqload.vc/embed-4x8ocux5qd97.html'});
  }});
  assert.equal(servers.length,1);assert.equal(servers[0].id,'stardima:hyperwatching:1497961');assert.equal(seen.length,4);assert.equal(seen.some(p=>p.endsWith('/4/url')),false);
});

test('paid or malformed inventories stop before any server request and deadlines are bounded',async()=>{
  let calls=0;
  await assert.rejects(resolveHyperwatchingServers(watch,{request:async()=>{calls++;return page([],{is_vip:true});}}),/not publicly/);assert.equal(calls,1);
  await assert.rejects(resolveHyperwatchingServers(watch,{request:async()=>new Promise(()=>{}),budgetMs:15}),/timed out/);
});
