import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFrembedId,frembedIdFromUrl,parseFrembedList,parseFrembedDetails,frembedUrl} from '../src/frembed.js';
import {parseDessinNetId,dessinNetIdFromUrl,parseDessinNetList,parseDessinNetDetails,parseDessinNetPlayers} from '../src/dessinanimenet.js';
import {specialistJobs,parseSpecialistId,specialistIdFromUrl} from '../src/specialist-providers.js';
import {mergeLibrary} from '../src/merge-library.js';
import {mergeDessinPlayback,getDessinDetails} from '../src/dessinanime.js';
import {frembedOfferingFor,parseFrembedRoutes,frembedHostServer,selectFrembedRoutes} from '../src/frembed.js';
import {unifiedStream} from '../src/library-service.js';

const seriesId='sp:frembed:s:246';
const episode=(epi=1,version='VF')=>({title:'Avatar: The Last Airbender',tmdb:'246',sa:1,epi,version,link:`https://frembed.uno/embed/serie/246?sa=1&epi=${epi}`});
const api=items=>({status:200,result:{items}});
test('Frembed free server links bind to the requested title, episode, language and source server ID',()=>{
  const link={id:21687,lang:'vf',label:'Uqload',host:{slug:'uqload'},url:'/api/stream?type=serie&tmdb=246&sa=1&epi=1&server=id:21687'};
  const data={tmdb:'246',sa:1,epi:1,links:[link]},id='sp:frembed:e:246:1:1';
  const routes=parseFrembedRoutes(id,data);assert.equal(routes.length,1);
  const host=frembedHostServer(routes[0],'https://uqload.vc/embed-u330rs2rktmh.html');assert.equal(host.name,'Frembed · VF · Uqload');assert.deepEqual(host.audioLanguages,['fr']);assert.equal(host.type,'embed');
  assert.throws(()=>parseFrembedRoutes('sp:frembed:e:246:1:2',data),/identity/);
  for(const change of [{premium:true},{url:link.url.replace('epi=1','epi=2')},{url:link.url+'&tmdb=999'},{url:link.url.replace('id:21687','id:1')},{url:'https://evil.org'+link.url}])assert.deepEqual(parseFrembedRoutes(id,{...data,links:[{...link,...change}]}),[]);
  for(const location of ['https://uqload.vc.evil.org/embed-x.html','https://127.0.0.1/e/private','https://user@uqload.vc/embed-x.html','https://uqload.vc/account'])assert.equal(frembedHostServer(routes[0],location),null);
  const dubbed=frembedHostServer({...routes[0],language:'vostfr'},host.embedUrl);assert.equal(dubbed.audioLanguages,undefined);assert.deepEqual(dubbed.subtitleLanguages,['fr']);
});

test('Frembed retains explicitly published legacy Netu choices with exact episode and language identity',()=>{
  const id='sp:frembed:e:246:1:1',url='/api/stream?type=serie&tmdb=246&sa=1&epi=1&server=link2',data={tmdb:'246',sa:1,epi:1,links:[],link2:url};
  const routes=parseFrembedRoutes(id,data);assert.equal(routes.length,1);assert.equal(routes[0].host,'netu');assert.equal(routes[0].language,'vf');
  const player=frembedHostServer(routes[0],'https://netu.frembed.bond/e/GjvwOiHOfeKj');assert.equal(player.type,'embed');assert.deepEqual(player.audioLanguages,['fr']);
  const subtitled=parseFrembedRoutes(id,{...data,link2:null,link2vostfr:url.replace('server=link2','server=link2vostfr')});assert.equal(subtitled[0].language,'vostfr');assert.deepEqual(frembedHostServer(subtitled[0],player.embedUrl).subtitleLanguages,['fr']);
  for(const change of [{link2:null},{premium:true},{vip:true},{requiresAuth:true},{link2:url.replace('epi=1','epi=2')},{link2:url+'&tmdb=999'},{link2:url.replace('server=link2','server=link1')},{link2:'https://evil.org'+url}])assert.deepEqual(parseFrembedRoutes(id,{...data,...change}),[]);
  for(const destination of ['https://netu.frembed.bond.evil.org/e/GjvwOiHOfeKj','https://netu.frembed.bond/account','https://user@netu.frembed.bond/e/GjvwOiHOfeKj','https://netu.frembed.bond/e/GjvwOiHOfeKj?url=elsewhere','https://netu.frembed.bond/e/GjvwOiHOfeKj#other','https://playmogo.com/e/GjvwOiHOfeKj'])assert.equal(frembedHostServer(routes[0],destination),null);
});

test('a full Frembed modern list cannot crowd out the advertised Netu language alternatives',()=>{
  const modern=Array.from({length:14},(_,i)=>({id:String(i),host:'voe',language:'vf'})),netu=['vf','vostfr','vo'].map(language=>({id:'netu:'+language,host:'netu',language}));
  const selected=selectFrembedRoutes([...modern,...netu,{id:'duplicate-netu',host:'netu',language:'vf'}]);
  assert.equal(selected.length,11);assert.deepEqual(selected.slice(-3),netu);assert.deepEqual(selected.slice(0,8),modern.slice(0,8));
});
test('verified French titles discover missing Frembed offerings without inventing episode coordinates',async()=>{
  const show={id:'sp:dessinanime:s:246-avatar',kind:'series',title:'Avatar',tmdbId:246,collections:['french'],offerings:[{provider:'dessinanime',id:'sp:dessinanime:s:246-avatar'}],episodes:[{id:'sp:dessinanime:e:246-avatar:2:3',season:2,number:3,offerings:[{provider:'dessinanime',id:'sp:dessinanime:e:246-avatar:2:3'}]}]};
  const requests=[],resolveSpecialist=async id=>{requests.push(id);return id==='sp:frembed:e:246:2:3'?[{id:'verified',provider:'frembed',type:'embed',embedUrl:frembedUrl(id)}]:[];};
  const args={product:'flixer',catalog:{shows:[show]},showId:show.id,resolveTitle:async()=>show,resolveSpecialist};
  const result=await unifiedStream(show.episodes[0].id,args);assert.ok(result.servers.some(s=>s.provider==='frembed'));assert.equal(requests.filter(id=>id==='sp:frembed:e:246:2:3').length,1);assert.equal(show.episodes[0].offerings.length,1);
  requests.length=0;await unifiedStream(show.episodes[0].id,{...args,quick:true});assert.equal(requests.includes('sp:frembed:e:246:2:3'),false);
  const unavailable=await unifiedStream(show.episodes[0].id,{...args,resolveSpecialist:async()=>[]});assert.equal(unavailable.servers.some(s=>s.provider==='frembed'),false);
  assert.equal(frembedOfferingFor({...show,tmdbId:null},show.episodes[0]),null);assert.equal(frembedOfferingFor(show,{number:3}),null);assert.equal(frembedOfferingFor(show,{season:1,number:0}),null);assert.equal(frembedOfferingFor({...show,collections:[],offerings:[]},show.episodes[0]),null);
});
test('hosted DessinAnime search denial cannot prevent a verified alternative for an existing source title',async()=>{
  const id='sp:dessinanime:m:309809-le-petit-prince',requests=[];
  const saved={id,title:'Le Petit Prince',year:2015,kind:'film',episodes:[],access:'catalogue-only',offerings:[{provider:'dessinanime',id,availability:'catalogue-only'}]};
  const alternative=parseFrembedDetails('sp:frembed:m:309809',api([{tmdb:'309809',title:'The Little Prince',year:'2015',version:'French',link:frembedUrl('sp:frembed:m:309809')}]));
  const result=await getDessinDetails(id,{readSnapshot:async()=>saved,readPage:async url=>{requests.push(url);throw Error('DessinAnime HTTP 403');},resolveAlternative:async requested=>{assert.equal(requested,'sp:frembed:m:309809');return alternative;}});
  assert.equal(requests.length,1);assert.equal(result.access,'public');assert.equal(result.episodes[0].offerings[0].provider,'frembed');assert.equal(saved.episodes.length,0);
});
test('Frembed rejects absent titles, wrong identity, forged players and invalid episode coordinates',()=>{
  assert.equal(parseFrembedDetails(seriesId,api([])),null);
  for(const source of [{...episode(),tmdb:'456'},{...episode(),link:'https://evil.org/player'},{...episode(),epi:2},{...episode(),sa:null}])assert.throws(()=>parseFrembedDetails(seriesId,api([source])));
  assert.throws(()=>parseFrembedDetails(seriesId,{}),/format/);
  assert.equal(parseFrembedId('sp:frembed:s:246:1:1'),null);
  assert.equal(parseFrembedId('sp:frembed:e:246'),null);
  assert.equal(frembedIdFromUrl('https://frembed.uno.evil.org/tv-show/avatar/246'),null);
});
test('French episode additions merge into the correct existing season without duplicate titles',()=>{
  const base={shows:[{id:'existing',title:'Avatar',kind:'series',tmdbId:246,episodes:[{id:'old',title:'First',season:1,number:1}]}]};
  const incoming=parseFrembedDetails(seriesId,api([episode(1),episode(3,'VOSTFR')]));
  const result=mergeLibrary(base,[incoming],{product:'flixer'}).catalog;
  assert.equal(result.shows.length,1);assert.deepEqual(result.shows[0].episodes.map(e=>e.number),[1,3]);
  assert.equal(result.shows[0].episodes[0].offerings.some(o=>o.provider==='frembed'),true);
  assert.deepEqual(incoming.episodes[0].audioLanguages,['fr']);assert.deepEqual(incoming.episodes[1].subtitleLanguages,['fr']);assert.equal(incoming.episodes[1].audioLanguages,undefined);
  assert.equal(mergeLibrary(base,[{...incoming,tmdbId:999,id:'different'}],{product:'dahsha'}).report.added,0);
});
test('Frembed cartoon pages preserve pagination, French titles, artwork and source update coordinates',()=>{
  const html='<a href="/tv-show/avatar/246"><img src="https://image.tmdb.org/t/p/w342/poster.jpg" alt="Avatar"><span>S3 · E21</span><h3>Avatar, le dernier maître de l’air</h3><div>2005</div></a><a href="/tv-show?genre=animation&page=6">6</a>';
  const page=parseFrembedList(html);assert.equal(page.totalPages,6);assert.equal(page.hasNext,true);assert.equal(page.items[0].tmdbId,246);assert.equal(page.items[0].year,2005);assert.equal(page.items[0].latestEpisode,'sp:frembed:e:246:3:21');assert.deepEqual(page.items[0].tags,['animation']);
  assert.deepEqual(parseFrembedList(html,{search:true}).items[0].tags,[]);
});
test('Le Petit Prince alternative remains labelled Frembed and requires matching year and media kind',()=>{
  const row={id:'sp:dessinanime:m:309809-le-petit-prince',title:'Le Petit Prince',kind:'film',year:2015,access:'catalogue-only',episodes:[],offerings:[{provider:'dessinanime',id:'sp:dessinanime:m:309809-le-petit-prince',availability:'catalogue-only'}]};
  const candidate=parseFrembedDetails('sp:frembed:m:309809',api([{tmdb:'309809',title:'The Little Prince',year:'2015',version:'French',link:frembedUrl('sp:frembed:m:309809')}]));
  const merged=mergeDessinPlayback(row,candidate);assert.equal(merged.access,'public');assert.equal(merged.id,row.id);assert.equal(merged.episodes[0].offerings[0].provider,'frembed');assert.deepEqual(merged.audioLanguages,['fr']);
  assert.equal(mergeDessinPlayback(row,{...candidate,year:1974}),row);assert.equal(mergeDessinPlayback(row,{...candidate,kind:'series'}),row);
});
const token='uVulg8iYfFfCKiWUXtRs2XiN9ODooaBr',netId=`sp:dessinanimenet:s:${token}`;
test('DessinAnime.net keeps real source coordinates and ignores another title’s guide',()=>{
  const html=`<link rel="canonical" href="https://dessinanime.net/show/${token}"><div><h1>Ben 10: Alien Force</h1><font>Ben 10</font><div><font>Actor Name</font></div></div><div class="video-attr"><div class="text-content">Source synopsis.</div></div><a href="/episode/${token}/season-2-episode-7"><div class="name">French episode</div></a><a href="/episode/AnotherSourceTitle123/season-1-episode-1"><div class="name">Wrong title</div></a>`;
  const parsed=parseDessinNetDetails(netId,html);assert.equal(parsed.episodes.length,1);assert.equal(parsed.episodes[0].number,7);assert.equal(parsed.episodes[0].season,2);assert.equal(parsed.synopsis,'Source synopsis.');assert.deepEqual(parsed.altTitles,['Ben 10']);
  assert.equal(dessinNetIdFromUrl('https://evil.org/show/'+token),null);assert.equal(parseDessinNetId(netId+':2:7'),null);
  assert.throws(()=>parseDessinNetDetails(netId,html.replace('/show/'+token,'/show/AnotherSourceTitle123')),/identity/);
});
test('DessinAnime.net broken search slugs require unique source title plus matching poster',()=>{
  const html='<div class="list-movie"><a class="list-title" href="/show/ben-10-alien-force-2008">Ben 10: Alien Force</a><div style="background-image:url(https://image.tmdb.org/t/p/w780/pGhCUqPaXZ0Xp4dUCT7Q6hjJArf.jpg)"></div></div>';
  assert.equal(parseDessinNetList(html,{search:true}).items[0].id,netId);
  assert.equal(parseDessinNetList(html.replace('pGhCUqPaXZ0Xp4dUCT7Q6hjJArf','wrongPoster'),{search:true}).items.length,0);
  assert.deepEqual(parseDessinNetList('<main>0 résultat trouvé</main>',{search:true}).items,[]);
  assert.throws(()=>parseDessinNetList('<title>Just a moment</title>'),/format/);
});
test('DessinAnime.net retains the actual public frames without inventing legacy HLS routes',()=>{
  const parsed=parseDessinNetPlayers('<iframe src="https://lecteur1.xtremestream.co/player/index.php?data=Abc123"></iframe><iframe src="https://emmmmbed.com/embed/21laX8xe"></iframe><iframe src="https://lecteur1.xtremestream.co.evil.org/player/index.php?data=abc"></iframe><iframe src="https://127.0.0.1/private"></iframe>');
  assert.equal(parsed.length,2);assert.equal(parsed[0].type,'embed');assert.equal(parsed[0].embedUrl,'https://lecteur1.xtremestream.co/player/index.php?data=Abc123');assert.equal(parsed[0].headers.Referer,'https://dessinanime.net/');assert.equal(parsed[1].embedUrl,'https://emmmmbed.com/embed/21laX8xe');assert.ok(parsed.every(server=>!server.streamUrl));
});
test('the current Xtremestream.xyz player keeps its public source context and strict native route shape',()=>{
  const servers=parseDessinNetPlayers('<iframe src="https://lecteur1.xtremestream.xyz/player/index.php?data=0e01938fc48a2cfb5f2217fbfb00722d"></iframe>');
  assert.equal(servers.length,1);assert.equal(servers[0].type,'embed');assert.equal(servers[0].embedUrl,'https://lecteur1.xtremestream.xyz/player/index.php?data=0e01938fc48a2cfb5f2217fbfb00722d');assert.equal(servers[0].headers.Referer,'https://dessinanime.net/');
  for(const bad of ['https://lecteur1.xtremestream.xyz.evil.org/player/index.php?data=abc','https://user@lecteur1.xtremestream.xyz/player/index.php?data=abc','https://lecteur1.xtremestream.xyz/player/private.php?data=abc','https://lecteur1.xtremestream.xyz/player/index.php?data=abc&url=elsewhere','https://lecteur1.xtremestream.xyz/player/index.php?data=abc#other','https://emmmmbed.com/embed/abc?url=elsewhere'])assert.deepEqual(parseDessinNetPlayers(`<iframe src="${bad}"></iframe>`),[]);
});
test('both French sources participate in the provider registry and cartoon refresh scopes',()=>{
  const jobs=specialistJobs({collection:'french-cartoons'});for(const provider of ['frembed','dessinanimenet'])assert.deepEqual(jobs.filter(j=>j.provider===provider).map(j=>j.kind),['film','series']);
  assert.equal(parseSpecialistId(netId).provider,'dessinanimenet');assert.equal(specialistIdFromUrl('https://frembed.uno/tv-show/avatar/246'),seriesId);assert.equal(specialistIdFromUrl('https://dessinanime.net/show/'+token),netId);
});
