import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseWcoId,wcoUrl,wcoIdFromUrl,parseWcoDirectory,parseWcoDetails,parseWcoRecent,parseWcoRecentEpisode,inspectWcoPlayer,resolveWcoServers} from '../src/wco.js';
import {specialistJobs,parseSpecialistId,specialistUrl} from '../src/specialist-providers.js';
import {unifiedTitle} from '../src/library-service.js';

const origin='https://www.wcostream.tv',id='sp:wco:s:example';
const ep=(slug,label,mode='sub',attrs='')=>`<a class="dark-episode-item" href="/${slug}" data-lang="${mode}" data-season="s1-0" ${attrs}><span>${label}</span><div><span>HD</span></div></a>`;
const detail=`<link rel="canonical" href="${origin}/anime/example"><div class="vsbaslik"><h2>Example</h2></div><div id="cat-img-desc"><img src="//images.wcostream.com/catimg/example.jpg"><div class="iltext">A source description.</div></div><span class="film-name" data-jname="別名"></span><div id="episodeList">${ep('example-season-1-episode-1-sub','Episode 1 English Subbed')}${ep('example-season-1-episode-1-dub','Episode 1 English Dubbed','dub')}${ep('example-fourth-season-episode-7-sub','Fourth Season Episode 7 English Subbed')}${ep('example-to-the-top-episode-3-sub','To The Top Episode 3 English Subbed')}${ep('example-ova','Special OVA')}${ep('paid-episode-9','Episode 9','sub','data-premium="1"')}${ep('example-movie','Movie: Example')}</div>`;

test('WCO identities retain exact public paths and never authorize another origin or aggregator',()=>{
 assert.equal(specialistUrl(id),origin+'/anime/example');assert.equal(parseSpecialistId(id).provider,'wco');
 assert.equal(wcoIdFromUrl(origin+'/anime/example/season=all&lang=dub'),id);
 assert.equal(wcoIdFromUrl(origin+'/anime/example?season=all&lang=sub'),id);
 for(const url of [origin+'/anime/movies',origin+'/anime/example?url=https://evil.test',origin+'/anime/example?lang=dub&lang=sub',origin+'/anime/example#evil','https://evil.test/anime/example','https://name@www.wcostream.tv/anime/example'])assert.equal(wcoIdFromUrl(url),null,url);
 for(const bad of ['sp:wco:s:../admin','sp:wco:e:example','sp:wco:s:example:episode','sp:wco:m:film','sp:wco:e:x:y?url=http://localhost'])assert.equal(parseWcoId(bad),null,bad);
});
test('WCO series preserve sparse episodes, sub/dub versions, specials and explicit season evidence',()=>{
 const row=parseWcoDetails(id,detail);assert.equal(row.episodeCount,5);assert.equal(row.synopsis,'A source description.');assert.equal(row.portrait,'https://images.wcostream.com/catimg/example.jpg');assert.deepEqual(row.altTitles,['別名']);
 assert.deepEqual(row.audioModes,['sub','dub']);assert.ok(row.episodesComplete);
 assert.equal(row.episodes[0].season,1);assert.equal(row.episodes[0].number,1,'specials cannot become the default before known episode one');
 assert.equal(row.episodes.find(e=>e.id.includes('fourth-season')).season,4);
 const reversed=parseWcoDetails(id,detail.replace('Fourth Season','Season Third').replace('fourth-season','season-third'));assert.equal(reversed.episodes.find(e=>e.id.includes('season-third')).season,3);
 assert.equal(row.episodes.find(e=>e.id.includes('to-the-top')).season,null);
 const special=row.episodes.find(e=>e.id.endsWith(':example-ova'));assert.equal(special.number,null);assert.equal(special.season,null);
 const first=row.episodes.filter(e=>e.season===1&&e.number===1);assert.equal(first.length,2);assert.notEqual(first[0].id,first[1].id);
 assert.ok(!row.episodes.some(e=>e.number===2||e.number===9));assert.ok(!JSON.stringify(row).includes('HD</'));
 assert.throws(()=>parseWcoDetails('sp:wco:s:other',detail),/identity/);
});
test('WCO directory parsing excludes premium cards and does not misread numeric titles as years',()=>{
 const html=`<a href="/anime/advert">Ad</a><div id="ddmcc_container"><div class="ddmcc"><a href="/anime/sealab-2021?lang=cartoon">Sealab 2021</a><a href="/anime/example?lang=dub">Example</a><a href="/anime/example?lang=sub">Example</a><a href="/anime/movies">Movies</a><div class="premium"><a href="/anime/paid">Paid</a></div></div></div>`;
 const rows=parseWcoDirectory(html);assert.equal(rows.length,2);assert.equal(rows[0].year,null);assert.deepEqual(rows[1].audioModes,['dub','sub']);
 assert.throws(()=>parseWcoDirectory('<h1>Access denied</h1>'),/format changed/);
});
test('WCO updates follow actual episode breadcrumbs and cannot invent parent IDs from slugs',()=>{
 const feed=parseWcoRecent(`<div id="country1"><div class="mansetlisteleme"><a href="/announcement">Announcement</a><a href="/example-season-2-episode-3">Example Episode 3</a><a href="/example-season-2-episode-3">Example Episode 3</a></div></div>`);assert.equal(feed.length,1);
 const row=parseWcoRecentEpisode(`<title>Example Season 2 Episode 3 English Subbed | WCO</title><div class="ildate"><a href="/anime/example/season=all&lang=sub">Example</a></div>`,feed[0].url);
 assert.equal(row.id,id);assert.equal(row.episodes[0].season,2);assert.equal(row.episodesComplete,false);assert.equal(row.latestEpisode,row.episodes[0].id);
 assert.throws(()=>parseWcoRecentEpisode('<title>Episode 3</title>',feed[0].url),/identity/);
});
test('WCO publishes a native resolver descriptor rather than a fabricated stream',async()=>{
 const episode='sp:wco:e:example:example-season-1-episode-1';const rows=await resolveWcoServers(episode);assert.equal(rows[0].type,'wco');assert.equal(rows[0].embedUrl,wcoUrl(episode));assert.equal(rows[0].streamUrl,undefined);
 assert.equal((await resolveWcoServers(id)).length,0);
 const html=`<link rel="canonical" href="${wcoUrl(episode)}"><iframe id="frameNewcizgifilmuploads0" src="https://embed.wcostream.com/inc/embed/index.php?pid=1&h=published"></iframe>`;
 const inspected=inspectWcoPlayer(episode,html);assert.equal(inspected.status,'unverified');assert.equal(inspected.captureMedia,false);assert.ok(!JSON.stringify(inspected).includes('published'));
 assert.equal(inspectWcoPlayer(episode,html.replace('https://embed.wcostream.com','https://evil.test')),null);
 assert.equal(inspectWcoPlayer(episode,html+'<div class="membership-required"></div>').status,'restricted');
 assert.equal(specialistJobs({kind:'film'}).some(j=>j.provider==='wco'),false);
 assert.equal(await unifiedTitle(id,{product:'dahsha',catalog:{product:'dahsha',shows:[]}}),null);
});

const helper=fs.readFileSync(new URL('../../client-terrarium/js/wco-source.js',import.meta.url),'utf8');
function client(resolve){const window={Capacitor:{Plugins:{WcoSource:{resolve}}}};vm.runInNewContext(helper,{window,URL,Map,Set,Date});return window.FlixerWcoSource;}

test('WCO source failures retain their reason and a retry requests fresh configuration',async()=>{
 let calls=0;const capacity=Object.assign(Error('source response'),{code:'WCO_CAPACITY'});
 const wco=client(async()=>{if(++calls===1)throw capacity;return {configuration:{server:'https://cdn.wcostream.com',enc:'fresh'}};});
 const source={provider:'wco',type:'wco',id:'x',embedUrl:origin+'/episode'};
 await assert.rejects(wco.resolve(source),error=>error===capacity);
 assert.match(wco.failureMessage(capacity),/at capacity/);
 assert.match(wco.failureMessage({code:'WCO_TIMEOUT'}),/did not respond in time/);
 assert.equal(wco.failureMessage({code:'unknown',message:'<untrusted source HTML>'}).includes('<'),false);
 assert.equal((await wco.resolve(source)).length,1);assert.equal(calls,2);
});

test('the publisher capacity page reports a terminal failure without altering its gate or requesting media',()=>{
 const script=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/wco-source.js',import.meta.url),'utf8'),messages=[];
 vm.runInNewContext(script,{location:{hostname:'embed.wcostream.com',pathname:'/inc/embed/full-capacity.html'},window:{},FlixerWcoResult:{postMessage:m=>messages.push(JSON.parse(m))}});
 assert.deepEqual(messages,[{error:'WCO_CAPACITY'}]);
});

test('WCO failures try another source, keep the reason when exhausted and ignore cancelled requests',async()=>{
 const player=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
 const loadCode=player.slice(player.indexOf('    function load('),player.indexOf('\n    async function loadHls('));
 const failoverCode=player.slice(player.indexOf('    function failover('),player.indexOf('\n    function resetHgSources('));
 for(const mode of ['alternative','exhausted','cancelled','destroyed']){
  let reject,failed=0;const pending=new Promise((_,r)=>reject=r),played=[];
  const servers=[{provider:'wco',type:'wco',id:'wco',name:'WCO',embedUrl:origin+'/episode'},...(mode==='alternative'?[{provider:'other',id:'other',name:'Other',type:'mp4',streamUrl:'https://media.example/video.mp4'}]:[])];
  const st={generation:0,destroyed:false,attempted:new Set(),sourceErrors:new Map(),idx:0},notice={hidden:true};
  const context=vm.createContext({st,servers,notice,root:{},$:()=>({}),renderBar:()=>{},teardownMedia:()=>st.generation++,showNotice:()=>notice.hidden=false,showError:()=>failed++,openDirectPlayer:s=>played.push(s.id),clearTimeout:()=>{},setTimeout:fn=>{fn();return 1},window:{FlixerBrowser:{hasNativeVideo:()=>true,hasNativePlayer:()=>true},FlixerWcoSource:{supports:()=>true,resolve:()=>pending,failureMessage:()=> 'WCO is at capacity'}}});
  vm.runInContext(loadCode+failoverCode+';globalThis.start=load;',context);context.start(0);
  if(mode==='cancelled')st.generation++;if(mode==='destroyed')st.destroyed=true;
  reject(Object.assign(Error('capacity'),{code:'WCO_CAPACITY'}));await new Promise(r=>setImmediate(r));
  assert.deepEqual(played,mode==='alternative'?['other']:[]);assert.equal(failed,mode==='exhausted'?1:0);
  assert.equal(st.sourceErrors.has('wco'),['alternative','exhausted'].includes(mode));
 }
});

test('the final player error stops the resolving notice and escapes provider failure text',()=>{
 const player=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8'),start=player.indexOf('    function showError('),end=player.indexOf('\n    /* Fullscreen:',start);
 const st={sourceErrors:new Map([['wco','WCO at capacity <unsafe>']])},stage={innerHTML:''},notice={hidden:false};
 const context=vm.createContext({st,stage,notice,opts:{},servers:[],teardownMedia:()=>{},clearTimeout:()=>{},esc:s=>s.replace(/</g,'&lt;').replace(/>/g,'&gt;'),$:()=>null});
 vm.runInContext(player.slice(start,end)+';showError();',context);
 assert.equal(notice.hidden,true);assert.match(stage.innerHTML,/WCO at capacity &lt;unsafe&gt;/);assert.ok(!stage.innerHTML.includes('<unsafe>'));
});
test('WCO public configuration keeps published qualities and the same honest User-Agent',async()=>{
 let calls=0;const wco=client(async()=>{calls++;return {configuration:{server:'https://neptun.wcostream.com',hd:'actual-hd',enc:'actual-sd',fhd:'actual-fhd'}};});
 const source={provider:'wco',type:'wco',id:'wco:public',embedUrl:origin+'/example-season-1-episode-1',audioModes:['sub']};const rows=await wco.resolve(source);
 assert.equal(rows.length,3);assert.deepEqual(Array.from(rows,r=>r.id),['wco:public:hd','wco:public:enc','wco:public:fhd']);assert.equal(rows[0].headers['User-Agent'],'Flixer (Android)');assert.equal(rows[0].type,'mp4');assert.equal(rows[0].sourceEmbedUrl,source.embedUrl);assert.equal(rows[0].audioModes,source.audioModes);
 assert.ok(fs.readFileSync(new URL('../../mobile/android/app/src/main/java/app/flixer/stream/WcoSourcePlugin.java',import.meta.url),'utf8').includes('USER_AGENT="'+rows[0].headers['User-Agent']+'"'));
 assert.equal(wco.configuration({server:'https://cdn.wcostream.com',enc:'actual-sd'}).length,1,'the published legacy anime CDN is supported');
 assert.equal(wco.configuration({server:'https://ndisk.wcostream.com',enc:'actual-sub'}).length,1,'the published subbed-anime server is supported');
 assert.equal(wco.configuration({server:'https://lb.wcostream.com',enc:'actual-sd'}).length,1,'the published load balancer is supported without inventing another host');
 const captioned=wco.configuration({server:'https://ndisk.wcostream.com',enc:'actual-video',sub:'actual-captions'});assert.equal(captioned[0].subtitles[0].mimeType,'text/vtt');assert.equal(new URL(captioned[0].subtitles[0].url).searchParams.get('evid'),'actual-captions');
 await wco.resolve(source);assert.equal(calls,1);wco.clearCache();await wco.resolve(source);assert.equal(calls,2);
});
test('WCO configuration never turns source-provided arbitrary URLs into native requests',async()=>{
 let calls=0;const wco=client(async()=>{calls++;return {configuration:{server:'http://127.0.0.1',enc:'x'}};});
 for(const server of ['https://evil.test','http://neptun.wcostream.com','https://user@neptun.wcostream.com','https://neptun.wcostream.com:444','https://neptun.wcostream.com/path','https://lb.wcostream.com.attacker.test'])assert.equal(wco.configuration({server,enc:'x'}).length,0);
 assert.equal(wco.configuration({server:'https://neptun.wcostream.com',enc:'a\r\nb'}).length,0);
 assert.equal((await wco.resolve({provider:'wco',type:'wco',embedUrl:'https://evil.test/episode'})).length,0);assert.equal(calls,0);
 const source={provider:'wco',type:'wco',id:'x',embedUrl:origin+'/episode'};assert.equal((await wco.resolve(source)).length,0);assert.equal((await wco.resolve(source)).length,0);assert.equal(calls,2,'denials are not cached as a playable result');
});
test('the device observer leaves requests and the publisher countdown unchanged',()=>{
 const script=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/wco-source.js',import.meta.url),'utf8'),messages=[],calls=[];let tick,clicked=0;
 class XHR{open(...args){calls.push(args)}addEventListener(name,fn){if(name==='load')this.loaded=fn}}
 const close={disabled:true,innerText:'Close',click:()=>clicked++};
 const context={location:{hostname:'embed.wcostream.com',origin:'https://embed.wcostream.com',href:'https://embed.wcostream.com/inc/embed/index.php'},window:{addEventListener:()=>{}},document:{querySelector:()=>close},XMLHttpRequest:XHR,URL,FlixerWcoResult:{postMessage:m=>messages.push(JSON.parse(m))},setInterval:fn=>{tick=fn;return 1},clearInterval:()=>{}};
 vm.runInNewContext(script,context);tick();assert.equal(clicked,0);assert.equal(close.disabled,true);close.disabled=false;tick();assert.equal(clicked,1);
 const xhr=new XHR();xhr.open('GET','/inc/embed/getvidlink.php?v=public',true);xhr.status=200;xhr.responseText=JSON.stringify({server:'https://neptun.wcostream.com',enc:'actual'});xhr.loaded();
 assert.deepEqual(calls[0],['GET','/inc/embed/getvidlink.php?v=public',true]);assert.equal(messages[0].configuration.enc,'actual');
 const other=new XHR();other.open('GET','https://evil.test/inc/embed/getvidlink.php');assert.equal(other.loaded,undefined);
});

function playbackApi(getJson){
 const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=source.indexOf('    async stream('),end=source.indexOf('\n  }',start);
 const context=vm.createContext({window:{Capacitor:{Plugins:{WcoSource:{}}},FlixerBrowser:{hasNativeVideo:()=>true}},URL,URLSearchParams,DOMException,console,getJson,API_BASE:'https://backend.example',embedSandbox:()=>null});
 vm.runInContext('globalThis.api={'+source.slice(start,end)+'};',context);return context.api;
}
test('native WCO starts without waiting for hosted metadata and preserves merged provider choices',async()=>{
 let finish,calls=0,additional;const pending=new Promise(resolve=>finish=resolve),api=playbackApi(()=>{calls++;return pending;});
 const epId='sp:wco:e:example:example-episode-1-english-subbed',show={id,episodes:[{id:epId,offerings:[{provider:'wco'},{provider:'animegg'}]}]};
 const initial=await api.stream(epId,null,show,{onSources:rows=>additional=rows});assert.equal(initial.servers[0].type,'wco');assert.equal(initial.servers[0].audioMode,'sub');assert.equal(calls,1);assert.equal(additional,undefined);
 finish({body:{servers:[{provider:'wco',type:'wco',embedUrl:origin+'/example-episode-1-english-subbed'},{id:'other',provider:'animegg',type:'embed',embedUrl:'https://www.animegg.org/embed/1'}]}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(additional.length,1);assert.equal(additional[0].provider,'animegg');
});
test('solo WCO playback avoids backend work and aborted requests cannot append old choices',async()=>{
 let calls=0;const api=playbackApi(async()=>{calls++;throw Error('Backend unavailable')});const epId='sp:wco:e:example:example-episode-1';
 const first=await api.stream(epId,null,{});assert.equal(first.servers.length,1);assert.equal(calls,0);
 const controller=new AbortController();controller.abort();await assert.rejects(api.stream(epId,null,{},{signal:controller.signal}),{name:'AbortError'});
 let finish,appended=false;const background=playbackApi(()=>new Promise(resolve=>finish=resolve)),signal=new AbortController();
 await background.stream(epId,null,{episodes:[{id:epId,offerings:[{provider:'animegg'}]}]},{signal:signal.signal,onSources:()=>appended=true});signal.abort();finish({body:{servers:[{provider:'animegg',type:'embed',embedUrl:'https://www.animegg.org/embed/1'}]}});await new Promise(resolve=>setImmediate(resolve));assert.equal(appended,false);
});

test('live provider search starts before a cold full index and retains late saved matches',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=source.indexOf('    async search(q,'),end=source.indexOf('    /* ----- Playback sources',start);
 let release,requests=0;const index=new Promise(resolve=>release=resolve),rows=[],events=[];
 const context=vm.createContext({window:{Capacitor:{Plugins:{WcoSource:{}}},FlixerWcoSource:{search:async()=>{requests++;return [{id:'new',title:'Example new',altTitles:[]}]}}},API_BASE:'https://backend.example',normalize:x=>x,byWeight:()=>0,URLSearchParams,Set,Map,Promise});
 vm.runInContext('globalThis.api={'+source.slice(start,end)+'};',context);
 const api=context.api;Object.assign(api,{liveEnabled:true,_indexReady:index,_searchProviders:Promise.resolve(['wco']),_byId:new Map(),catalog:async()=>{},all:async()=>rows,_groupSearchItems:ids=>[...ids].map(id=>api._byId.get(id)).filter(Boolean),_reindex:()=>{},_merge:incoming=>incoming.forEach(r=>api._byId.set(r.id,r))});
 const pending=api.search('example',{onLocal:r=>events.push(r)});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests,1);assert.ok(events.some(r=>r.items.some(i=>i.id==='new')),'native results render while the full index is pending');
 const old={id:'saved',title:'Example saved',altTitles:[]};rows.push(old);api._byId.set(old.id,old);release();const result=await pending;
 assert.deepEqual(Array.from(result.items,i=>i.id).sort(),['new','saved']);assert.equal(result.pending,0);
});

test('native WCO search retries an empty query with an alias and retains edition names',async()=>{
 const calls=[];
 const anchor={textContent:'Example Show English Dubbed',getAttribute:()=>origin+'/anime/example?lang=dub',closest:()=>null},unrelated={textContent:'Another Show',getAttribute:()=>origin+'/anime/another-show',closest:()=>null};
 const context=vm.createContext({window:{Capacitor:{Plugins:{WcoSource:{search:async({query})=>{calls.push(query);return {html:query==='Example Show'?'match':'empty'};}}}}},URL,DOMParser:class{parseFromString(html){return {querySelectorAll:()=>html==='match'?[anchor,unrelated]:[]};}}});
 vm.runInContext(helper,context);
 const rows=await context.window.FlixerWcoSource.search('An alternate name',{aliases:['Example Show','Unused']});
 assert.deepEqual(calls,['An alternate name','Example Show']);assert.equal(rows.length,1);
 assert.equal(rows[0].title,'Example Show English Dubbed');assert.deepEqual(Array.from(rows[0].altTitles),['Example Show']);assert.deepEqual(Array.from(rows[0].audioModes),['dub']);
 await context.window.FlixerWcoSource.search('Cancelled',{signal:{aborted:true}});assert.equal(calls.length,2);
});
test('native details skip hosted snapshots and bound retries after empty guides or denial',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8'),start=source.indexOf('    async details(_type,'),end=source.indexOf('    async _build(',start);
 for(const denied of [false,true]){
  let native=0,hosted=0;const row={id,kind:'series',title:'Example',episodes:[]},map=new Map([[id,row]]);
  const context=vm.createContext({window:{Capacitor:{Plugins:{WcoSource:{}}},dispatchEvent:()=>{}},store:{get:()=>null,set:()=>{}},normalize:()=>({poster:'https://images.wcostream.com/catimg/example.jpg'}),live:{details:async()=>{native++;if(denied)throw Error('WCO denied');return row;}},getJson:async()=>{hosted++;throw Error('Unused hosted snapshot');},console:{warn:()=>{}},CustomEvent:class{},setTimeout,Date,Map,Promise});
  vm.runInContext('globalThis.api={'+source.slice(start,end)+'};',context);const api=context.api;
  Object.assign(api,{_byId:map,_details:new Map(),_catalog:{},liveEnabled:true,show:async()=>row,_merge:()=>{},_reindex:()=>{},_build:r=>r});
  await api.details('tv',id);await api.details('tv',id);assert.equal(native,1);assert.equal(hosted,0);
 }
});

const guide=(...entries)=>`<link rel="canonical" href="${origin}/anime/example"><div class="vsbaslik"><h2>Example</h2></div><div id="episodeList">${entries.join('')}</div>`;
const plainOne=ep('example-episode-1-tourist','Episode 1 Tourist','cartoon'),plainTwenty=ep('example-episode-20-rises','Episode 20 Rises','cartoon'),shorts=ep('example-shorts-episode-1-candy','Shorts Episode 1 Candy','cartoon');
const seasonTwo=ep('example-season-2-episode-1-scary','Season 2 Episode 1 Scary','cartoon'),seasonTwoSpecial=ep('example-season-2-special-pines','Season 2 Special: Pines','cartoon');
test('WCO plain "Episode N" entries become season 1 only when later seasons are labelled and no explicit season 1 exists',()=>{
 const single=parseWcoDetails(id,guide(plainOne,plainTwenty,shorts));
 assert.ok(single.episodes.every(e=>e.season===null),'one unlabelled list is not an invented season');assert.equal(single.episodes[0].absoluteNumber,1);
 const later=parseWcoDetails(id,guide(shorts,seasonTwoSpecial,plainTwenty,seasonTwo,plainOne)),by=Object.fromEntries(later.episodes.map(e=>[e.id.split(':').pop(),e]));
 assert.equal(by['example-episode-1-tourist'].season,1);assert.equal(by['example-episode-1-tourist'].number,1);assert.equal(by['example-episode-1-tourist'].absoluteNumber,null);
 assert.equal(by['example-episode-20-rises'].season,1);assert.equal(by['example-episode-20-rises'].number,20);
 assert.equal(by['example-shorts-episode-1-candy'].season,null,'shorts keep source numbering');assert.equal(by['example-shorts-episode-1-candy'].absoluteNumber,1);
 assert.equal(by['example-season-2-episode-1-scary'].season,2);assert.equal(by['example-season-2-special-pines'].season,2);assert.equal(by['example-season-2-special-pines'].number,null);
 assert.deepEqual(later.episodes.map(e=>e.id.split(':').pop()),['example-episode-1-tourist','example-episode-20-rises','example-season-2-episode-1-scary','example-season-2-special-pines','example-shorts-episode-1-candy'],'season 1 sorts before season 2 and unnumbered groups');
 const explicit=parseWcoDetails(id,guide(ep('example-season-1-episode-1-start','Season 1 Episode 1 Start','cartoon'),ep('example-episode-5-extra','Episode 5 Extra','cartoon'),seasonTwo));
 assert.equal(explicit.episodes.find(e=>e.id.endsWith('example-episode-5-extra')).season,null,'an explicit season 1 keeps plain entries unnumbered');
 const other=parseWcoDetails(id,guide(ep('another-show-episode-1-x','Episode 1 X','cartoon'),seasonTwo));
 assert.equal(other.episodes.find(e=>e.id.endsWith('another-show-episode-1-x')).season,null,'entries outside the series slug are not relabelled');
});
test('the device guide parser applies the same first-season rule as the hosted adapter',()=>{
 const start=helper.indexOf(' function inferFirstSeason('),end=helper.indexOf(' async function details(');assert.ok(start>0&&end>start);
 const context=vm.createContext({});vm.runInContext(helper.slice(start,end)+';globalThis.infer=inferFirstSeason;',context);
 const rows=()=>[{id:'sp:wco:e:example:example-episode-1-tourist',title:'Episode 1 Tourist',season:null,number:1,absoluteNumber:1},{id:'sp:wco:e:example:example-shorts-episode-1-candy',title:'Shorts Episode 1 Candy',season:null,number:1,absoluteNumber:1},{id:'sp:wco:e:example:example-season-2-episode-1-scary',title:'Season 2 Episode 1 Scary',season:2,number:1,absoluteNumber:null}];
 const later=rows();context.infer(later,'example');assert.deepEqual(later.map(e=>e.season),[1,null,2]);assert.equal(later[0].absoluteNumber,null);assert.equal(later[1].absoluteNumber,1);
 const single=rows().slice(0,2);context.infer(single,'example');assert.deepEqual(single.map(e=>e.season),[null,null]);
 const explicit=[...rows(),{id:'sp:wco:e:example:example-season-1-episode-2-y',title:'Season 1 Episode 2 Y',season:1,number:2,absoluteNumber:null}];context.infer(explicit,'example');assert.equal(explicit[0].season,null);
});
