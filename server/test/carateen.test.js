import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCarateenId,carateenUrl,carateenIdFromUrl,parseCarateenTitle,parseCarateenCatalogue,parseCarateenGuide,parseCarateenRecent,carateenMediaUrl} from '../../shared/carateen-source.js';
import {getCarateenCatalogue,fetchCarateenPage,getCarateenDetails,resolveCarateenServers,readCarateenJson} from '../src/carateen.js';
import {mergeShow} from '../src/merge-library.js';

const tg=[{id:71,title:'مغامرة كرتونية',category:'مسلسل مدبلج',enabled:true,poster_cover:'71_cover.webp',description:'وصف المسلسل',release_year:'1997',episodes_count_real:2,updated_at:'2099-01-01'}];
const sp=[{id:84,name:'حكاية الملعب',is_movie:0,planet_name:'شارع الأنمي',tags:'Court Story, sport, hero',pref:'وصف الحكاية',cover_full_path:'https://cdn.spacetoongo.com/poster.jpg',ep_count:24,updated_at:'2099-01-01'}];
const tgEpisodes=[{id:711,title:'شارة البداية',show_id:71,order_id:0,season:0},{id:712,title:'1. الحلقة الأولى',show_id:71,order_id:7,season:0,thumbnail:'712_thumbnail.webp'}];
const spEpisodes=[{id:8401,slug:'9401',tv_series_id:84,number:1,pref:'بداية المباراة',season:null,cost:'Free',duration:1420,updated_at:'2099-01-01'},{id:8402,slug:'9402',tv_series_id:84,number:2,pref:'نهاية المباراة',season:null,cost:'Premium',updated_at:'2099-01-01'}];
const media='https://pegasus.5387692.xyz/api/sp/hls/8e5ec05a-a624-4de3-9ba6-f9885459fb5d/playlist.m3u8';
const mock=async path=>{
  if(path==='/api/tvshows')return tg;if(path==='/api/sp/tvshows')return sp;
  if(path==='/api/episodes?id=71')return tgEpisodes;if(path==='/api/sp/episodes?id=84')return spEpisodes;
  if(path==='/api/sp/recentEpisodes')return [spEpisodes[1],spEpisodes[0]];
  throw Error('Unexpected mock request '+path);
};

test('Carateen IDs preserve section and published episode slug without guessing title kind',()=>{
  const id='sp:carateen:e:sp-84:9401';assert.equal(carateenUrl(id),'https://carateen.tv/watch/sp/84/9401');assert.equal(carateenIdFromUrl(carateenUrl(id)),id);
  assert.equal(parseCarateenId(id).episodeId,9401);assert.equal(parseCarateenId(id).showId,84);
  assert.equal(carateenIdFromUrl('https://carateen.tv/watch/71'),null);
  assert.equal(carateenIdFromUrl('/watch/71','series'),'sp:carateen:s:tg-71');
  for(const value of ['sp:carateen:s:sp-84:9401','sp:carateen:e:tg-71','sp:carateen:m:tg-0','sp:carateen:m:tg-071'])assert.equal(parseCarateenId(value),null);
  for(const value of ['https://example.com/watch/71','https://carateen.tv/watch/71?token=x','https://user@carateen.tv/watch/71'])assert.equal(carateenIdFromUrl(value,'film'),null);
});

test('Carateen metadata keeps searchable keywords separate from identity and ignores fetch timestamps',()=>{
  const title=parseCarateenTitle(sp[0],'sp');assert.deepEqual(title.altTitles,[]);assert.match(title.sourceSearchText,/Court Story/);assert.equal(title.synopsis,sp[0].pref);assert.ok(title.collections.includes('anime'));
  assert.equal(title.episodeUpdateFeed,undefined);
  assert.equal(title.year,null);for(const key of ['updatedAt','releaseDate','episodesUpdatedAt','providerUpdatedAt','tmdbId'])assert.equal(title[key],undefined);
  const old=parseCarateenTitle(tg[0],'tg');assert.equal(old.year,1997);assert.deepEqual(old.audioLanguages,['ar']);assert.match(old.portrait,/\/assets\/img\/posters\/71_cover.webp$/);
  assert.equal(parseCarateenTitle({...tg[0],enabled:false},'tg'),null);
  const partial=parseCarateenCatalogue([tg[0],{id:99,title:'Malformed'}],'tg');assert.equal(partial.items.length,1);assert.equal(partial.partial,true);
});

test('Carateen guide keeps intro and unknown seasons without inventing episode coordinates',()=>{
  const guide=parseCarateenGuide('sp:carateen:s:tg-71',tgEpisodes);assert.equal(guide.episodesComplete,true);
  assert.deepEqual(guide.episodes.map(e=>[e.id,e.season,e.number]),[['sp:carateen:e:tg-71:711',null,null],['sp:carateen:e:tg-71:712',null,1]]);
  assert.equal(guide.episodes[1].thumbs.custom,'https://carateen.tv/assets/img/thumbnails/712_thumbnail.webp');
  const spGuide=parseCarateenGuide('sp:carateen:s:sp-84',spEpisodes);assert.equal(spGuide.episodes[0].id,'sp:carateen:e:sp-84:9401');assert.equal(spGuide.episodes[0].sourceEpisodeId,8401);
  assert.equal(spGuide.episodes[0].durationSec,1420);
  assert.equal(spGuide.episodes[1].access,'public','upstream cost label is not the public guest API access decision');
  const bad=parseCarateenGuide('sp:carateen:s:sp-84',[...spEpisodes,{...spEpisodes[0],tv_series_id:85}]);assert.equal(bad.episodesComplete,false);assert.equal(bad.episodes.length,2);
});

test('Carateen recent feed groups actual episode IDs without replacing a guide or manufacturing dates',()=>{
  const result=parseCarateenRecent([spEpisodes[1],spEpisodes[0]],[parseCarateenTitle(sp[0],'sp')]);assert.equal(result.items.length,1);
  const row=result.items[0];assert.equal(row.episodeUpdateFeed,true);assert.equal(row.latestEpisode,'sp:carateen:e:sp-84:9402');assert.deepEqual(row.recentEpisode,{id:row.latestEpisode,title:spEpisodes[1].pref,season:null,number:2});assert.equal(row.episodes.length,2);assert.equal(row.episodesComplete,false);assert.equal(row.episodesUpdatedAt,undefined);
});

test('Carateen fetch combines snapshots, searches Latin source keywords and preserves partial errors',async()=>{
  const all=await getCarateenCatalogue({read:mock});assert.equal(all.items.length,2);
  const search=await fetchCarateenPage({search:'Court Story',read:mock});assert.deepEqual(search.items.map(r=>r.id),['sp:carateen:s:sp-84']);assert.deepEqual(search.items[0].altTitles,[]);
  const latest=await fetchCarateenPage({latest:true,kind:'series',read:mock});assert.equal(latest.items[0].latestEpisode,'sp:carateen:e:sp-84:9402');
  const partial=await getCarateenCatalogue({read:async path=>{if(path.includes('/sp/'))throw Error('Carateen HTTP 403');return tg;}});assert.equal(partial.items.length,1);assert.equal(partial.partial,true);assert.match(partial.providerErrors[0].error,/403/);
});

test('Carateen details preserve old guide during partial/missing upstream responses',async()=>{
  const title=await getCarateenDetails('sp:carateen:s:sp-84',{read:mock,readSnapshot:()=>null});assert.equal(title.episodeCount,2);
  assert.equal(title.episodeUpdateFeed,undefined);
  const saved=await getCarateenDetails(title.id,{read:async()=>{throw Error('Carateen HTTP 403');},readSnapshot:()=>({...title,episodeUpdateFeed:true})});assert.equal(saved.episodesComplete,false);assert.deepEqual(saved.episodes,title.episodes);assert.equal(saved.episodeUpdateFeed,undefined);
});

test('Carateen player uses verified slug-to-internal ID and only public guest request',async()=>{
  const calls=[],read=async(path,options)=>{calls.push([path,options]);if(path==='/api/sp/episodes?id=84')return spEpisodes;if(path==='/api/sp/episode/link')return {success:true,id:'9402',link:media};throw Error('Unexpected request');};
  const servers=await resolveCarateenServers('sp:carateen:e:sp-84:9402',{read});assert.equal(servers[0].type,'hls');assert.equal(servers[0].streamUrl,media);
  assert.deepEqual(servers[0].headers,{Referer:'https://carateen.tv/',Origin:'https://carateen.tv'});
  assert.deepEqual(calls[1][1],{fresh:true,method:'POST',body:{episodeId:8402,userId:null}});
  await assert.rejects(resolveCarateenServers('sp:carateen:e:sp-84:9999',{read}),/not found/);
  await assert.rejects(resolveCarateenServers('sp:carateen:e:sp-84:9402',{read:async path=>path.includes('episodes?')?spEpisodes:{requireAuth:true,link:media}}),/sign-in/);
  await assert.rejects(resolveCarateenServers('sp:carateen:e:sp-84:9402',{read:async path=>path.includes('episodes?')?spEpisodes:{success:true,id:'9401',link:media}}),/identity mismatch/);
});

test('Carateen film language editions are servers without episodic numbering',async()=>{
  const id='sp:carateen:m:sp-84',title={...parseCarateenTitle({...sp[0],is_movie:1},'sp')};
  const versions=spEpisodes.map((row,i)=>({...row,pref:i?'باللغة اليابانية':'بالدبلجة العربية'}));
  const read=async(path,options)=>path.includes('episodes?')?versions:{success:true,id:options.body.episodeId===8401?'9401':'9402',link:media};
  const details=await getCarateenDetails(id,{read,readSnapshot:()=>title});assert.deepEqual(details.episodes,[]);assert.equal(details.filmVersions.length,2);assert.ok(details.filmVersions.every(e=>e.number===null));
  const servers=await resolveCarateenServers(id,{read,readSnapshot:()=>title});assert.equal(servers.length,2);assert.deepEqual(servers[0].audioLanguages,['ar']);assert.deepEqual(servers[1].audioLanguages,['ja']);assert.equal(servers[1].subtitleLanguages,undefined);
});

test('partial Carateen film guides retain own editions while complete guides replace the edition list',async()=>{
  const id='sp:carateen:m:sp-84',metadata=parseCarateenTitle({...sp[0],is_movie:1},'sp');
  const old=await getCarateenDetails(id,{read:async()=>spEpisodes,readSnapshot:()=>metadata});
  old.episodes=[{id,title:old.title,season:1,number:1}];
  old.filmVersions.push({...old.filmVersions[0],id:'sp:carateen:e:sp-99:1001'});
  const changed={...spEpisodes[0],pref:'بالدبلجة العربية'},malformed={...spEpisodes[1],tv_series_id:999};
  const partial=await getCarateenDetails(id,{read:async()=>[changed,malformed],readSnapshot:()=>old});
  assert.equal(partial.episodesComplete,false);assert.deepEqual(partial.filmVersions.map(ep=>ep.id),['sp:carateen:e:sp-84:9401','sp:carateen:e:sp-84:9402']);assert.equal(partial.filmVersions[0].title,'بالدبلجة العربية');assert.deepEqual(partial.episodes,[]);
  const complete=await getCarateenDetails(id,{read:async()=>[changed],readSnapshot:()=>old});assert.equal(complete.episodesComplete,true);assert.deepEqual(complete.filmVersions.map(ep=>ep.id),['sp:carateen:e:sp-84:9401']);
});

test('same-source film edition merges replace complete lists, retain partial lists and do not mix providers',()=>{
  const id='sp:carateen:m:sp-84',metadata=parseCarateenTitle({...sp[0],is_movie:1},'sp'),old={...metadata,filmVersions:parseCarateenGuide(id,spEpisodes).episodes};
  const revised={...old.filmVersions[0],title:'بالدبلجة العربية'},incoming={...metadata,episodesComplete:false,filmVersions:[revised]};
  const partial=mergeShow(old,incoming);assert.equal(partial.filmVersions.length,2);assert.equal(partial.filmVersions[0].title,revised.title);
  const complete=mergeShow(old,{...incoming,episodesComplete:true});assert.deepEqual(complete.filmVersions,[revised]);assert.equal(complete.episodes.length,1,'film editions do not become autoplay episodes');
  assert.deepEqual(mergeShow(old,{...incoming,id:'sp:carateen:m:sp-99',episodesComplete:true}).filmVersions,old.filmVersions);
  assert.equal(mergeShow({...metadata,id:'fm:m:1234'},incoming).filmVersions,undefined,'another provider title does not inherit an unrelated source edition list');
});

test('Carateen media validation rejects arbitrary destinations, guessed query variants and untrusted API routes',async()=>{
  assert.equal(carateenMediaUrl(media),media);assert.ok(carateenMediaUrl('https://pegasus.5387692.xyz/api/hls/539/playlist.m3u8'));
  for(const url of [media+'?bypass=1',media.replace('https:','http:'),media.replace('pegasus.5387692.xyz','127.0.0.1'),media.replace('/playlist.m3u8','/other.m3u8'),media.replace('https://','https://user@')])assert.equal(carateenMediaUrl(url),null);
  for(const path of ['https://example.com/api/tvshows','/api/admin','/api/sp/episodes?id=84&other=x','/api/tvshows?token=x'])await assert.rejects(readCarateenJson(path),/Invalid Carateen/);
  await assert.rejects(readCarateenJson('/api/sp/episode/link',{method:'POST',body:{episodeId:8401,userId:'invented-user'}}),/Invalid Carateen/);
});
