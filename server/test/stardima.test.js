import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseStardimaId,stardimaUrl,stardimaIdFromUrl,stardimaPlayerUrl,parseStardimaList,parseStardimaGuide,parseStardimaSeason,parseStardimaEpisode,parseStardimaFilmPlayer,parseStardimaLatest,fetchStardimaPage,getStardimaDetails,resolveStardimaServers} from '../src/stardima.js';

const fixture=name=>fs.readFileSync(new URL('./fixtures/stardima/'+name,import.meta.url),'utf8');
const json=name=>JSON.parse(fixture(name));
const series='sp:stardima:s:6ae791af3be9a',episode='sp:stardima:e:6ae791af3be9a:104745',film='sp:stardima:m:6ae7843be51cb';

test('StarDima current and legacy identities retain exact source title and episode IDs',()=>{
  for(const id of [series,episode,film,'sp:stardima:s:video-58','sp:stardima:e:video-58:901'])assert.equal(stardimaIdFromUrl(stardimaUrl(id)),id);
  assert.equal(stardimaIdFromUrl('https://www.stardima.com/play/6ae7843be51cb'),film);
  assert.equal(parseStardimaId(episode).episodeId,104745);
  for(const value of ['sp:stardima:s:6ae791af3be9a:1','sp:stardima:e:6ae791af3be9a','sp:stardima:e:video-58:0','sp:stardima:s:../../x'])assert.equal(parseStardimaId(value),null);
  for(const value of ['https://www.stardima.com.evil.org/tvshow/video-58','https://u@www.stardima.com/tvshow/video-58','http://www.stardima.com/tvshow/video-58','https://www.stardima.com:8443/tvshow/video-58','https://www.stardima.com/tvshow/video-58?redirect=elsewhere','https://www.stardima.com/tvshow/video-58#fragment','https://www.stardima.com/movie/video-58/play/1'])assert.equal(stardimaIdFromUrl(value),null);
});

test('free catalogue parsing preserves Arabic audio without inventing origin or animation genre',()=>{
  const result=parseStardimaList(json('series-list.json'),{freeFiltered:true,page:1,kind:'series'});
  assert.equal(result.totalPages,153);assert.equal(result.items.length,2);assert.equal(result.items[0].id,series);assert.deepEqual(result.items[0].audioLanguages,['ar']);
  assert.equal(result.items[0].originalLanguage,undefined);assert.deepEqual(result.items[0].tags,[]);assert.equal(result.items[0].sourceRecordId,4018);
  const sub=parseStardimaList(json('film-list.json'),{freeFiltered:true,page:1,kind:'film'}).items[1];assert.deepEqual(sub.subtitleLanguages,['ar']);assert.equal(sub.audioLanguages,undefined);
  assert.throws(()=>parseStardimaList(json('series-list.json')),/free-content filter/);
});

test('catalogue rejects changed pagination and preserves retry status for malformed rows',()=>{
  const data=json('series-list.json');assert.throws(()=>parseStardimaList(data,{freeFiltered:true,page:2}),/pagination/);
  data.videos.push({...data.videos[0],url:'https://elsewhere.org/tvshow/video-1'});
  const result=parseStardimaList(data,{freeFiltered:true,page:1});assert.equal(result.partial,true);assert.equal(result.items.length,2);
  data.videos[0].is_exclusive=1;assert.equal(parseStardimaList(data,{freeFiltered:true,page:1}).items.length,1);
  const changed=json('series-list.json');changed.videos[0].is_series=1;assert.equal(parseStardimaList(changed,{freeFiltered:true,page:1}).partial,true);
});

test('only published Hyperwatching watch routes are admitted',()=>{
  assert.equal(stardimaPlayerUrl('https://v2.hyperwatching.com/watch/S2RAD69y6rUV'),'https://v2.hyperwatching.com/watch/S2RAD69y6rUV');
  for(const u of ['https://v2.hyperwatching.com/download/S2RAD69y6rUV','https://v2.hyperwatching.com/watch/S2RAD69y6rUV?key=x','https://user@v2.hyperwatching.com/watch/S2RAD69y6rUV','https://v2.hyperwatching.com.evil.org/watch/S2RAD69y6rUV','javascript:alert(1)'])assert.equal(stardimaPlayerUrl(u),null);
});

test('episode playback requires affirmative public access and the matching parent identity',()=>{
  const data=json('episode.json'),result=parseStardimaEpisode(episode,data);assert.equal(result.episode.season,4);assert.equal(result.episode.number,1);
  for(const changes of [{can_watch:false},{can_watch:undefined},{is_exclusive:1},{reason:'login_required'},{reason:'subscription_required'},{watch_url:'https://evil.org/embed/1'}])assert.throws(()=>parseStardimaEpisode(episode,{...data,episode:{...data.episode,...changes}}));
  assert.throws(()=>parseStardimaEpisode(episode,{...data,series:{...data.series,slug:'video-58'}}),/identity/);
  assert.equal(parseStardimaEpisode(episode,{...data,season:{number:null}}).episode.season,undefined);
});

test('source season labels and sparse episode numbers survive without a guessed season',()=>{
  const guide=parseStardimaGuide(fixture('series-guide.html'),'6ae791af3be9a');assert.equal(guide.seasons[0].number,4);assert.equal(guide.seasons[0].id,4347);
  const data=json('season.json');data.episodes=data.episodes.filter((_,i)=>i!==1);data.episodes.push({...data.episodes[0],id:900,is_exclusive:true});
  assert.deepEqual(parseStardimaSeason(series,guide.seasons[0],data).map(e=>[e.season,e.number]),[[4,1],[4,3],[4,4]]);
  assert.equal(parseStardimaSeason(series,{id:4347,label:'Special edition'},data)[0].season,undefined);
  assert.throws(()=>parseStardimaSeason(series,guide.seasons[0],{...data,series_id:'video-58'}),/identity/);
});

test('film parser reads only the actual free player and ignores global VIP navigation',()=>{
  const html=fixture('film-play.html');assert.equal(parseStardimaFilmPlayer(film,'<header>STARDIMA VIP</header>'+html),'https://v2.hyperwatching.com/watch/ydvjuqtT2Mil');
  assert.throws(()=>parseStardimaFilmPlayer(film,html.replace('<iframe','<p>VIP</p><iframe')),/free public player/);
  assert.throws(()=>parseStardimaFilmPlayer(film,html.replace('6ae7843be51cb','6ae791af3be9a')),/identity/);
});

test('catalogue requests always carry the public free filter and documented collection filters',async()=>{
  const paths=[];const read=async(path,options)=>{paths.push([path,options]);return fixture('series-list.json');};
  const result=await fetchStardimaPage({collection:'anime-dub',read});const url=new URL(paths[0][0],'https://www.stardima.com');
  assert.equal(url.searchParams.get('premium'),'free');assert.equal(url.searchParams.get('category'),'anmy');assert.equal(url.searchParams.get('language'),'dub');assert.equal(paths[0][1].json,true);assert.ok(result.items[0].tags.includes('anime'));
  await fetchStardimaPage({search:'Ben & Jerry',read});assert.equal(new URL(paths[1][0],'https://www.stardima.com').searchParams.get('query'),'Ben & Jerry');
});

test('details collect the published guide without manufacturing episodes',async()=>{
  const read=async path=>path.includes('/series/season/')?fixture('season.json'):path.includes('/play/')?fixture('series-guide.html'):fixture('series-detail.html');
  const detail=await getStardimaDetails(series,{read,readSnapshot:()=>null});assert.equal(detail.episodes.length,4);assert.equal(detail.episodesComplete,true);assert.deepEqual(detail.seasons,[4]);assert.equal(detail.originalLanguage,undefined);
  assert.ok(detail.episodes.every(ep=>!ep.cachedPlayers&&!ep.watch_url));
});

test('fresh guide failures retain cached source episodes and expose incomplete status',async()=>{
  const saved={id:series,title:'Saved',episodes:[{id:episode,season:4,number:1}],episodesComplete:true};
  const actual=await getStardimaDetails(series,{fresh:true,read:async()=>{throw Error('HTTP 503');},readSnapshot:()=>saved});assert.deepEqual(actual.episodes,saved.episodes);assert.equal(actual.episodesComplete,false);assert.match(actual.providerErrors[0].error,/503/);
});

test('selected episode authorization is refreshed before the public player resolver is called',async()=>{
  let called=0;const reads=[];const servers=[{provider:'stardima',embedUrl:'https://example.test/player'}];
  const result=await resolveStardimaServers(episode,{read:async(path,options)=>{reads.push({path,options});return fixture('episode.json');},resolvePlayers:async url=>{called++;assert.equal(url,'https://v2.hyperwatching.com/watch/S2RAD69y6rUV');return servers;}});
  assert.equal(called,1);assert.equal(reads[0].options.fresh,true);assert.equal(result,servers);
  const locked=json('episode.json');locked.episode.can_watch=false;await assert.rejects(()=>resolveStardimaServers(episode,{read:async()=>JSON.stringify(locked),resolvePlayers:async()=>{called++;}}),/source access/);assert.equal(called,1);
});

test('latest feed uses real episode identities and rejects restricted episodes without fake dates',async()=>{
  const entries=parseStardimaLatest(fixture('latest.html'));assert.equal(entries.length,2);assert.ok(entries[0].item.portrait.startsWith('https://image.tmdb.org/'));const first=parseStardimaId(entries[0].episodeId);
  const data=json('episode.json');data.episode.id=first.episodeId;data.series.slug=first.slug;data.series.title=entries[0].item.title;
  const result=await fetchStardimaPage({latest:true,read:async path=>path==='/newrelases'?fixture('latest.html'):path.endsWith(String(first.episodeId))?JSON.stringify(data):JSON.stringify({...data,episode:{...data.episode,id:parseStardimaId(entries[1].episodeId).episodeId,can_watch:false},series:{...data.series,slug:parseStardimaId(entries[1].episodeId).slug}})});
  assert.equal(result.items.length,1);assert.equal(result.items[0].episodesComplete,false);assert.equal(result.items[0].latestEpisode,entries[0].episodeId);assert.equal(result.items[0].providerUpdatedAt,undefined);assert.equal(result.partial,undefined);
});

test('latest category queries retain source category evidence instead of relabelling the global timeline',async()=>{
  const paths=[];const result=await fetchStardimaPage({latest:true,kind:'series',collection:'cartoons',read:async path=>{paths.push(path);return fixture('series-list.json');}});
  assert.equal(paths.length,1);assert.ok(paths[0].startsWith('/mosalsalat?'));assert.equal(new URL(paths[0],'https://www.stardima.com').searchParams.get('category'),'krton');assert.ok(result.items.every(item=>item.tags.includes('animation')));
});

test('latest timeline keeps its newest published episode when an older update repeats the same show',()=>{
  const cards=fixture('latest.html').replace('<main id="timeline-container"><section data-content="episodes">','').replace('</section></main>','');
  const entries=parseStardimaLatest('<main id="timeline-container"><section data-content="episodes">'+cards+cards.replaceAll('104758','103000')+'</section></main>');
  assert.equal(entries.length,2);assert.equal(entries[0].episodeId,'sp:stardima:e:6accfbe7a236f:104758');
});

test('a stalled latest feed shares one deadline instead of waiting for every episode timeout',async()=>{
  let reads=0;
  const result=await fetchStardimaPage({latest:true,budgetMs:25,read:async path=>{reads++;return path==='/newrelases'?fixture('latest.html'):new Promise(()=>{});}});
  assert.equal(result.partial,true);assert.equal(result.items.length,0);assert.equal(reads,3);
  assert.ok(result.providerErrors.every(row=>/time budget/.test(row.error)));
});

test('details preserve the public Arabic and Latin title aliases',async()=>{
  const read=async path=>path.includes('/series/season/')?fixture('season.json'):path.includes('/play/')?fixture('series-guide.html'):'<title>كايجو رقم 8 | Kaiju No. 8 | الوحش الثامن - ستارديما</title>'+fixture('series-detail.html');
  const detail=await getStardimaDetails(series,{read,readSnapshot:()=>null});
  assert.ok(detail.altTitles.includes('Kaiju No. 8'));assert.ok(detail.altTitles.includes('الوحش الثامن'));assert.ok(!detail.altTitles.some(name=>name.includes('ستارديما')));
});
