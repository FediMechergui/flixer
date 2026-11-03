import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
const descriptor={provider:'dessinanime',type:'dessinanime',playerId:1106663,id:'dessinanime:1106663',name:'DessinAnime · VF · Panda'};
const relay='https://relay.dessinanime.cc/api/stream-relay/hydrax?h=example.sssrr.org&m=29319395&q=4&z=1&s=actual-source-signature';
function fixture(response){
  const requests=[];
  const window={Capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorHttp:{request:async request=>{requests.push(request);return response(request);}}}}};
  vm.runInNewContext(source,{window,URL,AbortController,setTimeout,clearTimeout,fetch:()=>{throw Error('DessinAnime API has no WebView CORS permission');}});
  return {requests,resolve:window.FlixerPlayer.resolveDessinPlayer};
}

test('APK DessinAnime discovery uses native source-bound JSON transport and preserves media request context',async()=>{
  const f=fixture(request=>({status:200,url:request.url,data:JSON.stringify({type:'mp4',url:relay,qualities:[{label:'1080p',url:relay.replace('q=4','q=5')}]})}));
  const choices=await f.resolve(descriptor),request=f.requests[0];
  assert.equal(request.url,'https://dessinanime.cc/api/stream?playerId=1106663');
  assert.equal(request.method,'GET');assert.equal(request.responseType,'json');assert.equal(request.disableRedirects,true);
  assert.equal(request.headers.Referer,'https://dessinanime.cc/');assert.equal(request.headers['User-Agent'],'Mozilla/5.0');
  assert.ok(request.connectTimeout+request.readTimeout<12000);
  assert.equal(choices.length,2);assert.equal(choices[1].streamUrl,relay.replace('q=4','q=5'));
  assert.equal(choices[0].headers.Referer,request.headers.Referer);assert.equal(choices[0].headers['User-Agent'],request.headers['User-Agent']);
});

test('APK source transport rejects denied or redirected responses and unsafe media while retaining real HLS choices',async()=>{
  for(const reply of [{status:403,data:{}},{status:302,url:'https://evil.example/',data:{}},{status:200,url:'https://evil.example/api/stream?playerId=1106663',data:{type:'mp4',url:relay}},{status:200,data:null},{status:200,data:{type:'mp4',url:'https://relay.dessinanime.cc.evil.org/api/stream-relay/a'}}]){
    const f=fixture(()=>reply);await assert.rejects(f.resolve(descriptor));
  }
  const f=fixture(()=>({status:200,data:{type:'hls',url:relay}}));
  assert.equal((await f.resolve(descriptor))[0].type,'hls');
  await assert.rejects(f.resolve({...descriptor,playerId:'1106663&private=1'}),/Invalid source player/);
  assert.equal(f.requests.length,1,'Invalid player IDs never reach the native HTTP bridge');
});

test('DessinAnime retains its exact source iframe after direct quality choices or when the public API fails',async()=>{
  const original={...descriptor,sourceEmbedUrl:'https://abysscdn.com/?v=actual-source-id'};
  const good=fixture(()=>({status:200,data:{type:'mp4',url:relay}}));
  const choices=await good.resolve(original);
  assert.equal(choices.length,2);assert.equal(choices[0].type,'mp4');assert.equal(choices[1].type,'embed');
  assert.equal(choices[1].embedUrl,original.sourceEmbedUrl);assert.equal(choices[1].headers.Referer,'https://dessinanime.cc/');
  assert.equal(choices[1].streamUrl,undefined);
  const denied=fixture(()=>({status:403,data:{}}));
  assert.equal((await denied.resolve(original))[0].embedUrl,original.sourceEmbedUrl);
  for(const sourceEmbedUrl of ['https://abysscdn.com.evil.org/?v=1','https://user@abysscdn.com/?v=1','http://abysscdn.com/?v=1','https://127.0.0.1/private'])await assert.rejects(denied.resolve({...descriptor,sourceEmbedUrl}),/Source HTTP 403/);
});

test('DessinAnime keeps the published MP4 fallback after HLS and validates every fallback quality',async()=>{
  const f=fixture(()=>({status:200,data:{type:'hls',url:relay,fallback:{type:'mp4',url:relay,qualities:[{label:'1080p',url:relay+'&q=5'},{label:'unsafe',url:'https://127.0.0.1/private'}]}}}));
  const choices=await f.resolve({...descriptor,sourceEmbedUrl:'https://morencius.com/?v=real-source'});
  assert.deepEqual(Array.from(choices,s=>s.type),['hls','mp4','mp4','embed']);
  assert.equal(choices[1].streamUrl,relay);assert.equal(choices[2].streamUrl,relay+'&q=5');
  assert.ok(choices[1].name.includes('MP4'));assert.equal(choices[3].embedUrl,'https://morencius.com/?v=real-source');
});
