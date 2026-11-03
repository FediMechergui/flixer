import test from 'node:test';
import assert from 'node:assert/strict';
import {arabicId,arabicIdFromUrl,arabicUrl,egydeadWatchLink,fetchAhwakPage,parseArabicDetails,resolveArabicServers} from '../src/arabic-providers.js';

const origin='https://yam.ahwaktv.net';
const moved=location=>new Response('',{status:301,headers:{location}});

test('Ahwak follows long published title moves with a shrinking total request budget',async()=>{
  let tick=0;const calls=[];
  const response=await fetchAhwakPage(`${origin}/watch.php?vid=0`,{now:()=>tick,fetchImpl:async(url,options)=>{
    calls.push({url,...options});tick+=400;
    const id=Number(new URL(url).searchParams.get('vid'));
    return id<18?moved(`/watch.php?vid=${id+1}`):new Response('correct episode');
  }});
  assert.equal(await response.text(),'correct episode');assert.equal(calls.length,19);
  assert.ok(calls.every(call=>call.manualRedirect&&call.timeoutMs<=6500));
  assert.equal(calls.at(-1).timeoutMs,4800);
});

test('Ahwak rejects foreign, unrelated and cyclic redirects before requesting them',async()=>{
  for(const destination of ['https://evil.test/watch.php?vid=next',`${origin}/admin?vid=next`,`${origin}/watch.php?vid=next&url=x`,`${origin}/watch.php?vid=next#x`,'https://user@yam.ahwaktv.net/watch.php?vid=next']){
    let calls=0;
    await assert.rejects(fetchAhwakPage(`${origin}/watch.php?vid=start`,{fetchImpl:async()=>{calls++;return moved(destination);}}),/destination changed/);
    assert.equal(calls,1);
  }
  let calls=0;await assert.rejects(fetchAhwakPage(`${origin}/watch.php?vid=loop`,{fetchImpl:async url=>{calls++;return moved(url);}}),/redirect loop/);assert.equal(calls,1);
});

test('Ahwak stops at the hop and total time limits',async()=>{
  let calls=0;await assert.rejects(fetchAhwakPage(`${origin}/watch.php?vid=start`,{fetchImpl:async()=>moved(`/watch.php?vid=${++calls}`)}),/Too many Ahwak/);assert.equal(calls,25);
  let tick=0;calls=0;await assert.rejects(fetchAhwakPage(`${origin}/watch.php?vid=slow`,{now:()=>tick,fetchImpl:async()=>{tick+=7000;return moved(`/watch.php?vid=${++calls}`);}}),/deadline exceeded/);assert.equal(calls,2);
});

test('Ahwak reuses only the successfully followed title destination for a bounded cache lifetime',async()=>{
  const redirectCache=new Map(),calls=[];let tick=0;
  const options={redirectCache,now:()=>tick,fetchImpl:async url=>{calls.push(url);return url.endsWith('old')?moved('/watch.php?vid=new'):new Response('episode');}};
  const initial=`${origin}/watch.php?vid=old`;
  await fetchAhwakPage(initial,options);await fetchAhwakPage(initial,options);
  assert.deepEqual(calls,[initial,`${origin}/watch.php?vid=new`,`${origin}/watch.php?vid=new`]);
  tick=6*3600000+1;await fetchAhwakPage(initial,options);assert.equal(calls.at(-2),initial);
});

test('a removed Ahwak cached destination retries the original source within the existing deadline',async()=>{
  for(const status of [404,410]){
    const initial=`${origin}/watch.php?vid=old`,cached=`${origin}/watch.php?vid=cached`,current=`${origin}/watch.php?vid=current`,redirectCache=new Map([[initial,{url:cached,at:0}]]),calls=[];let tick=0;
    const response=await fetchAhwakPage(initial,{redirectCache,now:()=>tick,fetchImpl:async(url,options)=>{
      calls.push({url,timeoutMs:options.timeoutMs});tick+=4000;
      return url===cached?new Response('removed',{status}):url===initial?moved(current):new Response('correct episode');
    }});
    assert.equal(await response.text(),'correct episode');assert.deepEqual(calls.map(c=>c.url),[cached,initial,current]);assert.equal(calls.at(-1).timeoutMs,4000);assert.equal(redirectCache.get(initial).url,current);
  }
});

test('an Ahwak cached removal cannot reset the redirect deadline or hop budget',async()=>{
  const initial=`${origin}/watch.php?vid=old`,cached=`${origin}/watch.php?vid=cached`,redirectCache=new Map([[initial,{url:cached,at:0}]]);let tick=0,calls=0;
  await assert.rejects(fetchAhwakPage(initial,{redirectCache,now:()=>tick,fetchImpl:async url=>{calls++;tick+=7000;return url===cached?new Response('',{status:404}):moved('/watch.php?vid=next');}}),/deadline exceeded/);assert.equal(calls,2);assert.equal(redirectCache.has(initial),false);
  calls=0;redirectCache.set(initial,{url:cached,at:0});
  await assert.rejects(fetchAhwakPage(initial,{redirectCache,now:()=>0,fetchImpl:async()=>++calls===1?new Response('',{status:410}):moved(`/watch.php?vid=next${calls}`)}),/Too many Ahwak/);assert.equal(calls,25);
});

test('Ahwak uses the final page published player ID and source context',async()=>{
  const id='sp:ahwaktv:e:old',calls=[];
  const servers=await resolveArabicServers(id,{readSnapshot:async()=>null,fetchPage:async url=>{
    calls.push(url);
    return calls.length===1?`<div id="video-wrapper"><a id="play-video" href="${origin}/see.php?vid=current">Play</a></div>`:'<div class="brooks_player"><iframe src="https://www.ok.ru/videoembed/123"></iframe></div>';
  }});
  assert.deepEqual(calls,[`${origin}/watch.php?vid=old`,`${origin}/see.php?vid=current`]);
  assert.equal(servers[0].embedUrl,'https://www.ok.ru/videoembed/123');assert.equal(servers[0].headers.Referer,calls[1]);
});

test('Arabic player Referer retains the final response URL after a player-page redirect',async()=>{
  const id='sp:ahwaktv:e:old',final=`${origin}/see.php?vid=final`,calls=[];
  const servers=await resolveArabicServers(id,{readSnapshot:async()=>null,fetchPage:async(url,{onResolvedUrl})=>{
    calls.push(url);onResolvedUrl?.(calls.length===1?url:final);
    return calls.length===1?`<div id="video-wrapper"><a id="play-video" href="${origin}/see.php?vid=published">Play</a></div>`:'<div class="brooks_player"><iframe src="https://www.ok.ru/videoembed/123"></iframe></div>';
  }});
  assert.equal(servers[0].headers.Referer,final);
});

test('EgyDead plural episode routes retain saved IDs and admit only the matching watch page',async()=>{
  const old='https://tv10.egydead.live/episode/suits-arabia-s01e01/',current='https://a1.egydead.media/episodes/suits-arabia-s01e01/',id=arabicId('egydead','e',old);
  assert.equal(arabicId('egydead','e',current),id);assert.equal(arabicIdFromUrl(current),id);
  const detail=`<div class="watchNow"><a href="${current}watch/">Watch</a></div>`;
  assert.equal(egydeadWatchLink(id,detail),'https://tv10.egydead.live/episodes/suits-arabia-s01e01/watch/');
  for(const url of [current.replace('s01e01','s01e02')+'watch/',current.replace('/episodes/','/movies/')+'watch/',current+'watch/?target=elsewhere',current+'watch/#elsewhere','https://evil.test/episodes/suits-arabia-s01e01/watch/'])assert.equal(egydeadWatchLink(id,`<div class="watchNow"><a href="${url}">Watch</a></div>`),null);
  const calls=[];const servers=await resolveArabicServers(id,{readSnapshot:async()=>null,fetchPage:async url=>{
    calls.push(url);return calls.length===1?detail:'<ul class="serversList"><li data-link="https://hgcloud.to/e/source-episode"></li></ul>';
  }});
  assert.equal(calls.length,2);assert.match(calls[1],/\/episodes\/suits-arabia-s01e01\/watch\/$/);
  assert.equal(servers[0].headers.Referer,current+'watch/');
});

test('EgyDead series discover plural episode links without importing sidebar titles or duplicate episode IDs',()=>{
  const id=arabicId('egydead','s','https://a1.egydead.media/season/suits-arabia-2022/');
  const item=parseArabicDetails(id,'<h1>Suits Arabia</h1><a href="/episodes/suits-arabia-s01e01/">Episode 1</a><a href="/episode/suits-arabia-s01e01/">Episode 1</a><a href="/episodes/another-s01e99/">Episode 99</a>');
  assert.equal(item.episodes.length,1);assert.equal(item.episodes[0].number,1);assert.equal(item.episodes[0].season,1);
  assert.equal(arabicUrl(item.episodes[0].id),'https://tv10.egydead.live/episode/suits-arabia-s01e01/');
});
