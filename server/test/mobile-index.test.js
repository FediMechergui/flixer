import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {writeMobileIndex} from '../../scripts/bundle-mobile-index.js';

test('the mobile bundle keeps all title identities, aliases and filter metadata in bounded local parts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-mobile-index-'));try{
  const source=path.join(dir,'source.json'),out=path.join(dir,'data'),shows=Array.from({length:40},(_,i)=>({id:'fm:m:'+i,kind:'film',title:'Title '+i,aliasIds:['sp:tuniflix:m:'+i],countries:['TN'],tags:['comedy'],poster:{custom:'https://example.test/'+i+'.jpg'},documentary:false,tmdbId:i,lang:null,audioModes:[]}));
  fs.writeFileSync(source,JSON.stringify({product:'flixer',generatedAt:'2026-10-23',shows}));const result=writeMobileIndex(source,out,{maxBytes:1500}),manifest=JSON.parse(fs.readFileSync(path.join(out,'index.json')));
  assert.equal(result.count,shows.length);assert.ok(result.parts>1);assert.equal(manifest.shows,undefined);
  const rows=manifest.indexParts.flatMap(name=>{const file=path.join(out,name);assert.ok(fs.statSync(file).size<1700);const part=JSON.parse(fs.readFileSync(file));assert.equal(part.generatedAt,manifest.generatedAt);return part.shows});
  assert.deepEqual(rows,shows.map(({lang,audioModes,...row})=>row));
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
