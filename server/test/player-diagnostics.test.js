import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnosePlayerResponse as diagnose} from '../src/player-diagnostics.js';
test('ordinary player shells and Cloudflare analytics are not access failures',()=>{
  assert.equal(diagnose(200,{title:'Byse Frontend',text:'Byse Frontend Cloudflare',contentType:'text/html'}),'javascript-player-required');
  assert.equal(diagnose(206,{contentType:'video/mp4'}),'http-reachable-playback-unverified');
});
test('separates browser verification, denial, deleted media and advertising gates',()=>{
  assert.equal(diagnose(403,{challenge:true}),'browser-verification-required');
  assert.equal(diagnose(403,{title:'Just a moment...'}),'browser-verification-required');
  assert.equal(diagnose(403,{text:'Forbidden nginx'}),'upstream-access-block');
  assert.equal(diagnose(404,{text:'Not found Cloudflare'}),'missing-video');
  assert.equal(diagnose(200,{text:'Sorry This video not found!'}),'missing-video');
  assert.equal(diagnose(200,{text:'Please disable AdBlock to watch this video!'}),'source-adblock-gate');
  assert.equal(diagnose(504,{}),'upstream-server-error');
});
