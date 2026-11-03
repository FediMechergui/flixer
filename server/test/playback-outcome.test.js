import test from 'node:test';import assert from 'node:assert/strict';
import {classifyPlayback,blockingPlayerMessage,nativePlaybackDiagnostics,sourceRefusesDebugger} from '../../scripts/playback-outcome.js';
test('the observed YouTube country restriction is explicit rather than an unexplained timeout',()=>{const result={observations:[{text:'Video unavailable\nThe uploader has not made this video available in your country'}]};assert.equal(classifyPlayback(result),'region_restricted');assert.match(blockingPlayerMessage(result),/country/)});
test('source verification, embedding restrictions and soft 404s retain distinct outcomes',()=>{for(const [text,status] of [["Antispam\nI'm not a robot",'verification_required'],['Playback on other websites has been disabled','embedding_restricted'],['Series\n404 — Page Not Found','missing_video'],["We Couldn't Find This Content Or Episode Is Not Available.",'missing_video']])assert.equal(classifyPlayback({observations:[{text}]}),status)});
test('an advertising-script failure or loaded frame cannot certify content failure or playback',()=>{assert.equal(classifyPlayback({network:[{type:'Script',status:403}]}),'no_advancing_video');assert.equal(classifyPlayback({network:[{type:'Document',status:200}]}),'no_advancing_video');assert.equal(classifyPlayback({infrastructureError:'System dialog'}),'infrastructure_error')});
test('OK author blocks and embedding-disabled pages retain the observed restriction',()=>{for(const [text,status] of [['The author of this video has not been found or is blocked','restricted'],['Embeds disabled2','embedding_restricted']]){const result={observations:[{text}]};assert.equal(classifyPlayback(result),status);assert.equal(blockingPlayerMessage(result),text);}});
test('observed VK removals, unavailable media, publisher blocks and embedding gates are explicit',()=>{for(const [text,status] of [['Видеофайл не найден.','missing_video'],['Error loading player: No playable sources found','source_unavailable'],["Video has been blocked due to author's rights infingement",'restricted'],['Remove sandboxing to enable playback.','embedding_restricted']])assert.equal(classifyPlayback({observations:[{text}]}),status)});
test('native main-frame HTTP errors survive the destroyed player document',()=>{
 for(const [httpStatus,status] of [[401,'access_denied'],[403,'access_denied'],[451,'access_denied'],[404,'missing_video'],[410,'missing_video'],[503,'source_unavailable']]){
  const result={nativeResults:[{result:{reason:'failed',sourceError:'HTTP_ERROR',httpStatus}}],observations:[{url:'about:blank',text:''}]};
  assert.equal(classifyPlayback(result),status);assert.equal(blockingPlayerMessage(result),`Player document HTTP ${httpStatus}`);
 }
});
test('native verification and network failures are distinct from missing files',()=>{
 const challenge={nativeResults:[{result:{reason:'failed',sourceError:'BROWSER_VERIFICATION',httpStatus:403}}]};
 assert.equal(classifyPlayback(challenge),'verification_required');assert.equal(blockingPlayerMessage(challenge),'Browser verification required (HTTP 403)');
 const network={nativeResults:[{result:{reason:'failed',sourceError:'NETWORK_ERROR',networkErrorCode:-2}}]};
 assert.equal(classifyPlayback(network),'network_error');assert.equal(blockingPlayerMessage(network),'Player network error -2');
 assert.equal(classifyPlayback({...network,observations:[{text:'File not found'}]}),'network_error');
 assert.equal(classifyPlayback({...network,playbackConfirmed:true}),'playback_confirmed');
 assert.equal(classifyPlayback({nativeResults:[{result:{reason:'failed',sourceError:'SOURCE_UNAVAILABLE'}}]}),'source_unavailable');
});
test('native diagnostic summaries only expose bounded fields from the expected enum',()=>{
 const result={nativeResults:[{result:{reason:'failed',sourceError:'NETWORK_ERROR',networkErrorCode:'https://secret.example/token',url:'https://secret.example/token',body:'private'}}]};
 assert.equal(blockingPlayerMessage(result),'Player network error');
 assert.equal(blockingPlayerMessage({nativeResults:[{result:{sourceError:'https://secret.example/token',httpStatus:403}}]}),'');
 assert.equal(classifyPlayback({nativeResults:[{result:{reason:'failed',sourceError:'STARTUP_TIMEOUT'}}]}),'player_error');
 assert.deepEqual(nativePlaybackDiagnostics(result),[{sourceError:'NETWORK_ERROR',httpStatus:0,networkErrorCode:0}]);
});
test('an explicit source DevTools refusal is audit interference, not an access or media failure',()=>{
 const message="You don't have permission to use DEVTOOL!【type = 6】";
 assert.equal(sourceRefusesDebugger(message),true);assert.equal(sourceRefusesDebugger('The DevTools network connection timed out'),false);
 for(const evidence of [{console:[{type:'warning',text:message}]},{observations:[{text:message}]},{auditDiagnostics:['SOURCE_DEVTOOLS_RESTRICTED']}]){
  const result={...evidence,nativeResults:[{result:{reason:'failed',sourceError:'HTTP_ERROR',httpStatus:403}}]};
  assert.equal(classifyPlayback(result),'debugger_restricted');assert.match(blockingPlayerMessage(result),/retest without an attached player debugger/);
  assert.equal(classifyPlayback({...result,playbackConfirmed:true}),'playback_confirmed');
 }
});
