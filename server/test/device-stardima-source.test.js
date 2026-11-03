import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {load} from 'cheerio';
const source=fs.readFileSync(new URL('../../client-terrarium/js/stardima-source.js',import.meta.url),'utf8');
const fixture=name=>fs.readFileSync(new URL('./fixtures/stardima/'+name,import.meta.url),'utf8'),json=name=>JSON.parse(fixture(name));
const series='sp:stardima:s:6ae791af3be9a',episode='sp:stardima:e:6ae791af3be9a:104745',film='sp:stardima:m:6ae7843be51cb';
// Browser DOM API shim for Node tests only. Cheerio is never shipped to Android.
function document(html){const $=load(html),wrap=n=>n?{getAttribute:key=>$(n).attr(key)??null,get textContent(){return $(n).text();},querySelectorAll:selector=>$(n).find(selector).toArray().map(wrap),querySelector:selector=>wrap($(n).find(selector).first()[0]),closest:selector=>wrap($(n).closest(selector)[0]),get lastElementChild(){return wrap($(n).children().last()[0]);},get nextElementSibling(){return wrap($(n).next()[0]);}}:null;return wrap($.root()[0]);}
function helper(respond,extra={}){const calls=[],window={navigator:{userAgent:'Test WebView/1'},Capacitor:{isNativePlatform:()=>true,Plugins:{CapacitorHttp:{request:async options=>{calls.push(options);return respond(options);}}}}};vm.runInNewContext(source,{window,URL,URLSearchParams,Date,setTimeout,clearTimeout,DOMParser:class{parseFromString(html){return document(html);}},...extra});return {api:window.FlixerStardimaSource,calls};}
const reply=(options,data,status=200)=>({url:options.url,status,data:typeof data==='string'?data:JSON.stringify(data)});
const hyperPage=(hash='S2RAD69y6rUV',servers=[{id:1,name:'Uqload',type:'iframe',status:'completed',is_vip:false}],is_vip=false)=>'<div data-page="'+JSON.stringify({component:'Video/Embed',props:{is_vip,video:{hashid:hash,servers}}}).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></div>';

test('native StarDima catalogue uses only anonymous free XHR and coalesces repeated paging',async()=>{
 const h=helper(options=>reply(options,fixture('series-list.json')));
 const [a,b]=await Promise.all([h.api.page({collection:'anime-dub'}),h.api.page({collection:'anime-dub'})]);
 assert.equal(h.calls.length,1);assert.equal(a.items.length,2);assert.equal(b.totalPages,153);assert.equal(a.items[0].id,series);assert.deepEqual([...a.items[0].audioLanguages],['ar']);assert.ok(a.items[0].tags.includes('anime'));assert.equal(a.items[0].originalLanguage,undefined);
 const call=h.calls[0],url=new URL(call.url);assert.equal(url.origin,'https://www.stardima.com');assert.equal(url.searchParams.get('premium'),'free');assert.equal(url.searchParams.get('category'),'anmy');assert.equal(url.searchParams.get('language'),'dub');assert.equal(call.headers['X-Requested-With'],'XMLHttpRequest');assert.equal(call.disableRedirects,true);assert.equal(call.headers.Authorization,undefined);assert.equal(call.headers.Cookie,undefined);
 assert.equal(h.api.supports(series),true);assert.equal(h.api.supports(episode),true);for(const id of ['sp:stardima:e:video-1','sp:stardima:s:../admin','https://www.stardima.com/api/series'])assert.equal(h.api.supports(id),false);
 await assert.rejects(h.api.page({page:0}),/catalogue page/);assert.equal(h.calls.length,1);
});

test('native search queries Arabic and Latin aliases concurrently without duplicate title identities',async()=>{
 const queries=[],h=helper(options=>{queries.push(new URL(options.url).searchParams.get('query'));return reply(options,fixture('series-list.json'));});
 const rows=await h.api.search('كايجو',{aliases:['Kaiju No. 8','الوحش الثامن','ignored fourth query']});assert.equal(rows.length,2);assert.deepEqual(queries,['كايجو','Kaiju No. 8','الوحش الثامن']);assert.ok(h.calls.every(call=>new URL(call.url).pathname==='/search'&&new URL(call.url).searchParams.get('premium')==='free'));
});

test('cancelling one native catalogue caller does not poison another caller sharing its request',async()=>{
 let finish;const h=helper(options=>new Promise(resolve=>{finish=()=>resolve(reply(options,fixture('series-list.json')));})),controller=new AbortController();
 const cancelled=h.api.page({signal:controller.signal}),active=h.api.page();controller.abort();await assert.rejects(cancelled,/cancelled/);finish();assert.equal((await active).items.length,2);assert.equal(h.calls.length,1);await h.api.page();assert.equal(h.calls.length,1);
});

test('device title guide preserves actual seasons, sparse episodes and explicit title aliases',async()=>{
 const data=json('season.json');data.episodes.splice(1,1);
 const h=helper(options=>reply(options,options.url.includes('/series/season/')?data:options.url.includes('/play/')?fixture('series-guide.html'):'<title>كايجو رقم 8 | Kaiju No. 8 | الوحش الثامن - ستارديما</title>'+fixture('series-detail.html')));
 const title=await h.api.details(series);assert.deepEqual(Array.from(title.episodes,e=>[e.season,e.number]),[[4,1],[4,3],[4,4]]);assert.equal(title.episodesComplete,true);assert.deepEqual([...title.altTitles],['Kaiju No. 8','الوحش الثامن']);assert.equal(title.originalLanguage,undefined);assert.equal(h.calls.length,3);
 await h.api.details(series);assert.equal(h.calls.length,3);assert.ok(h.calls.every(call=>!new URL(call.url).pathname.startsWith('/api/')));
});

test('device episode resolution refreshes public access and requests only published free completed server IDs',async()=>{
 let restricted=false;const h=helper(options=>{
  if(options.url.includes('/series/episode/')){const data=json('episode.json');if(restricted)data.episode.can_watch=false;return reply(options,data);}
  if(options.url.includes('/watch/'))return reply(options,hyperPage(undefined,[{id:1,name:'Uqload',type:'iframe',status:'completed',is_vip:false},{id:2,name:'VIP',type:'iframe',status:'completed',is_vip:true},{id:3,name:'Unspecified access',type:'iframe',status:'completed'},{id:4,name:'Pending',type:'iframe',status:'processing',is_vip:false}]));
  return reply(options,{player:'iframe',watch_url:'https://uqload.vc/embed-4x8ocux5qd97.html',headers:{Cookie:'PRIVATE',Authorization:'PRIVATE'}});
 });
 const rows=await h.api.servers(episode);assert.equal(rows.length,1);assert.equal(rows[0].provider,'stardima');assert.equal(rows[0].headers.Referer,'https://v2.hyperwatching.com/watch/S2RAD69y6rUV');assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);assert.equal(h.calls.length,3);assert.ok(h.calls[2].url.endsWith('/server/1/url'));
 restricted=true;await assert.rejects(h.api.servers(episode),/source access/);assert.equal(h.calls.length,4,'access check is refreshed even though previous player metadata is cached');
});

test('device playback rejects gated episodes, altered identities, VIP inventories and foreign player destinations',async()=>{
 for(const changes of [{can_watch:false},{can_watch:undefined},{is_exclusive:true},{reason:'subscription_required'},{watch_url:'https://foreign.test/watch/player1'}]){
  const h=helper(options=>reply(options,{...json('episode.json'),episode:{...json('episode.json').episode,...changes}}));await assert.rejects(h.api.servers(episode));assert.equal(h.calls.length,1);
 }
 const vip=helper(options=>reply(options,options.url.includes('/series/episode/')?fixture('episode.json'):hyperPage(undefined,[],true)));await assert.rejects(vip.api.servers(episode),/not publicly/);assert.equal(vip.calls.length,2);
 const foreign=helper(options=>reply(options,options.url.includes('/series/episode/')?fixture('episode.json'):options.url.includes('/watch/')?hyperPage():{player:'iframe',watch_url:'https://127.0.0.1/e/private'}));await assert.rejects(foreign.api.servers(episode),/temporarily unavailable/);assert.equal(foreign.calls.length,3);
});

test('film playback ignores global VIP navigation but rejects a locked player region',async()=>{
 const h=helper(options=>reply(options,options.url.includes('/play/')?'<nav>STARDIMA VIP</nav>'+fixture('film-play.html'):options.url.includes('/watch/')?hyperPage('ydvjuqtT2Mil'):{player:'iframe',watch_url:'https://lulustream.com/e/ca89bh8wwo66'}));
 assert.equal((await h.api.servers(film))[0].embedUrl,'https://lulustream.com/e/ca89bh8wwo66');
 const locked=helper(options=>reply(options,fixture('film-play.html').replace('<iframe','<p>VIP</p><iframe')));await assert.rejects(locked.api.servers(film),/free public player/);assert.equal(locked.calls.length,1);
});

test('a source 403 activates an origin cooldown without retries or arbitrary redirect following',async()=>{
 const h=helper(options=>reply(options,'Forbidden',403));await assert.rejects(h.api.page(),/HTTP 403/);await assert.rejects(h.api.page({kind:'film',fresh:true}),/retry later/);await assert.rejects(h.api.servers(episode,{fresh:true}),/retry later/);assert.equal(h.calls.length,1);
 const moved=helper(options=>({...reply(options,fixture('series-list.json')),url:'https://foreign.test/catalogue'}));await assert.rejects(moved.api.page(),/destination changed/);assert.equal(moved.calls.length,1);
});

test('guide refresh failure retains known episodes and cancellation never starts a source request',async()=>{
 let fail=false;const h=helper(options=>reply(options,fail?'Forbidden':options.url.includes('/series/season/')?fixture('season.json'):options.url.includes('/play/')?fixture('series-guide.html'):fixture('series-detail.html'),fail?403:200));
 const saved=await h.api.details(series);fail=true;const old=await h.api.details(series,{fresh:true});assert.equal(old.episodes.length,saved.episodes.length);assert.equal(old.episodesComplete,false);assert.match(old.providerErrors[0].error,/403/);
 const controller=new AbortController();controller.abort();const before=h.calls.length;await assert.rejects(h.api.page({signal:controller.signal}),/cancelled/);await assert.rejects(h.api.details(series,{signal:controller.signal}),/cancelled/);assert.equal(h.calls.length,before);
});

test('latest native feed validates actual guest episodes without manufacturing dates or genre membership',async()=>{
 const slugs=new Map([...fixture('latest.html').matchAll(/\/tvshow\/([^/"\s]+)\/play\/(\d+)/g)].map(match=>[Number(match[2]),match[1]]));
 const h=helper(options=>{
  if(options.url.endsWith('/newrelases'))return reply(options,fixture('latest.html'));
  const id=Number(new URL(options.url).pathname.split('/').pop()),data=json('episode.json');data.episode.id=id;data.series.slug=slugs.get(id);if(id!==104758)data.episode.can_watch=false;return reply(options,data);
 });
 const page=await h.api.page({latest:true});assert.equal(page.items.length,1);assert.equal(page.items[0].latestEpisode,'sp:stardima:e:6accfbe7a236f:104758');assert.equal(page.items[0].providerUpdatedAt,undefined);assert.equal(page.items[0].episodesComplete,false);assert.deepEqual([...page.items[0].tags],[]);assert.equal(page.partial,undefined);
});

test('a partial season refresh keeps saved episodes while adding newly published episodes from other seasons',async()=>{
 let refresh=false;const guide=fixture('series-guide.html')+'<div class="season-item" data-season-id="4348" data-season-number="S05"></div>';
 const h=helper(options=>{
  const path=new URL(options.url).pathname;
  if(path.includes('/series/season/')){
   if(path.endsWith('/4347')&&refresh)return reply(options,'Unavailable',503);
   const data=json('season.json');if(path.endsWith('/4348')){data.episodes=data.episodes.map(ep=>({...ep,id:ep.id+1000}));if(refresh)data.episodes.push({...data.episodes[0],id:113001,episode_number:5});}return reply(options,data);
  }
  return reply(options,path.includes('/play/')?guide:fixture('series-detail.html'));
 });
 const saved=await h.api.details(series);assert.equal(saved.episodes.length,8);refresh=true;const updated=await h.api.details(series,{fresh:true});
 assert.equal(updated.episodesComplete,false);assert.equal(updated.episodes.length,9);assert.ok(saved.episodes.every(ep=>updated.episodes.some(next=>next.id===ep.id)));assert.ok(updated.episodes.some(ep=>ep.id.endsWith(':113001')&&ep.season===5&&ep.number===5));assert.match(updated.providerErrors[0].error,/503/);
});

test('elapsed guide budget cannot schedule another source fetch',async()=>{
 let time=100;const h=helper(options=>{time+=18001;return reply(options,fixture('series-detail.html'));},{Date:{now:()=>time}});
 await assert.rejects(h.api.details(series),/time budget/);assert.equal(h.calls.length,1);
});
