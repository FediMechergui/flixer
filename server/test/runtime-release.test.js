import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteRuntimeAsset} from '../src/runtime-release.js';
const failure=status=>Object.assign(Error('gh failed'),{stdout:`HTTP/2.0 ${status}\r\nContent-Type: application/json\r\n\r\n`,stderr:'unexpected end of JSON input'});
const settings={repo:'owner/repo',id:123,sleep:async()=>{}};
test('runtime cleanup accepts empty 204 deletion responses',async()=>{
  await deleteRuntimeAsset({...settings,mutate:async()=>({stdout:'HTTP/2.0 204 No Content\r\n\r\n'})});
});
test('an empty upstream error body retries by HTTP status before succeeding',async()=>{
  let calls=0;const waits=[];
  await deleteRuntimeAsset({...settings,sleep:async ms=>waits.push(ms),mutate:async()=>{if(++calls<3)throw failure(503);return {stdout:'HTTP/2.0 204\r\n'};}});
  assert.equal(calls,3);assert.deepEqual(waits,[1000,4000]);
});
test('a completed deletion with a lost response can resolve as absent on retry',async()=>{
  let calls=0;
  await deleteRuntimeAsset({...settings,mutate:async()=>{if(++calls===1)throw Error('ETIMEDOUT');throw failure(404);}});
  assert.equal(calls,2);
});
test('access and rate-limit denials are not retried or hidden by an empty body',async()=>{
  for(const status of [401,403,429]){let calls=0;await assert.rejects(deleteRuntimeAsset({...settings,mutate:async()=>{calls++;throw failure(status);}}),new RegExp(`HTTP ${status}`));assert.equal(calls,1);}
});
test('persistent cleanup failure remains a failure after bounded retries',async()=>{
  let calls=0;await assert.rejects(deleteRuntimeAsset({...settings,mutate:async()=>{calls++;throw failure(502);}}),/keeping the published catalogue/);assert.equal(calls,3);
});
test('the actual execFile timeout shape retries before verifying absence',async()=>{
  let calls=0;
  await deleteRuntimeAsset({...settings,mutate:async()=>{if(++calls===1)throw Object.assign(Error('Command failed: gh api'),{killed:true,signal:'SIGTERM',code:null,stdout:Buffer.alloc(0),stderr:Buffer.alloc(0)});throw failure(404);}});
  assert.equal(calls,2);
});
test('a command without a confirmed deletion status cannot promote the new catalogue',async()=>{
  await assert.rejects(deleteRuntimeAsset({...settings,mutate:async()=>({stdout:''})}),/cleanup failed/);
});
