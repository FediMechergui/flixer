import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {validateBuildOutput} from '../../scripts/build-output.js';
const root=path.resolve('.');
test('build outputs cannot erase source directories or escape the repository',()=>{
  for(const target of ['.','..','../escape','server','client','client-terrarium','.git','mobile/android','artifacts/../../server'])assert.throws(()=>validateBuildOutput(root,target),/Unsafe build output/);
  for(const target of ['client/dist-flixer','client-terrarium/dist','mobile/www','artifacts/review/build','out/preview','dist'])assert.equal(validateBuildOutput(root,target),path.resolve(root,target));
});
