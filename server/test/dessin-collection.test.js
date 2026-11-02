import test from 'node:test';import assert from 'node:assert/strict';
import {collectDessinMetadata,validateDessinMetadata,mergeDessinMetadata,dessinWatchEpisode} from '../src/dessin-collection.js';
import {parseDessinPage,dessinUrl} from '../src/dessinanime.js';import {importDessinMetadata} from '../../scripts/import-dessinanime-metadata.js';
import {mergeShow} from '../src/merge-library.js';
const id='sp:dessinanime:s:456-les-simpson',catalogue={id,title:'Les Simpson',kind:'series',sourceRecordId:14799,year:1989,sourceUrl:dessinUrl(id),episodes:[],offerings:[{provider:'dessinanime',id}]},eid=n=>`sp:dessinanime:e:456-les-simpson:1:${n}`;
const html=value=>`<script>self.__next_f.push(${JSON.stringify([1,'1:'+JSON.stringify(value)+'\n'])})</script>`;
const guide={slug:'456-les-simpson',seasons:[{mediaTmdbId:456,mediaId:14799,seasonNumber:1,episodes:[1,3,7].map(n=>({id:n,episodeNumber:n,title:'Episode '+n,runtime:24}))}]};
const episode=n=>html({context:{media:{id:14799,tmdbId:456,slug:'456-les-simpson',title:'Les Simpson',mediaType:'TV'},season:{seasonNumber:1},episode:{episodeNumber:n}},playbackKey:'1-'+n,players:[{id:n*100,url:'https://abysscdn.com/?v=public'+n,direct:true,language:'VF'}],guide});

test('server-rendered series headers bind a guide to the real source catalogue record',()=>{
 const row=parseDessinPage(id,html(guide),catalogue);assert.equal(row.tmdbId,456);assert.equal(row.sourceGuide.length,3);assert.equal(row.episodes.length,0);
 assert.throws(()=>parseDessinPage(id,html(guide),{...catalogue,sourceRecordId:99}),/identity/);
 assert.throws(()=>parseDessinPage(id,html({...guide,seasons:[{...guide.seasons[0],mediaTmdbId:999}]}),catalogue),/identity/);
});
test('collection uses actual sparse guide entries, retains every mapped player and honors its page budget',async()=>{
 const calls=[],saved=[];const report=await collectDessinMetadata({titles:[catalogue],pageBudget:3,readPage:async url=>{calls.push(url);return {status:200,url,html:url===dessinUrl(id)?html(guide):episode(Number(url.split('/').at(-1)))}},onRecord:r=>saved.push(r.pages)});
 assert.equal(report.pages,3);assert.deepEqual(report.items[0].episodes.map(e=>e.number),[1,3]);assert.ok(!calls.some(u=>u.endsWith('/1/2')));assert.equal(saved.at(-1),3);assert.equal(report.verificationRequired,false);validateDessinMetadata(report.items[0]);
});
test('browser verification preserves completed records and does not turn the challenge into a player',async()=>{
 const report=await collectDessinMetadata({titles:[catalogue],pageBudget:10,readPage:async url=>({status:url.endsWith('/1/3')?403:200,url,html:url===dessinUrl(id)?html(guide):episode(1)})});
 assert.equal(report.verificationRequired,true);assert.equal(report.pages,3);assert.deepEqual(report.items[0].episodes.map(e=>e.number),[1]);assert.equal(report.errors.length,1);
});
test('actual watch links are followed only for the same title and source origin',async()=>{
 assert.equal(dessinWatchEpisode(id,'<a href="https://evil.example/tv/456-les-simpson/1/7">Ad</a><a href="/tv/other/1/4">Other</a><a href="/tv/456-les-simpson/1/3">Watch</a>'),eid(3));
 const report=await collectDessinMetadata({titles:[catalogue],pageBudget:2,readPage:async url=>({status:200,url,html:url===dessinUrl(id)?'<a href="/tv/456-les-simpson/1/3">Watch</a>':episode(3)})});assert.equal(report.items[0].episodes[0].number,3);
 const redirected=await collectDessinMetadata({titles:[catalogue],readPage:async()=>({status:200,url:'https://evil.example/tv/456-les-simpson',html:html(guide)})});assert.equal(redirected.items.length,0);assert.match(redirected.errors[0].error,/identity changed/);
});
test('import validates all records before mutation and preserves unrelated providers and newer player IDs',()=>{
 const older=parseDessinPage(eid(1),episode(1),catalogue);older.detailsFetchedAt='2026-10-01T00:00:00Z';
 const newer=structuredClone(older);newer.detailsFetchedAt='2026-11-02T00:00:00Z';newer.episodes[0].cachedPlayers[0].id=900;
 const cache={items:[{id:'unrelated',title:'Unrelated'},newer]};const result=importDessinMetadata({format:1,items:[older]},{cache,persist:false});assert.equal(result.items,1);assert.equal(cache.items.length,2);assert.equal(cache.items.find(r=>r.id===id).episodes[0].cachedPlayers[0].id,900);
 const bad=structuredClone(older);bad.episodes[0].cachedPlayers[0].url='https://127.0.0.1/private';const before=JSON.stringify(cache);assert.throws(()=>importDessinMetadata({format:1,items:[older,bad]},{cache,persist:false}),/players/);assert.equal(JSON.stringify(cache),before);
 const foreign=structuredClone(older);foreign.sourceGuide[0].id='sp:dessinanime:e:999-other:1:1';assert.throws(()=>validateDessinMetadata(foreign),/source guide/);
 const merged=mergeDessinMetadata(newer,older);assert.equal(merged.detailsFetchedAt,newer.detailsFetchedAt);assert.equal(mergeDessinMetadata(merged,older).episodes[0].cachedPlayers[0].id,900);
});

test('alternate-provider episodes never become DessinAnime player discoveries',async()=>{
 const mixed={...catalogue,episodes:[{id:'fm:e:456:1:3',season:1,number:3,offerings:[{provider:'fmovies',id:'fm:e:456:1:3'}]}]};
 const report=await collectDessinMetadata({titles:[mixed],pageBudget:2,readPage:async url=>({status:200,url,html:url===dessinUrl(id)?html(guide):episode(1)})});assert.equal(report.items[0].episodes.length,1);assert.equal(report.items[0].episodes[0].id,eid(1));assert.ok(report.items[0].episodes[0].offerings.every(o=>o.provider==='dessinanime'));
});
test('latest checks refresh old source players and accept an authoritative empty list without losing the guide',async()=>{
 const old=parseDessinPage(eid(7),episode(7),catalogue);old.detailsFetchedAt='2026-10-01T00:00:00Z';
 const noPlayers=html({context:{media:{id:14799,tmdbId:456,slug:'456-les-simpson',title:'Les Simpson',mediaType:'TV'},season:{seasonNumber:1},episode:{episodeNumber:7}},playbackKey:'1-7',players:[],guide});
 const report=await collectDessinMetadata({titles:[old],latestFirst:true,pageBudget:2,readPage:async url=>({status:200,url,html:url===dessinUrl(id)?html(guide):noPlayers})});
 assert.equal(report.items[0].episodes.length,0);assert.equal(report.items[0].sourceGuide.length,3);assert.equal(report.items[0].dessinPlayerChecks[eid(7)].hasPlayers,false);
 const imported=mergeDessinMetadata(old,report.items[0]);assert.equal(imported.episodes.length,0);
 assert.equal(mergeDessinMetadata(imported,old).episodes.length,0);
});

test('resuming after another parent-page refresh keeps all previously discovered episodes',async()=>{
 const readPage=async url=>({status:200,url,html:url===dessinUrl(id)?html(guide):episode(Number(url.split('/').at(-1)))});
 const first=await collectDessinMetadata({titles:[catalogue],pageBudget:2,readPage});assert.equal(first.items[0].episodes[0].number,1);
 const second=await collectDessinMetadata({titles:first.items,pageBudget:2,readPage});assert.deepEqual(second.items[0].episodes.map(e=>e.number),[1,3]);assert.equal(second.items[0].access,'public');
 const third=await collectDessinMetadata({titles:second.items,pageBudget:2,readPage});assert.deepEqual(third.items[0].episodes.map(e=>e.number),[1,3,7]);
});

test('a lost browser stops collection immediately and retains the last successful checkpoint',async()=>{
 let requests=0;const report=await collectDessinMetadata({titles:[catalogue],pageBudget:500,readPage:async url=>{if(++requests>2)throw Error('Browser disconnected');return {status:200,url,html:url===dessinUrl(id)?html(guide):episode(1)};}});
 assert.equal(report.unavailable,true);assert.equal(requests,3);assert.equal(report.items[0].episodes.length,1);assert.equal(report.errors.length,1);
});

test('routine catalogue-only listings cannot downgrade and erase verified DessinAnime episodes',()=>{
 const mapped=parseDessinPage(eid(1),episode(1),catalogue),listing={...catalogue,access:'catalogue-only'};
 const first=mergeShow(mapped,listing),second=mergeShow(first,listing);
 assert.equal(first.access,'public');assert.equal(second.access,'public');assert.equal(second.episodes[0].cachedPlayers[0].id,100);
});

test('a success timestamp without its cached players never suppresses rediscovery',async()=>{
 const row={...catalogue,dessinPlayerChecks:{[eid(1)]:{at:new Date().toISOString(),hasPlayers:true}}};
 const report=await collectDessinMetadata({titles:[row],pageBudget:2,readPage:async url=>({status:200,url,html:url===dessinUrl(id)?html(guide):episode(1)})});
 assert.equal(report.items[0].episodes[0].id,eid(1));
});

test('an empty browser report does not rewrite or mutate the provider cache',()=>{
 const cache={items:[catalogue],lastRefreshAt:'2026-10-01T00:00:00Z'};const before=JSON.stringify(cache);
 assert.deepEqual(importDessinMetadata({format:1,items:[]},{cache,persist:false}),{items:0,unchanged:true});
 assert.equal(JSON.stringify(cache),before);
});
