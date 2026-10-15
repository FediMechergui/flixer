import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpecialistId, specialistUrl, specialistIdFromUrl, parseSpecialistDetails, parseSpecialistList, parseSpecialistServers, parseMultiMoviesDetails, parseMultiMoviesServers } from '../src/specialist-providers.js';
import { mergeLibrary, mergeShow } from '../src/merge-library.js';
import { unifiedStream, unifiedTitle, validPlaybackId } from '../src/library-service.js';
import { leanCatalog } from '../src/export-catalog.js';

// Reduced structural fixtures from public pages checked 2026-10-15. No executable
// upstream scripts, advertisements, public player tokens or full synopses retained.
const anime=`<div class="media-body"><h1>Dragon Ball Z</h1></div>
<div><a class="anm_det_pop" href="/dragonball-z-episode-1">Dragon Ball Z 1</a><i class="anititle">The New Threat</i><a href="/dragonball-z-episode-1#subbed">SUBBED</a><a href="/dragonball-z-episode-1#dubbed">DUBBED</a></div>
<div><a class="anm_det_pop" href="/dragonball-z-episode-3">Dragon Ball Z 3</a><a href="/dragonball-z-episode-3#subbed">SUBBED</a></div>`;
const animePlayers=`<ul id="videos"><li><a data-id="44073" data-version="subbed"></a></li><li><a data-id="44074" data-version="dubbed"></a></li><li><a data-id="https://evil.test" data-version="dubbed"></a></li></ul><iframe src="https://ads.test"></iframe>`;

test('specialist IDs authorize fixed origins and preserve real episode coordinates',()=>{
  assert.equal(specialistUrl('sp:multimovies:e:indian-game-show-172976:2:41'),'https://multimovies.garden/series/indian-game-show-172976/season/2/episode/41');
  assert.equal(specialistIdFromUrl('https://www.animegg.org/series/dragonball-z'),'sp:animegg:s:dragonball-z');
  assert.ok(validPlaybackId('sp:toontales:m:two-gun-mickey'));
  for(const id of ['sp:animegg:m:dragonball-z','sp:toontales:e:x','sp:animegg:e:../admin','sp:multimovies:e:show','sp:animegg:e:x:1:2','sp:multimovies:e:show:1:0','sp:animegg:e:x?url=http://localhost'])assert.equal(parseSpecialistId(id),null,id);
  assert.equal(specialistIdFromUrl('https://www.animegg.org.evil.test/series/dragonball-z'),null);
  assert.equal(specialistIdFromUrl('https://user@www.animegg.org/series/dragonball-z'),null);
});

test('anime imports explicit sub/dub evidence and never fills missing episodes or seasons',()=>{
  const result=parseSpecialistDetails('sp:animegg:s:dragonball-z',anime);
  assert.deepEqual(result.episodes.map(e=>[e.season,e.number]),[[null,1],[null,3]]);
  assert.deepEqual(result.audioModes,['sub','dub']);
  assert.deepEqual(result.episodes[1].audioModes,['sub']);
  const servers=parseSpecialistServers(result.episodes[0].id,animePlayers);
  assert.deepEqual(servers.map(s=>s.audioMode),['sub','dub']);
  assert.ok(servers.every(s=>s.embedUrl.startsWith('https://www.animegg.org/embed/')));
});

test('anime catalogue pagination uses the source offset and total, not an alphabet subsection',()=>{
  const html='<ul class="popanime cats"><li><div class="rightpop"><a href="/series/naruto">Naruto</a></div></li></ul><ul class="pagination"><li>26 - 50 of 11320 Shows</li></ul>';
  const result=parseSpecialistList('animegg',html,'https://www.animegg.org/popular-series?start=25&limit=25');
  assert.equal(result.page,2);assert.equal(result.totalPages,453);assert.equal(result.items[0].title,'Naruto');
  assert.throws(()=>parseSpecialistList('animegg','<html>Unexpected redesign</html>','https://www.animegg.org/series'),/format changed/);
});

test('classic cartoons expose only the actual direct media host and keep unknown numbering',()=>{
  const html=`<script type="application/ld+json">{"@type":"CollectionPage","url":"https://www.megacartoons.net/video-serie/courage-the-cowardly-dog/","name":"Courage the Cowardly Dog - MegaCartoons"}</script>
  <div class="video-listing-content"><div class="video-item"><div class="item-head"><h3><a href="https://www.megacartoons.net/little-muriel/" title="Little Muriel">Little Muriel</a></h3></div></div></div>
  <aside><a href="https://www.megacartoons.net/not-an-episode/"><img src="ad.jpg"></a></aside>`;
  const details=parseSpecialistDetails('sp:megacartoons:s:courage-the-cowardly-dog',html);
  assert.equal(details.episodes.length,1);assert.equal(details.episodes[0].season,null);assert.equal(details.episodes[0].number,null);
  const servers=parseSpecialistServers('sp:megacartoons:e:little-muriel',`<script>jwplayer("x").setup({file:"https://ww.megacartoons.net/cartoons/little-muriel.mp4"});</script><script>jwplayer("ad").setup({file:"https://evil.test/ad.mp4"});</script>`);
  assert.equal(servers.length,1);assert.equal(servers[0].type,'mp4');
});

test('Asian drama classification checks the title country and excludes advertisement frames',()=>{
  const html='<h1>Drama (2026) - Myasiantv</h1><p><strong>Country:</strong> Korean</p><p><strong>Release year:</strong> 2026</p><ul class="list-episode"><li><span>SUB</span><a href="/drama-2026-ep-8-eng-sub/">Drama (2026) Ep 8 Eng Sub</a></li></ul>';
  const result=parseSpecialistDetails('sp:myasiantv:s:drama-2026',html);
  assert.deepEqual(result.countries,['KR']);assert.equal(result.episodes[0].number,8);assert.equal(result.episodes[0].season,null);
  const servers=parseSpecialistServers(result.episodes[0].id,'<iframe title="ads" data-src="https://evil.test"></iframe><iframe id="b" title="video" data-src="https://zumivids.com/embed/drama-2026-ep-8.html"></iframe>');
  assert.equal(servers.length,1);assert.match(servers[0].embedUrl,/zumivids/);
  const film=parseSpecialistDetails('sp:myasiantv:s:the-moon-2023','<h1>The Moon (2023) - Myasiantv</h1><ul class="list-episode"><li><span>SUB</span><a href="/the-moon-2023-full-korean-movie/">The Moon (2023) Full Korean Movie</a></li></ul>');
  assert.equal(film.kind,'film');assert.equal(film.episodes.length,1);assert.equal(film.episodes[0].offerings[0].id,'sp:myasiantv:e:the-moon-2023-full-korean-movie');
});

test('Turkish player data is decoded as markup and validated without executing scripts',()=>{
  const key=[86,110,51,72,106,87,56,102];
  const encode=markup=>Buffer.from([...markup].map((c,i)=>((c.charCodeAt(0)^key[i%8])+5)%256).reverse()).toString('base64');
  const html=`<script>untrustedCode()</script><span data-s1="${encode('<iframe src="https://engifuosi.com/f/example.html"></iframe>')}"></span><span data-s2="${encode('<iframe src="https://evil.test"></iframe>')}"></span>`;
  const result=parseSpecialistServers('sp:yoturkish:e:kurulus-osman-episode-1',html);
  assert.equal(result.length,1);assert.equal(result[0].embedUrl,'https://engifuosi.com/f/example.html');
  assert.deepEqual(parseSpecialistServers('sp:yoturkish:e:kurulus-osman-episode-1','<span data-s1="broken-format"></span>'),[]);
  const details=parseSpecialistDetails('sp:yoturkish:s:kurulus-osman','<h1>Kurulus Osman</h1><div class="info">Country: Turkey Years: 2019</div><div id="episodes"><a class="episod" href="https://www1.yoturkish.com/kurulus-osman-episode-28/">Episode 28<span>Season 2</span></a><a class="episod" href="https://www1.yoturkish.com/another-show-episode-1/">Episode 1</a></div>');
  assert.equal(details.episodes.length,1);assert.equal(details.episodes[0].season,null);assert.equal(details.episodes[0].number,28);
});

const multiHtml=(season=2,episode=3)=>`<span class="cinejoy-meta-pill">2026</span><select class="cinejoy-season-select"><option value="2">Season 2</option></select>
<script>const watchItem = {"titleId":172976,"title":"Indian Game Show","type":"tv","url":"/series/indian-game-show-172976"};
const watchConfig = {"season":${season},"episode":${episode},"initialServers":[{"id":"a","name":"Vidrift","type":"iframe","url":"https://embed.vidrift.net/embed/tv/332744/2/3"},{"id":"ad","name":"Ad","type":"iframe","url":"https://evil.test"}]};
const seasonEpisodeNumbers = [1,3];</script>`;
test('MultiMovies keeps internal IDs separate and uses explicit sparse episode IDs',()=>{
  const result=parseMultiMoviesDetails('sp:multimovies:s:indian-game-show-172976',multiHtml());
  assert.equal(result.tmdbId,undefined);assert.equal(result.year,2026);
  assert.deepEqual(result.episodes.map(e=>[e.season,e.number]),[[2,1],[2,3]]);
  assert.equal(parseMultiMoviesServers('sp:multimovies:e:indian-game-show-172976:2:3',multiHtml()).length,1);
  assert.deepEqual(parseMultiMoviesServers('sp:multimovies:e:indian-game-show-172976:2:4',multiHtml()),[]);
  assert.throws(()=>parseMultiMoviesDetails('sp:multimovies:s:different-show',multiHtml()),/identity mismatch/);
});

test('new providers preserve canonical IDs and explicit language versions through merge and export',async()=>{
  const existing={id:'mf:m:cartoon',title:'Cartoon',kind:'film',year:1934,episodes:[{id:'mf:m:cartoon',number:1,season:1}],offerings:[{provider:'myflixer',id:'mf:m:cartoon'}]};
  const extra={id:'sp:toontales:m:cartoon',title:'Cartoon',kind:'film',year:1934,collections:['cartoons'],audioModes:['dub'],episodes:[{id:'sp:toontales:m:cartoon',number:1,season:1,offerings:[{provider:'toontales',id:'sp:toontales:m:cartoon'}]}],offerings:[{provider:'toontales',id:'sp:toontales:m:cartoon'}]};
  const {catalog}=mergeLibrary({shows:[existing]},[extra]);
  assert.equal(catalog.shows.length,1);assert.equal(catalog.shows[0].id,existing.id);
  const payload=leanCatalog(catalog,'flixer').shows[0];assert.deepEqual(payload.audioModes,['dub']);assert.deepEqual(payload.collections,['cartoons']);
  const result=await unifiedStream(existing.id,{product:'flixer',catalog,resolveMyflixer:async()=>({servers:[{id:'old',type:'embed',embedUrl:'https://old.test/player'}]}),resolveSpecialist:async()=>[{id:'new',provider:'toontales',type:'mp4',streamUrl:'https://ww.toontales.net/cartoon.mp4'}]});
  assert.equal(result.servers.length,2);
  assert.equal(await unifiedTitle(extra.id,{product:'dahsha',catalog:{product:'dahsha',shows:[]}}),null);
  const merged=mergeShow({id:'sp:animegg:s:show',kind:'series',title:'Show',episodes:[{id:'sp:animegg:e:show-episode-1',season:null,number:1,audioModes:['sub']}]},{id:'sp:animegg:s:show',kind:'series',title:'Show',episodes:[{id:'sp:animegg:e:show-episode-1',season:null,number:1,audioModes:['dub']}]});
  assert.deepEqual(merged.episodes[0].audioModes,['sub','dub']);
});
