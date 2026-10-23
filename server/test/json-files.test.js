import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {readJsonFile,readJsonItems,writeJsonFile} from '../src/json-files.js';
test('streamed JSON preserves UTF-8, escapes and nested episodes across byte boundaries and rejects truncation',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-json-'));try{
  const file=path.join(dir,'data.json');for(const value of [{items:[{title:'\u0628\u0627\u0628 \u0627\u0644\u062d\u0627\u0631\u0629 \ud83c\udfac',quote:'"\\\n',episodes:[{number:1}]}],retry:{next:123},omitted:undefined},[],[null,3.2e30,false],null,42,'title']){
   writeJsonFile(file,value);const expected=JSON.parse(JSON.stringify(value));assert.deepEqual(readJsonFile(file,{threshold:0,chunkSize:1}),expected);assert.deepEqual(readJsonFile(file),expected);
  }
  for(const invalid of ['{"items":[1,','{"items":[]}false','{"items":[]','']){fs.writeFileSync(file,invalid);assert.throws(()=>readJsonFile(file,{threshold:0,chunkSize:2}));}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('provider extraction streams only selected rows and rejects truncated source caches',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-items-'));try{const file=path.join(dir,'providers.json'),selected={id:'sp:dessinanime:s:sample',title:'Épisode عربي',episodes:[{cachedPlayers:[{id:12}]}]};writeJsonFile(file,{items:[...Array.from({length:1000},(_,n)=>({id:'other:'+n,unused:'x'.repeat(2000)})),selected],cursor:{next:7}});assert.deepEqual(readJsonItems(file,row=>row.id.startsWith('sp:')), [selected]);fs.writeFileSync(file,'{"items":[{"id":"sp:one"},');assert.throws(()=>readJsonItems(file));}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
