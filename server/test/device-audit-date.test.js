import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeDeviceAuditReport} from '../../scripts/report-provider-device-audit.js';

test('published audit dates follow the actual observation day in Lagos',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-audit-date-'));
 const files=['provider-playback-audit-2026-10-27.json','provider-playback-audit-2026-10-27.md'];
 try{
  writeDeviceAuditReport({providers:[],samples:[],cases:[],complete:true},{startedAt:'2026-10-26T23:30:00.000Z',finishedAt:'2026-10-26T23:31:00.000Z',cases:[],scope:'Selected public routes only.'},directory);
  assert.deepEqual(fs.readdirSync(directory).sort(),files.sort());
  const markdown=fs.readFileSync(path.join(directory,files.find(file=>file.endsWith('.md'))),'utf8');
  assert.match(markdown,/27 October 2026/);assert.match(markdown,/Selected public routes only/);
 }finally{
  for(const file of files)if(fs.existsSync(path.join(directory,file)))fs.unlinkSync(path.join(directory,file));
  fs.rmdirSync(directory);
 }
});
