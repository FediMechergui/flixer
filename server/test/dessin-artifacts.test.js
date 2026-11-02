import test from 'node:test';
import assert from 'node:assert/strict';
import {trustedDessinRun,validateDessinArtifact} from '../../scripts/dessin-artifacts.js';
import {parseDessinCatalogue} from '../src/dessinanime.js';

const run={id:123,status:'completed',conclusion:'success',head_branch:'main',head_repository:{full_name:'FediMechergui/flixer'},event:'schedule'};
test('browser artifact handoff accepts only completed trusted main runs',()=>{
 assert.equal(trustedDessinRun(run),true);
 assert.equal(trustedDessinRun({...run,conclusion:'timed_out'}),true);
 for(const change of [{event:'pull_request'},{head_branch:'feature'},{head_repository:{full_name:'other/flixer'}},{status:'in_progress'},{conclusion:'cancelled'},{id:'123'}])assert.equal(trustedDessinRun({...run,...change}),false);
});
test('lightweight catalogue seeds can contain unmapped source titles but never foreign identities',()=>{
 const row=parseDessinCatalogue([{id:14799,slug:'456-les-simpson',title:'Les Simpson',mediaType:'TV'}])[0],report={format:1,items:[row]};
 assert.equal(validateDessinArtifact(report,'seed'),report);
 for(const change of [{id:'fm:s:456'},{sourceUrl:'https://example.com/tv/456-les-simpson'},{kind:'film'},{title:null}])assert.throws(()=>validateDessinArtifact({format:1,items:[{...row,...change}]},'seed'));
 assert.throws(()=>validateDessinArtifact({format:1,items:[row,row]},'seed'));
 assert.throws(()=>validateDessinArtifact(report,'metadata'),/verification time/);
 assert.throws(()=>validateDessinArtifact({format:1,items:[{...row,detailsFetchedAt:new Date().toISOString(),sourceGuide:[],episodes:{}}]},'metadata'),/episode arrays/);
});
test('an empty challenged worker report is valid metadata and cannot fabricate players',()=>{
 const report={format:1,items:[],verificationRequired:true,pages:0};assert.equal(validateDessinArtifact(report,'metadata'),report);
 assert.throws(()=>validateDessinArtifact({format:1,items:'bad'},'metadata'));
 assert.throws(()=>validateDessinArtifact(report,'unknown'));
});
