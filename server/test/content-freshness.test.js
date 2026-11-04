import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {contentFreshness} from '../../shared/freshness.js';import {leanCatalog} from '../src/export-catalog.js';
import {spawnSync} from 'node:child_process';
test('source metadata checks do not become new releases and browser ordering matches exported ordering',()=>{
 const code=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=code.indexOf('  function contentFreshness('),end=code.indexOf('  function normalize(',start),context=vm.createContext({});vm.runInContext(code.slice(start,end)+';globalThis.rank=contentFreshness;',context);
 const now=Date.parse('2026-10-28T12:00:00Z'),cases=[{kind:'series',latestAt:'2020-01-01',providerUpdatedAt:'2026-10-28',episodesCheckedAt:'2026-10-28',firstSeenAt:'2026-10-28'},{kind:'series',contentUpdatedAt:'2026-10-28',publishedAt:'2020-01-01'},{kind:'film',publishedAt:'2099-01-01',firstSeenAt:'2026-10-27'},{kind:'series',firstSeenAt:'2026-10-27'},{kind:'film',publishedAt:'invalid'}];
 for(const row of cases)assert.deepEqual(JSON.parse(JSON.stringify(context.rank(row,now))),contentFreshness(row,now));
 assert.equal(contentFreshness(cases[0],now).at,'2020-01-01T00:00:00.000Z');assert.equal(contentFreshness(cases[1],now).kind,'episodes');assert.equal(contentFreshness(cases[2],now).kind,'added');assert.equal(contentFreshness(cases[4],now).at,'');
 const contentUpdatedAt='2026-10-28T01:00:00.000Z';assert.equal(leanCatalog({shows:[{id:'test',kind:'series',episodes:[],contentUpdatedAt}]},'flixer').shows[0].contentUpdatedAt,contentUpdatedAt);
});

test('source ISO update dates keep UTC chronology in different host and phone timezones',()=>{
 const cases=[
  {kind:'series',latestAt:'2026-11-03T16:38:51'},
  {kind:'series',contentUpdatedAt:'2026-11-03T16:38:51.123'},
  {kind:'film',publishedAt:'2026-11-03T16:38'},
  {kind:'film',publishedAt:'2026-11-03'},
  {kind:'series',latestAt:'2026-11-03T16:38:51+01:00'},
  {kind:'series',latestAt:'2026-11-03T16:38:51-05:00'},
  {kind:'series',latestAt:'2026-11-03T16:38:51Z'},
  {kind:'series',latestAt:'invalid',firstSeenAt:'2026-11-02T12:00:00'},
  {kind:'series',latestAt:'2099-11-03T16:38:51',firstSeenAt:'2026-11-02T12:00:00'},
  {kind:'series',latestAt:'2026-99-03T16:38:51',publishedAt:'invalid'},
 ];
 const expected=['2026-11-03T16:38:51.000Z','2026-11-03T16:38:51.123Z','2026-11-03T16:38:00.000Z','2026-11-03T00:00:00.000Z','2026-11-03T15:38:51.000Z','2026-11-03T21:38:51.000Z','2026-11-03T16:38:51.000Z','2026-11-02T12:00:00.000Z','2026-11-02T12:00:00.000Z',''];
 const browser=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=browser.indexOf('  function contentFreshness('),end=browser.indexOf('  function recentEpisodeOf(',start);
 const script=`import vm from 'node:vm';import {contentFreshness} from ${JSON.stringify(new URL('../../shared/freshness.js',import.meta.url).href)};const context=vm.createContext({});vm.runInContext(${JSON.stringify(browser.slice(start,end)+';globalThis.rank=contentFreshness;')},context);const rows=${JSON.stringify(cases)},now=Date.parse('2026-11-04T12:00:00Z');console.log(JSON.stringify({shared:rows.map(row=>contentFreshness(row,now)),browser:rows.map(row=>context.rank(row,now))}));`;
 let baseline;
 for(const timezone of ['UTC','Africa/Lagos','America/New_York','Asia/Tokyo']){
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',env:{...process.env,TZ:timezone},windowsHide:true});assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);assert.deepEqual(output.shared.map(row=>row.at),expected,timezone);assert.deepEqual(output.browser,output.shared,timezone+' browser parity');
  if(baseline)assert.deepEqual(output,baseline,timezone+' feed ordering');else baseline=output;
 }
});
