import test from 'node:test';
import assert from 'node:assert/strict';
import {androidVersion} from '../../scripts/android-version.js';

test('release version codes continue the installed 1.6.x signing lineage',()=>{
  for(const tag of ['flixer-v1.6.36','v1.6.36','1.6.36'])assert.deepEqual(androidVersion(tag),{name:'1.6.36',code:10636});
  assert.ok(androidVersion('v1.7.0').code>androidVersion('v1.6.99').code);
  assert.ok(androidVersion('v2.0.0').code>androidVersion('v1.99.99').code);
});
test('release tags cannot generate colliding, invalid or shell-controlled versions',()=>{
  for(const tag of ['','main','v1.6','v1.100.0','v1.6.100','v9999999999.1.1','v1.6.36; echo bad','v1.6.36\nX=1'])assert.throws(()=>androidVersion(tag));
});
