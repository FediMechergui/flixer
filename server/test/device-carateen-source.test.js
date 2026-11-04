import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createNativeCarateenSource,carateenNativeRequestUrl} from '../../shared/carateen-native.js';

const tg=[{id:71,title:'مغامرة كرتونية',category:'مسلسل مدبلج',enabled:true,poster_cover:'71_cover.webp',episodes_count_real:2}];
const sp=[{id:84,name:'حكاية الملعب',is_movie:0,planet_name:'شارع الأنمي',tags:'Court Story, sport',ep_count:2},{id:85,name:'فيلم الملعب',is_movie:1,planet_name:'أفلام',ep_count:2}];
const tgEpisodes=[{id:711,title:'شارة البداية',show_id:71,order_id:0,season:0},{id:712,title:'1. الحلقة الأولى',show_id:71,order_id:7,season:0,thumbnail:'712_thumbnail.webp'}];
const spEpisodes=[{id:8401,slug:'9401',tv_series_id:84,number:1,pref:'البداية',season:null,cost:'Free',duration:1400},{id:8402,slug:'9402',tv_series_id:84,number:2,pref:'النهاية',season:null,cost:'Premium'}];
const filmEpisodes=spEpisodes.map((row,i)=>({...row,tv_series_id:85,pref:i?'باللغة اليابانية':'بالدبلجة العربية'}));
const media='https://pegasus.5387692.xyz/api/sp/hls/8e5ec05a-a624-4de3-9ba6-f9885459fb5d/playlist.m3u8';
const reply=(options,data,status=200)=>({url:options.url,status,data:typeof data==='string'?data:JSON.stringify(data)});
function regular(options){const url=new URL(options.url);if(url.pathname==='/api/tvshows')return tg;if(url.pathname==='/api/sp/tvshows')return sp;if(url.pathname==='/api/episodes')return tgEpisodes;if(url.pathname==='/api/sp/episodes')return url.searchParams.get('id')==='85'?filmEpisodes:spEpisodes;if(url.pathname==='/api/sp/recentEpisodes')return [spEpisodes[1]];if(url.pathname==='/api/episode')return {streamUrl:'https://pegasus.5387692.xyz/api/hls/539/playlist.m3u8'};if(url.pathname==='/api/sp/episode/link')return {success:true,id:options.data.episodeId===8401?'9401':'9402',link:media};throw Error('Unexpected request '+options.url);}
function helper(respond=options=>reply(options,regular(options)),extra={}){const calls=[],http={request:async options=>{calls.push(options);return respond(options);}},api=createNativeCarateenSource({http:()=>http,agent:()=> 'Test WebView/1',...extra});return {api,calls};}

test('native Carateen catalogue reuses two full snapshots across pagination, searches and collection filters',async()=>{
  const h=helper();assert.equal(h.api.enabled(),true);assert.equal(h.api.supports('sp:carateen:s:tg-71'),true);assert.equal(h.api.supports('https://carateen.tv/api/tvshows'),false);
  const [series,films]=await Promise.all([h.api.page(),h.api.page({kind:'film'})]);assert.equal(series.items.length,2);assert.equal(films.items.length,1);assert.equal(h.calls.length,2);
  const search=await h.api.search('Court Story',{aliases:['حكاية الملعب']});assert.equal(search.length,1);assert.equal(search[0].id,'sp:carateen:s:sp-84');assert.deepEqual(search[0].altTitles,[]);
  assert.equal((await h.api.page({collection:'anime'})).items.length,1);assert.equal(h.calls.length,2);
  assert.ok(h.calls.every(call=>call.method==='GET'&&call.disableRedirects&&call.headers['X-Carateen-Client']==='web-frontend-v1'&&!call.headers.Authorization&&!call.headers.Cookie&&call.connectTimeout<=8000&&call.readTimeout<=15000));
});

test('one native caller abort does not poison a shared source catalogue request',async()=>{
  const releases=[],h=helper(options=>new Promise(resolve=>releases.push(()=>resolve(reply(options,regular(options)))))),controller=new AbortController();
  const aborted=h.api.page({signal:controller.signal}),active=h.api.page();controller.abort();await assert.rejects(aborted,{name:'AbortError'});assert.equal(releases.length,2);for(const release of releases)release();assert.equal((await active).items.length,2);assert.equal(h.calls.length,2);
  await h.api.search('Court Story');assert.equal(h.calls.length,2);
});

test('native Carateen details preserve real episode IDs, unclassified seasons, intros, artwork and duration',async()=>{
  const h=helper(),tgTitle=await h.api.details('sp:carateen:s:tg-71'),spTitle=await h.api.details('sp:carateen:s:sp-84');
  assert.deepEqual(tgTitle.episodes.map(ep=>[ep.season,ep.number]),[[null,null],[null,1]]);assert.equal(tgTitle.episodes[1].thumbs.custom,'https://carateen.tv/assets/img/thumbnails/712_thumbnail.webp');assert.deepEqual(tgTitle.episodes[1].audioLanguages,['ar']);
  assert.equal(spTitle.episodes[0].id,'sp:carateen:e:sp-84:9401');assert.equal(spTitle.episodes[0].sourceEpisodeId,8401);assert.equal(spTitle.episodes[0].durationSec,1400);assert.equal(spTitle.episodeUpdateFeed,undefined);assert.equal(spTitle.providerUpdatedAt,undefined);
  const before=h.calls.length;await h.api.details(spTitle.id);assert.equal(h.calls.length,before);
});

test('native recent entries carry exact feed evidence while full catalogues remain undated',async()=>{
  const h=helper(),page=await h.api.page({latest:true});assert.equal(page.items.length,1);assert.equal(page.items[0].latestEpisode,'sp:carateen:e:sp-84:9402');assert.equal(page.items[0].episodeUpdateFeed,true);assert.equal(page.items[0].recentEpisode.number,2);assert.equal(page.items[0].providerUpdatedAt,undefined);assert.equal(page.items[0].episodesComplete,false);
  const cached=await h.api.page({latest:true});assert.equal(cached.items.length,1);assert.equal(h.calls.length,3);
});

test('native players validate guide membership then use actual public GET and guest POST contracts',async()=>{
  const h=helper(),tgServers=await h.api.servers('sp:carateen:e:tg-71:712'),spServers=await h.api.servers('sp:carateen:e:sp-84:9402');
  assert.equal(tgServers[0].type,'hls');assert.equal(spServers[0].streamUrl,media);assert.equal(spServers[0].rawStreamUrl,media);assert.equal(spServers[0].deviceResolved,true);
  assert.deepEqual(spServers[0].headers,{Referer:'https://carateen.tv/',Origin:'https://carateen.tv'});
  const post=h.calls.find(call=>call.method==='POST');assert.equal(post.url,'https://carateen.tv/api/sp/episode/link');assert.deepEqual(post.data,{episodeId:8402,userId:null});
  const before=h.calls.length;await assert.rejects(h.api.servers('sp:carateen:e:sp-84:9999'),/not found/);assert.equal(h.calls.length,before);
});

test('native film versions stay server choices and partial metadata retains prior source editions',async()=>{
  let guide=filmEpisodes;const h=helper(options=>reply(options,new URL(options.url).pathname==='/api/sp/episodes'?guide:regular(options)));
  const id='sp:carateen:m:sp-85',first=await h.api.details(id);assert.deepEqual(first.episodes,[]);assert.equal(first.filmVersions.length,2);assert.ok(first.filmVersions.every(ep=>ep.number===null));
  const servers=await h.api.servers(id);assert.equal(servers.length,2);assert.deepEqual(servers.map(row=>row.audioLanguages),[['ar'],['ja']]);assert.equal(servers[1].subtitleLanguages,undefined);
  guide=[{...filmEpisodes[0],pref:'بالدبلجة العربية الجديدة'},{...filmEpisodes[1],tv_series_id:99}];const partial=await h.api.details(id,{fresh:true});assert.equal(partial.episodesComplete,false);assert.equal(partial.filmVersions.length,2);assert.equal(partial.filmVersions[0].title,guide[0].pref);
  guide=[filmEpisodes[0]];const full=await h.api.details(id,{fresh:true});assert.equal(full.episodesComplete,true);assert.equal(full.filmVersions.length,1);
});

test('source denial respects cooldown and retains a saved catalogue without declaring success',async()=>{
  let failing=false;const h=helper(options=>failing?reply(options,{message:'Access denied'},403):reply(options,regular(options)));
  await h.api.page();failing=true;const result=await h.api.page({fresh:true});assert.equal(result.items.length,2);assert.equal(result.partial,true);assert.match(result.providerErrors[0].error,/403/);
  const before=h.calls.length;await h.api.page({fresh:true});assert.equal(h.calls.length,before);h.api.clearCache();await assert.rejects(h.api.page(),/403/);assert.equal(h.calls.length,before,'clearing metadata must not bypass a source access cooldown');
});

test('individual gated players do not disable other ordinary guest episodes',async()=>{
  const h=helper(options=>new URL(options.url).pathname==='/api/sp/episode/link'&&options.data.episodeId===8402?reply(options,{requireAuth:true},403):reply(options,regular(options)));
  await assert.rejects(h.api.servers('sp:carateen:e:sp-84:9402'),/403/);assert.equal((await h.api.servers('sp:carateen:e:sp-84:9401')).length,1);
  const logicalGate=helper(options=>reply(options,new URL(options.url).pathname==='/api/sp/episode/link'?{requireAuth:true,link:media}:regular(options)));
  await assert.rejects(logicalGate.api.servers('sp:carateen:e:sp-84:9401'),/sign-in/);
});

test('native Carateen fails closed on redirects, wrong player identities, hostile media and malformed responses',async()=>{
  const redirect=helper(options=>({...reply(options,regular(options)),url:'https://example.com/api/tvshows'}));await assert.rejects(redirect.api.page(),/destination changed/);
  for(const player of [{success:true,id:'9999',link:media},{success:true,id:'9401',link:'https://127.0.0.1/video.m3u8'}]){const h=helper(options=>reply(options,new URL(options.url).pathname==='/api/sp/episode/link'?player:regular(options)));await assert.rejects(h.api.servers('sp:carateen:e:sp-84:9401'),/identity mismatch|no supported direct player/);}
  const bad=helper(options=>reply(options,'<!DOCTYPE html><title>Sign in</title>'));await assert.rejects(bad.api.page(),/not public JSON/);
  const huge=helper(options=>reply(options,'x'.repeat(8*1024*1024+1)));await assert.rejects(huge.api.page(),/too large/);
  for(const path of ['https://example.com/api/tvshows','/api/admin','/api/sp/episodes?id=84&other=x','/api/tvshows?token=x'])assert.throws(()=>carateenNativeRequestUrl(path),/Invalid Carateen/);
  assert.throws(()=>carateenNativeRequestUrl('/api/sp/episode/link','POST',{episodeId:8401,userId:'invented'}),/Invalid Carateen/);
});

test('native catalogue body and bridge delivery may exceed one read phase without a false timeout',async()=>{
  let clock=100;const h=helper(async options=>{await Promise.resolve();clock=18100;return {...reply(options,regular(options)),data:regular(options)};},{now:()=>clock});
  const page=await h.api.page();assert.equal(page.items.length,2);assert.equal(h.calls.length,2);await h.api.page();assert.equal(h.calls.length,2);
});

test('an expired catalogue does not delay a cached title guide or film servers',async()=>{
  let clock=100;const h=helper(undefined,{now:()=>clock});await h.api.details('sp:carateen:s:tg-71');await h.api.details('sp:carateen:m:sp-85');const before=h.calls.length;clock+=600001;
  await h.api.details('sp:carateen:s:tg-71',{fresh:true});await h.api.servers('sp:carateen:m:sp-85');assert.ok(h.calls.slice(before).every(call=>!new URL(call.url).pathname.endsWith('tvshows')));
});

test('expired aggregate budget schedules no guide or player request after catalogue resolution',async()=>{
  let clock=100;const h=helper(options=>{clock+=26000;return reply(options,regular(options));},{now:()=>clock});await assert.rejects(h.api.details('sp:carateen:s:tg-71'),/time budget/);assert.ok(h.calls.length<=2);assert.ok(h.calls.every(call=>new URL(call.url).pathname.endsWith('tvshows')));
});

test('bundled Carateen entry runs with browser globals only and registers the native helper',async()=>{
  const require=createRequire(import.meta.url),{rolldown}=await import(pathToFileURL(require.resolve('rolldown',{paths:[fileURLToPath(new URL('../../client',import.meta.url))]})).href);
  const build=await rolldown({input:fileURLToPath(new URL('../../scripts/browser-carateen-entry.js',import.meta.url))});let code;try{code=(await build.generate({format:'iife',minify:true})).output[0].code;}finally{await build.close();}
  const calls=[],window={navigator:{userAgent:'Test WebView/1'},Capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorHttp:{request:async options=>{calls.push(options);return reply(options,regular(options));}}}}};
  vm.runInNewContext(code,{window,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,Date,setTimeout,clearTimeout});assert.equal(window.FlixerCarateenSource.enabled(),true);assert.equal((await window.FlixerCarateenSource.search('Court Story')).length,1);assert.equal(calls.length,2);
  assert.ok(code.length<35000,'the shared native helper must remain small');assert.ok(!code.includes('node:'));
});
