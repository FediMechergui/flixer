import test from 'node:test';
import assert from 'node:assert/strict';
import {createHdtodayRequest,parseHdtodayDetails,hdtodayTvFallbacks,resolveHdtodayServers,parseHdtodayPlayer} from '../src/hdtoday.js';
import {HDTODAY_PLAYER_ROUTES,isHdtodayPlayerRoute} from '../../shared/hdtoday-player-routes.js';
import {playerPolicy} from '../../client/src/lib/player-policy.js';

const slug='tv-migration-fixture-abc12345';
const path=`/watch/${slug}`;
const origin='https://flixorbit.cyou';
const migrated=`<script type="application/ld+json">{"@type":"TVSeries","name":"Migration fixture","genre":["Comedy"]}</script>
  <input name="tmdb_id" value="275139"><a href="${path}?s=2&amp;e=3">Episode 3</a>
  <div id="opt-list"><button name="x" value="23">vidcore-V2</button><button name="x" value="20">vidapi</button></div>`;
const old=`<a class="dummy-go__btn" href="/home-v1?to=${encodeURIComponent(path)}">Use the New HDToday</a>`;
const landing=`<a href="${origin}/__handoff?hv=source-issued-fixture&amp;to=${encodeURIComponent(path)}">Continue</a>`;
function response(body,url){const r=new Response(body);Object.defineProperty(r,'url',{value:url});return r;}

test('HDToday follows its published migration without changing saved title or episode identities',async()=>{
  const requests=[];
  const request=createHdtodayRequest({fetchRemote:async(url,options)=>{
    requests.push({url,headers:options.headers});
    if(url===`https://hdtoday.sx${path}`)return response(old,url);
    if(url.startsWith('https://hdtoday.sx/home-v1?'))return response(landing,url);
    if(url.startsWith(`${origin}/__handoff?`))return response(migrated,origin+path);
    if(url.startsWith(`${origin}/api/go?`))return response('<meta http-equiv="refresh" content="0;url=https://vidcore.io/tv/275139/2/3">',url);
    throw new Error(`Unexpected route ${url}`);
  }});
  const html=await request(path),details=parseHdtodayDetails(html,'https://hdtoday.sx'+path);
  assert.equal(details.id,`hd:s:${slug}`);
  assert.equal(details.tmdbId,275139);
  assert.equal(details.sourceUrl,'https://hdtoday.sx'+path);
  assert.equal(details.episodes[0].id,`hd:s:${slug}:2:3`);
  assert.equal(details.episodes[0].sourceUrl,`https://hdtoday.sx${path}?s=2&e=3`);
  const choices=await request.playerChoices(`hd:s:${slug}:2:3`);
  assert.deepEqual(choices.map(s=>s.id),['hdtoday:23','hdtoday:20']);
  assert.equal(choices[0].sourceUrl,`${origin}/api/go?t=tv&slug=${slug}&x=23&s=2&e=3`);
  assert.equal(parseHdtodayPlayer(await request(choices[0].embedUrl)),'https://vidcore.io/tv/275139/2/3');
  assert.equal(requests.at(-1).headers.Referer,`${origin}${path}?s=2&e=3`);
  assert.ok(requests.every(r=>!Object.keys(r.headers).some(key=>key.toLowerCase()==='cookie')),'no fabricated browser verification state');
  await assert.rejects(request(`https://hdtoday.sx/api/go?t=tv&slug=${slug}&x=9&s=2&e=3`),/no longer listed/);
  assert.equal(requests.length,4,'metadata and choices reuse the same migration context');
});

test('HDToday migration challenge stops requests and retains the existing cooldown',async()=>{
  let calls=0;
  const request=createHdtodayRequest({fetchRemote:async url=>{
    calls++;
    if(url.startsWith('https://hdtoday.sx/watch/'))return response(old,url);
    if(url.startsWith('https://hdtoday.sx/home-v1?'))return response(landing,url);
    return response('<title>Just a quick check</title>',origin+path);
  }});
  await assert.rejects(request(path),/browser verification/);
  await assert.rejects(request(path),/browser verification/);
  await assert.rejects(request('/movie'),/browser verification/);
  assert.equal(calls,3,'does not rotate mirrors after a verification page');
});

test('HDToday migration rejects foreign, credential-bearing and wrong-title handoffs',async()=>{
  for(const target of ['http://flixorbit.cyou/__handoff','https://127.0.0.1/__handoff','https://flixorbit.cyou.evil.test/__handoff','https://user@flixorbit.cyou/__handoff',`${origin}/__handoff?to=%2Fwatch%2Ftv-other`]){
    const request=createHdtodayRequest({fetchRemote:async url=>response(url.includes('/watch/')?old:`<a href="${target}">Continue</a>`,url)});
    await assert.rejects(request(path),/Invalid HDToday migration destination/);
  }
});

test('known HDToday identities refresh actual source choices instead of returning fixed fallbacks',async()=>{
  const id='hd:s:tv-source-refresh-known-abc12345:2:3';
  let fetches=0;
  const choices=[{id:'hdtoday:23',name:'Current source name',provider:'hdtoday',type:'embed',embedUrl:'https://hdtoday.sx/api/go?x=23',sourceUrl:origin+'/api/go?x=23',availability:'unverified'}];
  const refreshed=await resolveHdtodayServers(id,{tmdbId:275139,fresh:true,fetchChoices:async()=>choices,fetchPlayer:async()=>{
    fetches++;return '<meta http-equiv="refresh" content="0;url=https://vidcore.io/tv/275139/2/3">';
  }});
  assert.equal(fetches,1);
  assert.equal(refreshed.length,1);
  assert.equal(refreshed[0].sourceUrl,origin+'/api/go?x=23');
  assert.equal(refreshed[0].name,'Current source name');
  assert.equal(refreshed[0].routeResolved,true);
  assert.equal(refreshed[0].availability,'unverified','an embed redirect is not playback proof');
  assert.deepEqual(await resolveHdtodayServers(id,{tmdbId:275139}),refreshed,'cached actual routes precede generic templates');
  const unavailable=await resolveHdtodayServers(id,{tmdbId:275139,fresh:true,fetchChoices:async()=>{throw new Error('browser verification');}});
  assert.equal(unavailable.length,44);
  assert.equal(unavailable[0].embedUrl,'https://vidcore.io/tv/275139/2/3');
});

test('source-derived HDToday TV variants retain distinct season and episode coordinates',()=>{
  const routes=hdtodayTvFallbacks('hd:s:tv-source-routes-abc12345:2:13',4614);
  assert.equal(routes.length,44);
  const byId=id=>routes.find(r=>r.id===`hdtoday:${id}`).embedUrl;
  assert.equal(byId(9),'https://multiembed.mov/?video_id=4614&tmdb=1&s=2&e=13');
  assert.equal(byId(26),'https://embedbandit.com/embed/tv?tmdb=4614&season=2&episode=13');
  assert.equal(byId(40),'https://www.2embed.cc/embedtv/4614&s=2&e=13');
  assert.equal(byId(41),'https://autoembed.co/tv/tmdb/4614-2-13');
  assert.equal(byId(43),'https://frembed.surf/embed/serie/4614?sa=2&epi=13');
  for(const r of routes)assert.equal(parseHdtodayPlayer(`<meta http-equiv="refresh" content="0;url=${r.embedUrl}">`),r.embedUrl);
});

test('HDToday source refresh has a total budget and keeps unresolved advertised alternatives',async()=>{
  const id='hd:s:tv-budget-fixture-abc12345:2:3',choices=hdtodayTvFallbacks(id,275139).map(s=>({...s,embedUrl:s.sourceUrl}));
  const started=Date.now();let calls=0;
  const result=await resolveHdtodayServers(id,{tmdbId:275139,fresh:true,refreshBudgetMs:40,fetchChoices:async()=>choices,fetchPlayer:async(url,{timeoutMs})=>{
    calls++;assert.ok(timeoutMs>0&&timeoutMs<=40);
    if(new URL(url).searchParams.get('x')==='0')return '<meta http-equiv="refresh" content="0;url=https://vidsrc.mov/embed/tv/275139/2/3">';
    return new Promise(()=>{});
  }});
  assert.ok(Date.now()-started<2000,'does not wait for 44 separate upstream timeouts');
  assert.ok(calls<=5,'four bounded workers stop taking new requests at the shared deadline');
  assert.equal(result.length,44);
  assert.equal(result.filter(s=>s.routeResolved).length,1);
  assert.ok(result.every(s=>s.availability==='unverified'));
});

test('HDToday route cache is scoped to both the episode and its verified numeric identity',async()=>{
  const id='hd:s:tv-cache-identity-abc12345:2:3';
  await resolveHdtodayServers(id,{tmdbId:77,fresh:true,fetchChoices:async()=>[{id:'hdtoday:23',embedUrl:'https://hdtoday.sx/api/go?x=23'}],fetchPlayer:async()=>'<meta http-equiv="refresh" content="0;url=https://vidcore.io/tv/77/2/3">'});
  const changed=await resolveHdtodayServers(id,{tmdbId:88});
  assert.equal(changed[0].embedUrl,'https://vidcore.io/tv/88/2/3');
  const episode=await resolveHdtodayServers('hd:s:tv-cache-identity-abc12345:2:4',{tmdbId:77});
  assert.equal(episode[0].embedUrl,'https://vidcore.io/tv/77/2/4');
});

test('shared iframe policy admits all reviewed film and TV routes without admitting foreign paths',()=>{
  for(const route of HDTODAY_PLAYER_ROUTES)for(const template of [route.movie,route.tv]){
    const url=template.replaceAll('{id}','1234064').replaceAll('{season}','2').replaceAll('{episode}','13');
    assert.ok(isHdtodayPlayerRoute(url),url);
    assert.equal(playerPolicy({embedUrl:url}).sandbox,null,url);
  }
  for(const url of ['https://vidcore.io/account','https://evil.vidcore.io/tv/123/1/1','https://user@vidcore.io/tv/123/1/1','http://vidcore.io/tv/123/1/1','https://vidcore.io/tv/123/1/1?redirect=https://evil.test'])assert.equal(isHdtodayPlayerRoute(url),false,url);
});

test('source HTTP redirects share one deadline and never leave the reviewed source origin',async()=>{
  const requests=[];
  const request=createHdtodayRequest({fetchRemote:async(url,options)=>{
    requests.push({url,options});
    if(requests.length===1){await new Promise(resolve=>setTimeout(resolve,5));return new Response('',{status:302,headers:{Location:'/movie?page=2'}});}
    return response('catalogue',url);
  }});
  assert.equal(await request('/movie',{timeoutMs:500}),'catalogue');
  assert.equal(requests.length,2);
  assert.ok(requests.every(r=>r.options.manualRedirect===true));
  assert.ok(requests[1].options.timeoutMs<requests[0].options.timeoutMs);
  const foreign=createHdtodayRequest({fetchRemote:async()=>new Response('',{status:302,headers:{Location:'https://unreviewed.example/route'}})});
  await assert.rejects(foreign('/movie'),/Invalid HDToday source redirect/);
});

test('a late source response cannot start migration requests after the caller refresh budget expires',async()=>{
  const requests=[];
  const request=createHdtodayRequest({fetchRemote:async(url,options)=>{
    requests.push({url,options});
    if(url.includes('/watch/'))return response(old,url);
    await new Promise(resolve=>setTimeout(resolve,60));
    return response(landing,url);
  }});
  const result=await resolveHdtodayServers(`hd:s:${slug}:2:3`,{tmdbId:275139,fresh:true,refreshBudgetMs:20,fetchChoices:(id,options)=>request.playerChoices(id,options)});
  assert.equal(result.length,44,'verified templates remain available during a source timeout');
  await new Promise(resolve=>setTimeout(resolve,75));
  assert.equal(requests.length,2);
  assert.ok(requests.every(r=>new URL(r.url).hostname==='hdtoday.sx'),'expired migration never reaches the handoff host');
});

test('an index reassigned to a different source host never inherits the previous host fallback',async()=>{
  const id='hd:s:tv-renamed-route-abc12345:2:3';
  const choices=hdtodayTvFallbacks(id,275139).filter(s=>['hdtoday:0','hdtoday:3','hdtoday:23'].includes(s.id)).map(s=>({...s,embedUrl:s.sourceUrl,name:s.id==='hdtoday:0'?'HDToday · Newly assigned host':s.name}));
  const result=await resolveHdtodayServers(id,{tmdbId:275139,fresh:true,fetchChoices:async()=>choices,fetchPlayer:async url=>{
    if(new URL(url).searchParams.get('x')==='23')return '<meta http-equiv="refresh" content="0;url=https://vidcore.io/tv/275139/2/3">';
    throw new Error('unavailable');
  }});
  assert.deepEqual(result.map(s=>s.id),['hdtoday:23','hdtoday:3']);
  assert.ok(!result.some(s=>s.embedUrl.includes('vidsrc.mov')));
});

test('a successful source page with no choices clears its old advertised server inventory',async()=>{
  let html=migrated;
  const request=createHdtodayRequest({fetchRemote:async url=>response(html,url)});
  assert.equal((await request.playerChoices(`hd:s:${slug}:2:3`)).length,2);
  html='<title>Player unavailable</title>';
  assert.deepEqual(await request.playerChoices(`hd:s:${slug}:2:3`,{fresh:true}),[]);
  assert.deepEqual(await request.playerChoices(`hd:s:${slug}:2:3`),[]);
});
