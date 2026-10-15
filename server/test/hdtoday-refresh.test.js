import test from 'node:test';
import assert from 'node:assert/strict';
import { createHdtodayRequest } from '../src/hdtoday.js';
import { validateHdtodayFeed } from '../src/hdtoday-feed.js';

test('HDToday challenge stops redundant requests and retries after cooldown',async()=>{
  let calls=0,time=1000000;
  const request=createHdtodayRequest({now:()=>time,fetchRemote:async()=>{calls++;return new Response('challenge',{status:403,headers:{'cf-mitigated':'challenge'}});}});
  await assert.rejects(request('/movie'),/browser verification/);
  await assert.rejects(request('/tv'),/browser verification/);
  assert.equal(calls,1);time+=600001;
  await assert.rejects(request('/tv'),/browser verification/);assert.equal(calls,2);
});
test('HDToday detects HTML verification pages even with HTTP 200',async()=>{
  const request=createHdtodayRequest({fetchRemote:async()=>new Response('<title>Just a moment...</title>')});
  await assert.rejects(request('/movie'),/browser verification/);
});
test('HDToday rate limiting keeps its cooldown separate from ordinary responses',async()=>{
  let time=0,calls=0;
  const request=createHdtodayRequest({now:()=>time,fetchRemote:async()=>++calls===1?new Response('',{status:429,headers:{'retry-after':'120'}}):new Response('catalogue')});
  await assert.rejects(request('/movie'),/429/);time=119999;
  await assert.rejects(request('/movie'),/rate limited/);assert.equal(calls,1);
  time=120001;assert.equal(await request('/movie'),'catalogue');
  await assert.rejects(request('https://evil.test'),/Invalid HDToday URL/);
});
const feed=()=>({version:1,provider:'hdtoday',updatedAt:new Date().toISOString(),items:[{id:'hd:s:tv-test-abc',kind:'series',title:'Test',sourceUrl:'https://hdtoday.sx/watch/tv-test-abc',offerings:[{provider:'hdtoday',id:'hd:s:tv-test-abc'}],episodes:[{id:'hd:s:tv-test-abc:2:4',season:2,number:4,offerings:[{provider:'hdtoday',id:'hd:s:tv-test-abc:2:4'}]}]}]});
test('HDToday feed rejects stale data, foreign routes and fabricated episode identities',()=>{
  const valid=feed();assert.equal(validateHdtodayFeed(valid),valid);
  const stale=feed();stale.updatedAt='2020-01-01';assert.equal(validateHdtodayFeed(stale),null);
  const bad=feed();bad.items[0].sourceUrl='https://evil.test/watch/tv-test-abc';assert.equal(validateHdtodayFeed(bad),null);
  const episode=feed();episode.items[0].episodes[0].number=5;assert.equal(validateHdtodayFeed(episode),null);
  const offer=feed();offer.items[0].offerings[0].provider='fmovies';assert.equal(validateHdtodayFeed(offer),null);
  assert.equal(validateHdtodayFeed({...feed(),items:[]}),null);
});
