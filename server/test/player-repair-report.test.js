import test from 'node:test';
import assert from 'node:assert/strict';
import {playbackEvidence,summarizePlayerRepair} from '../../scripts/report-player-repair.js';

const confirmed={playbackConfirmed:true,proof:{start:1,end:4,duration:900,transport:'media3'}};
test('legacy clock transport follows its single actual player invocation without changing private evidence',()=>{
  const row={...confirmed,nativeResults:[{surface:'openPlayer',result:{played:true}}]};
  assert.deepEqual(playbackEvidence(row),{start:1,end:4,duration:900,transport:'webview',attribution:'single-recorded-player-invocation',transportLabelCorrected:true});
  assert.equal(row.proof.transport,'media3');
  assert.equal(playbackEvidence({...row,nativeResults:[{surface:'openMedia'}]}).transport,'media3');
  assert.equal(playbackEvidence({...row,nativeResults:[{surface:'openMedia'},{surface:'openPlayer'}]}),null);
});

test('new invocation-tagged clocks remain attributed and nonadvancing signals are rejected',()=>{
  const row={...confirmed,proof:{...confirmed.proof,transport:'webview',invocation:'invocation-2'},nativeResults:[{surface:'openMedia'},{surface:'openPlayer'}]};
  assert.equal(playbackEvidence(row).attribution,'invocation-tagged-clock');
  assert.equal(playbackEvidence({...row,proof:{...row.proof,end:1.2}}),null);
  assert.equal(playbackEvidence({...row,proof:{...row.proof,duration:Infinity}}),null);
  assert.equal(playbackEvidence({...row,proof:{...row.proof,start:-1}}),null);
});

test('public repair reports exclude private URLs and headers while retaining retries and pending coverage',()=>{
  const secret='https://source.test/player?token=PRIVATE',row={...confirmed,case:1,nativeResults:[{surface:'openPlayer',url:secret,headers:{Authorization:'PRIVATE'}}],network:[{status:403,type:'Media',url:secret}],observations:[{text:secret}],streamUrl:secret};
  const matrix={complete:true,cases:[{case:1,provider:'test',serverProvider:'test',title:'Title',name:secret,host:'source.test',server:{url:secret}},{case:2,provider:'test',title:'Pending',host:secret}]};
  const report=summarizePlayerRepair([{name:'test',matrix,device:{cases:[row],previousAttempts:[{case:1,category:'no_advancing_video'}]}}]);
  assert.equal(report.tested,1);assert.equal(report.total,2);assert.equal(report.confirmed,1);assert.equal(report.complete,false);
  assert.equal(report.reports[0].routes[0].previousAttempts.length,1);
  assert.equal(report.reports[0].routes[0].proof.transport,'webview');
  assert.deepEqual(report.reports[0].routes[0].httpStatuses,[403]);
  const json=JSON.stringify(report);for(const value of ['PRIVATE','https://','Authorization','streamUrl'])assert.equal(json.includes(value),false);
});

test('native document failures retain bounded diagnostics without exporting upstream details',()=>{
  const matrix={complete:true,cases:[{case:1,provider:'test',title:'Failed player',host:'source.test'}]};
  const device={cases:[{case:1,nativeResults:[{result:{reason:'failed',sourceError:'HTTP_ERROR',httpStatus:403,networkErrorCode:0,url:'https://source.test/?token=PRIVATE',description:'PRIVATE'}}]}]};
  const report=summarizePlayerRepair([{name:'test',matrix,device}]);
  const route=report.reports[0].routes[0];
  assert.equal(route.status,'access_denied');
  assert.deepEqual(route.sourceDiagnostics,[{sourceError:'HTTP_ERROR',httpStatus:403,networkErrorCode:0}]);
  assert.equal(JSON.stringify(report).includes('PRIVATE'),false);
});
