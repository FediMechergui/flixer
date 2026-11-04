import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {rankRecentTitles} from '../../shared/recent-updates.js';
import {contentFreshness} from '../../shared/freshness.js';
import {compactRecentEpisode,hasNewEpisodeContent,newEpisodeContent} from '../../shared/episode-updates.js';
import {mergeShow} from '../src/merge-library.js';
import {leanCatalog,writeCatalog} from '../src/export-catalog.js';
import {buildRuntimePublication} from '../src/runtime-publication.js';
import {mergeProviderObservation} from '../src/provider-sync.js';
import {refreshSeriesEpisodes} from '../src/episode-refresh.js';
import {libraryHome,discoverLibrary} from '../src/library-service.js';

const episode=(id,season,number,extra={})=>({id,title:`Episode ${number}`,season,number,...extra});
const series=(id,episodes=[],extra={})=>({id,title:id,kind:'series',episodes,...extra});

test('recent ordering uses content chronology and rotates providers only within identical update batches',()=>{
  const at='2026-11-03T12:00:00Z',now=Date.parse('2026-11-04T12:00:00Z');
  const rows=[
    series('fm:s:old',[],{contentUpdatedAt:'2020-01-01',providerUpdatedAt:'2026-11-04'}),
    series('fm:s:a',[],{contentUpdatedAt:at}),series('fm:s:b',[],{contentUpdatedAt:at}),series('fm:s:c',[],{contentUpdatedAt:at}),
    series('sp:stardima:s:one',[],{contentUpdatedAt:at}),series('sp:carateen:s:sp-1',[],{contentUpdatedAt:at}),
    series('fm:s:newest',[],{contentUpdatedAt:'2026-11-03T12:00:01Z'}),
  ];
  const ranked=rankRecentTitles([...rows,rows[1]],{now});
  assert.equal(ranked[0].id,'fm:s:newest');assert.equal(ranked.at(-1).id,'fm:s:old');assert.equal(ranked.length,rows.length);
  assert.deepEqual(new Set(ranked.slice(1,4).map(row=>row.id.split(':')[0]==='sp'?row.id.split(':')[1]:'fmovies')),new Set(['carateen','fmovies','stardima']));
  assert.deepEqual(rankRecentTitles([...rows].reverse(),{now}).map(row=>row.id),ranked.map(row=>row.id),'provider response order does not shuffle ties');
  assert.equal(contentFreshness({kind:'series',contentUpdatedAt:'2026-11-01',latestAt:'2026-11-03'},now).at,'2026-11-03T00:00:00.000Z');
});

test('new content evidence ignores first guide imports, aliases, old seasons and introduction backfills',()=>{
  const latest=episode('fm:e:7:2:10',2,10,{publishedAt:'2026-11-02'});
  const old=series('fm:s:7',[latest],{latestEpisode:latest.id});
  const backfill=series(old.id,[episode('fm:e:7:1:1',1,1),episode('fm:e:7:2:1',2,1),latest],{latestEpisode:'fm:e:7:1:1'});
  assert.equal(hasNewEpisodeContent(old,backfill),false);
  assert.equal(hasNewEpisodeContent(series(old.id),backfill),false,'initial discovery is not a new episode release');
  assert.equal(hasNewEpisodeContent(old,series(old.id,[episode('hd:s:other:2:10',2,10)])),false,'an additional server for the same episode is not a release');
  const unknown=series('sp:carateen:s:tg-1',[episode('sp:carateen:e:tg-1:24',null,24)],{latestEpisode:'sp:carateen:e:tg-1:24'});
  assert.equal(hasNewEpisodeContent(unknown,series(unknown.id,[episode('sp:carateen:e:tg-1:intro',null,null,{title:'Opening'})])),false);
  assert.equal(hasNewEpisodeContent(unknown,series(unknown.id,[episode('sp:carateen:e:tg-1:4',null,4)])),false);
  assert.deepEqual(newEpisodeContent(old,series(old.id,[episode('fm:e:7:2:11',2,11),episode('fm:e:7:1:2',1,2)])).map(row=>row.id),['fm:e:7:2:11']);
  assert.equal(hasNewEpisodeContent({...old,episodes:[],latestEpisode:'2:10'},{...old,episodes:[],latestEpisode:'2:11'}),true);
});

test('merging delayed providers preserves the latest episode and resolves its canonical ID and contributors',()=>{
  const old=series('mf:s:show',[episode('mf:e:10',2,10)],{latestEpisode:'mf:e:10',contentUpdatedAt:'2026-11-03'});
  const delayed=series('fm:s:7',[episode('fm:e:7:2:3',2,3)],{latestEpisode:'fm:e:7:2:3',contentUpdatedAt:'2026-11-02'});
  assert.equal(mergeShow(old,delayed).latestEpisode,'mf:e:10');
  const same=mergeShow(old,series('fm:s:7',[episode('fm:e:7:2:10',2,10,{offerings:[{provider:'fmovies',id:'fm:e:7:2:10'}]})],{latestEpisode:'fm:e:7:2:10'}));
  assert.equal(same.latestEpisode,'mf:e:10');assert.deepEqual(compactRecentEpisode(same).providers,['fmovies','myflixer']);
  const next=mergeShow(same,series('fm:s:7',[episode('fm:e:7:3:1',3,1)],{latestEpisode:'fm:e:7:3:1'}));
  assert.equal(next.latestEpisode,'fm:e:7:3:1');assert.equal(compactRecentEpisode(next).season,3);
  assert.equal(compactRecentEpisode({...next,latestEpisode:'missing'}),null,'do not invent a recent episode from a large guide');
});

test('unknown season episode numbers advance only within the same source and never regress on guide backfill',()=>{
  const old=series('sp:carateen:s:sp-10',[episode('sp:carateen:e:sp-10:20',null,20)],{latestEpisode:'sp:carateen:e:sp-10:20',contentUpdatedAt:'2026-11-01'});
  const next=series(old.id,[episode('sp:carateen:e:sp-10:21',null,21)],{latestEpisode:'sp:carateen:e:sp-10:21'});
  const merged=mergeProviderObservation(old,next,'2026-11-02T12:00:00Z');assert.equal(merged.latestEpisode,next.latestEpisode);
  const delayed=series(old.id,[episode('sp:carateen:e:sp-10:4',null,4)],{latestEpisode:'sp:carateen:e:sp-10:4'});
  const again=mergeProviderObservation(merged,delayed,'2026-11-03T12:00:00Z');assert.equal(again.latestEpisode,next.latestEpisode);assert.equal(again.contentUpdatedAt,merged.contentUpdatedAt);
  const unrelated=series('sp:animegg:s:same-name',[episode('sp:animegg:e:same-name-99',null,99)],{latestEpisode:'sp:animegg:e:same-name-99'});
  assert.equal(mergeShow(merged,unrelated).latestEpisode,next.latestEpisode,'unknown season numbering from another source cannot outrank an established episode');
});

test('refreshes add historical guides without reviving releases, then record a new season once and retain it through failure',async()=>{
  const at='2026-11-03T12:00:00Z',old=series('fm:s:9',[episode('fm:e:9:2:10',2,10)],{latestEpisode:'fm:e:9:2:10',contentUpdatedAt:'2026-11-01'});
  const backfill={...old,episodes:[episode('fm:e:9:1:1',1,1)],latestEpisode:'fm:e:9:1:1'};
  const first=mergeProviderObservation(old,backfill,at);assert.equal(first.contentUpdatedAt,old.contentUpdatedAt);assert.equal(first.latestEpisode,old.latestEpisode);
  const refreshed=await refreshSeriesEpisodes([old],{now:Date.parse(at),resolveDetails:async()=>backfill});
  assert.equal(refreshed.report.addedEpisodes,1);assert.equal(refreshed.report.changedShows,0);assert.equal(refreshed.items[0].contentUpdatedAt,old.contentUpdatedAt);
  const next={...old,episodes:[episode('fm:e:9:3:1',3,1)],latestEpisode:'fm:e:9:3:1'};
  const updated=mergeProviderObservation(first,next,at);assert.equal(updated.contentUpdatedAt,at);assert.equal(updated.latestEpisode,next.latestEpisode);
  assert.equal(mergeProviderObservation(first,{...next,latestEpisode:undefined},at).latestEpisode,next.latestEpisode,'a new actual episode becomes the summary even when the source omits a pointer');
  assert.equal(mergeProviderObservation(updated,next,'2026-11-04T12:00:00Z').contentUpdatedAt,at);
  const failed=await refreshSeriesEpisodes([updated],{now:Date.parse('2026-11-04T12:00:00Z'),resolveDetails:async()=>{throw Error('HTTP 403');}});
  assert.equal(failed.items[0].latestEpisode,next.latestEpisode);assert.equal(failed.items[0].contentUpdatedAt,at);assert.equal(failed.items[0].episodes.length,3);
});

test('an explicit source recent feed advances a known title on its first observed episode without turning full-guide imports into updates',()=>{
  const title=series('sp:carateen:s:sp-10',[],{firstSeenAt:'2026-11-01T12:00:00Z'});
  const latest=episode('sp:carateen:e:sp-10:24',null,24),feed={...title,episodes:[latest],latestEpisode:latest.id,episodeUpdateFeed:true};
  const first=mergeProviderObservation(title,feed,'2026-11-03T12:00:00Z');assert.equal(first.contentUpdatedAt,'2026-11-03T12:00:00Z');assert.equal(first.episodeUpdateFeed,undefined);
  assert.equal(mergeProviderObservation(title,{...feed,episodeUpdateFeed:undefined},'2026-11-03T12:00:00Z').contentUpdatedAt,null);
  assert.equal(mergeProviderObservation(undefined,feed,'2026-11-03T12:00:00Z').contentUpdatedAt,undefined,'brand new catalogue entries remain additions');
  assert.equal(mergeProviderObservation(first,feed,'2026-11-04T12:00:00Z').contentUpdatedAt,first.contentUpdatedAt);
  const older=episode('sp:carateen:e:sp-10:20',null,20);
  const repeated=mergeProviderObservation(first,{...feed,episodes:[older],latestEpisode:older.id},'2026-11-04T12:00:00Z');
  assert.equal(repeated.contentUpdatedAt,first.contentUpdatedAt);assert.equal(repeated.latestEpisode,latest.id);
});

test('live cached home and latest discovery agree on actual updates instead of provider check times',async()=>{
  const old=series('fm:s:old',[],{latestAt:'2020-01-01',providerUpdatedAt:'2026-11-03'}),fresh=series('sp:stardima:s:fresh',[],{contentUpdatedAt:'2026-11-03'});
  const catalog={product:'flixer',generatedAt:'2026-11-03T12:00:00Z',shows:[old,fresh],tags:[],channels:[]};
  assert.equal(libraryHome(catalog).trendingSeries[0].id,fresh.id);
  assert.equal((await discoverLibrary({kind:'series',latest:true,cachedOnly:true,catalog})).items[0].id,fresh.id);
});

test('metadata-only discoveries do not fill recent pages or inflate totals, but ordinary catalogue paging retains them',async()=>{
  const additions=Array.from({length:100},(_,i)=>series(`sp:carateen:s:sp-${i+100}`,[],{firstSeenAt:'2026-11-04T14:00:00Z'}));
  const ep=episode('sp:carateen:e:sp-1:24',null,24),feed=series('sp:carateen:s:sp-1',[ep],{latestEpisode:ep.id,firstSeenAt:'2026-11-03T12:00:00Z'}),dated=series('fm:s:updated',[],{contentUpdatedAt:'2026-11-03T13:00:00Z'});
  const catalog={product:'flixer',shows:[...additions,feed,dated],tags:[],channels:[]};
  const recent=await discoverLibrary({kind:'series',latest:true,cachedOnly:true,catalog});
  assert.deepEqual(recent.items.map(row=>row.id),[dated.id,feed.id]);assert.equal(recent.total,2);assert.equal(recent.totalPages,1);
  const tail=await discoverLibrary({kind:'series',latest:true,cachedOnly:true,catalog,page:2});assert.equal(tail.items.length,0);assert.equal(tail.totalPages,1);
  const ordinary=await discoverLibrary({kind:'series',cachedOnly:true,catalog});assert.equal(ordinary.total,102);assert.equal(ordinary.totalPages,5);assert.equal(ordinary.items.length,24);
  assert.deepEqual(libraryHome(catalog).trendingSeries.map(row=>row.id),[dated.id,feed.id]);
  assert.equal(rankRecentTitles(additions).length,100,'initial catalogues still fall back to additions when they have no content evidence');
});

test('static and published bootstraps expose the same chronological source mix with compact episode evidence',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flixer-recent-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const shows=[series('fm:s:older',[episode('fm:e:7:1:2',1,2)],{latestEpisode:'fm:e:7:1:2',latestAt:'2020-01-01',providerUpdatedAt:'2026-11-03'}),series('sp:carateen:s:sp-10',[episode('sp:carateen:e:sp-10:22',null,22)],{latestEpisode:'sp:carateen:e:sp-10:22',contentUpdatedAt:'2026-11-03',sourceSearchText:'A Latin Title'})];
  const catalog={product:'flixer',generatedAt:'2026-11-03T12:00:00Z',shows,tags:[],channels:[]};
  const staticDir=path.join(dir,'static');writeCatalog(staticDir,catalog,'flixer');
  const runtimeDir=path.join(dir,'runtime'),manifest=await buildRuntimePublication(catalog,runtimeDir);
  const runtime=JSON.parse(gunzipSync(fs.readFileSync(path.join(runtimeDir,manifest.files.bootstrap.name))));
  const local=JSON.parse(fs.readFileSync(path.join(staticDir,'bootstrap.json'),'utf8'));
  assert.deepEqual(runtime.shows.map(row=>row.id),local.shows.map(row=>row.id));assert.equal(runtime.shows[0].id,shows[1].id);
  assert.deepEqual(runtime.shows[0].recentEpisode,{id:'sp:carateen:e:sp-10:22',title:'Episode 22',season:null,number:22,providers:['carateen']});
  assert.equal(runtime.shows[0].sourceSearchText,'A Latin Title');assert.equal(runtime.shows[0].episodes,undefined);
  assert.deepEqual(leanCatalog({shows:runtime.shows},'flixer').shows[0].recentEpisode,runtime.shows[0].recentEpisode);
});
