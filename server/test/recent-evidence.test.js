import test from 'node:test';
import assert from 'node:assert/strict';
import {rankRecentTitles} from '../../shared/recent-updates.js';
import {recentFreshness,validatedRecentUpdate} from '../../shared/freshness.js';
import {observeRecentUpdate} from '../../shared/recent-observation.js';
import {compactRecentEpisode} from '../../shared/episode-updates.js';
import {mergeProviderObservation} from '../src/provider-sync.js';
import {refreshSeriesEpisodes} from '../src/episode-refresh.js';
import {leanCatalog} from '../src/export-catalog.js';
import {mergeShow} from '../src/merge-library.js';
import {parseCarateenRecent,parseCarateenCatalogue} from '../../shared/carateen-source.js';

const at='2026-11-04T08:00:00.000Z',later='2026-11-04T08:15:00.000Z',now=Date.parse(later);
const episode=n=>({id:`sp:wco:e:old-show:episode-${n}`,title:`Episode ${n}`,season:1,number:n});
const series=(episodes=[],extra={})=>({id:'sp:wco:s:old-show',kind:'series',title:'Old show',episodes,...extra});

test('legacy import and crawl dates cannot impersonate releases even when every available title has them',()=>{
  const imported=series([episode(20)],{firstSeenAt:at,contentUpdatedAt:at,latestAt:at,providerUpdatedAt:at,episodesCheckedAt:at,latestEpisode:episode(20).id,recentEpisode:episode(20)});
  assert.deepEqual(recentFreshness(imported,now),{at:'',kind:'unknown'});
  assert.deepEqual(rankRecentTitles([imported],{now}),[]);
  const historical={...imported,publishedAt:'1967-09-09'};
  assert.deepEqual(recentFreshness(historical,now),{at:'1967-09-09T00:00:00.000Z',kind:'release'});
  const actual={id:'mf:m:new-film',kind:'film',title:'New film',publishedAt:'2026-11-03'};
  assert.deepEqual(rankRecentTitles([historical,actual],{now}).map(row=>row.id),[actual.id,historical.id]);
});

test('a first full guide and later filling a partial guide do not establish release events',async()=>{
  const complete=series(Array.from({length:20},(_,i)=>episode(i+1)),{episodesComplete:true});
  for(const previous of [series([]),series([episode(1)],{episodesComplete:false}),series([episode(1)])]) {
    const merged=mergeProviderObservation(previous,complete,at);
    assert.equal(merged.recentUpdate,null);
    assert.equal(rankRecentTitles([merged],{now}).length,0);
    assert.equal(merged.episodes.length,20,'catalogue and playable guides remain complete');
    const result=await refreshSeriesEpisodes([previous],{now:Date.parse(at),resolveDetails:async()=>complete});
    assert.equal(result.report.changedShows,0);
    assert.equal(result.items[0].episodes.length,20);
  }
});

test('complete guide advances get stable observation evidence while dated old backfills retain their original date',()=>{
  const before=series([episode(1)],{episodesComplete:true});
  const full=series([episode(1),episode(2)],{episodesComplete:true});
  const merged=mergeProviderObservation(before,full,at);
  assert.deepEqual(merged.recentUpdate,{kind:'episodes',source:'guide-advance',at:'',observedAt:at,episodeId:episode(2).id});
  assert.equal(mergeProviderObservation(merged,full,later).recentUpdate.observedAt,at);
  const historical=series([{...episode(20),publishedAt:'2009-02-01'}],{episodesComplete:true});
  const discovered=mergeProviderObservation(series(),historical,at);
  assert.equal(discovered.recentUpdate.at,'2009-02-01T00:00:00.000Z');
  assert.equal(recentFreshness(discovered,now).at,'2009-02-01T00:00:00.000Z');
});

test('an actual episode feed qualifies new source titles once without assigning a fake publication date',()=>{
  const feed=series([episode(10)],{episodesComplete:false,latestEpisode:episode(10).id,episodeUpdateFeed:true,recentUpdate:{kind:'episodes',source:'feed',at:'',episodeId:episode(10).id}});
  const first=mergeProviderObservation(undefined,feed,at);
  assert.equal(first.recentUpdate.at,'');assert.equal(first.recentUpdate.observedAt,at);
  assert.equal(first.episodeUpdateFeed,undefined);
  assert.equal(rankRecentTitles([first],{now}).length,1);
  const repeated=mergeProviderObservation(first,feed,later);
  assert.deepEqual(repeated.recentUpdate,first.recentUpdate);
  const detail=mergeProviderObservation(first,series([episode(10),episode(11)],{episodesComplete:true,latestEpisode:episode(11).id}),later);
  assert.equal(detail.latestEpisode,episode(11).id);
  assert.equal(compactRecentEpisode(detail).id,episode(10).id,'card labels remain tied to the verified event');
  assert.deepEqual(detail.recentUpdate,first.recentUpdate);
  assert.deepEqual(leanCatalog({shows:[detail]},'flixer').shows[0].recentUpdate,first.recentUpdate);
});

test('ordinary catalogue pages cannot receive feed provenance from an old episode pointer',()=>{
  const catalogue=series([episode(50)],{latestEpisode:episode(50).id,firstSeenAt:at});
  assert.equal(observeRecentUpdate(undefined,catalogue,at),null);
  assert.equal(validatedRecentUpdate({...catalogue,recentUpdate:{kind:'episodes',source:'crawl',at,episodeId:episode(50).id}},now),null);
  assert.equal(validatedRecentUpdate({...catalogue,recentUpdate:{kind:'episodes',source:'feed',at:'2099-01-01',episodeId:episode(50).id}},now),null);
});

test('Carateen catalogue and exact recent endpoint remain distinct after parsing and publication',()=>{
  const records=[{id:5,name:'Old collection',is_movie:0,ep_count:300,updated_at:at},{id:6,name:'Current feed show',is_movie:0,ep_count:24,updated_at:at}];
  const titles=parseCarateenCatalogue(records,'sp').items;
  assert.deepEqual(rankRecentTitles(titles,{now}),[]);
  const feed=parseCarateenRecent([{id:99,slug:900,tv_series_id:6,number:24,pref:'Current source episode'}],titles).items;
  const observed=feed.map(row=>mergeProviderObservation(titles.find(title=>title.id===row.id),row,at));
  assert.equal(observed.length,1);
  assert.deepEqual(rankRecentTitles([...titles.filter(row=>row.id!==observed[0].id),...observed],{now}).map(row=>row.id),['sp:carateen:s:sp-6']);
});

test('provider episode aliases survive full-guide export, compact persistence and a second export',()=>{
  const canonical='fm:e:7:1:5',alias='sp:wco:e:the-show:episode-five';
  const first={id:'fm:s:7',kind:'series',title:'The show',episodes:[{id:canonical,title:'Episode five',season:1,number:5}],latestEpisode:canonical};
  const other={id:'sp:wco:s:the-show',kind:'series',title:'The show',episodes:[{id:alias,title:'Episode five',season:1,number:5,offerings:[{provider:'wco',id:alias}]}],latestEpisode:alias,recentUpdate:{kind:'episodes',source:'feed',at:'',observedAt:at,episodeId:alias}};
  const merged=mergeShow(first,other);
  assert.equal(merged.recentUpdate.episodeId,alias,'the full guide may retain the original source reference');
  assert.equal(compactRecentEpisode(merged).id,canonical);
  const exported=leanCatalog({shows:[merged]},'flixer').shows[0];
  assert.equal(exported.recentUpdate.episodeId,canonical);
  assert.equal(exported.latestEpisode,canonical,'export does not rewrite guide chronology');
  const {episodes,...compact}=exported;
  const restored=JSON.parse(JSON.stringify(compact));
  assert.equal(compactRecentEpisode(restored).id,canonical);
  assert.deepEqual(compactRecentEpisode(restored).providers,['fmovies','wco']);
  const reexported=leanCatalog({shows:[restored]},'flixer').shows[0];
  assert.deepEqual(reexported.recentEpisode,exported.recentEpisode);
  assert.deepEqual(reexported.recentUpdate,exported.recentUpdate);
  assert.equal(rankRecentTitles([restored],{now}).length,1);
});
