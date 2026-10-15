import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArabicId,arabicId,arabicUrl,parseArabicList,parseArabicDetails,parseArabicServers,dataLiteral} from '../src/arabic-providers.js';
import {specialistUrl,specialistJobs} from '../src/specialist-providers.js';
import {unifiedTitle,discoverLibrary} from '../src/library-service.js';
import {mergeShow} from '../src/merge-library.js';

test('Arabic IDs reconstruct fixed origins and reject traversal, wrong episode types and arbitrary URLs',()=>{
  const id=arabicId('cimatn','s','https://www.cimatn.com/2026/02/show.html');
  assert.equal(arabicUrl(`${id.replace(':s:',':e:')}:3`),'https://www.cimatn.com/2026/02/show.html');
  assert.equal(specialistUrl('sp:kirmalk:m:4598592a4'),'https://kirmalk.com/watch.php?vid=4598592a4');
  assert.equal(arabicId('tuniflix','m','https://evil.test/movie/foo'),null);
  const unicode=arabicId('egydead','s','https://tv10.egydead.live/season/مسلسل-تونسي/');
  assert.equal(unicode,arabicId('egydead','s','https://tv10.egydead.live/season/'+encodeURIComponent('مسلسل-تونسي')+'/'));
  assert.ok(unicode.length<200);
  for(const id of ['sp:cinetimes:e:zohra','sp:ahwaktv:m:../admin','sp:tuniflix:e:foo:1','sp:cimatn:e:foo','sp:streamtunisie:s:'+Buffer.from('/../admin/').toString('base64url')])assert.equal(parseArabicId(id),null,id);
});
test('Tuniflix listings exclude sidebar recommendations and retain verified regional classification',()=>{
  const html='<div class="MovieList Rows AX"><div class="TPost B"><a href="/movie/the-needle"><span class="Year">2023</span><h2 class="Title">الإبرة</h2><img src="https://image.tmdb.org/t/p/w342/poster.jpg"></a></div></div><aside><div class="TPost B"><a href="/movie/foreign"><h2 class="Title">Foreign</h2></a></div></aside><a href="/tg/tunisian-movies/page/3">3</a>';
  const result=parseArabicList('tuniflix',html,'https://tuniflix.site/tg/tunisian-movies',{collection:'tunisian'});
  assert.equal(result.items.length,1);assert.equal(result.totalPages,3);assert.deepEqual(result.items[0].countries,['TN']);assert.equal(result.items[0].year,2023);
});
test('EgyDead imports season containers rather than individual episodes as shows',()=>{
  const html='<li class="movieItem"><a href="/season/example-2022/" title="مسلسل مثال 2022 كامل"></a></li><li class="movieItem"><a href="/episode/example-s01e02/" title="مسلسل مثال الحلقة 2"></a></li><a href="?page=6/">6</a>';
  const result=parseArabicList('egydead',html,'https://tv10.egydead.live/series-category/arabic-series/',{kind:'series'});
  assert.equal(result.items.length,1);assert.equal(parseArabicId(result.items[0].id).type,'s');assert.equal(result.totalPages,6);
  const id=result.items[0].id,detail=parseArabicDetails(id,'<meta property="og:title" content="مسلسل مثال 2022"><a href="/episode/example-s01e02/">الحلقة 2</a><a href="/episode/another-s01e99/">الحلقة 99</a>');
  assert.deepEqual(detail.episodes.map(e=>[e.season,e.number]),[[1,2]]);
});
test('Arabic player parsing selects actual players and excludes trailers, failed placeholders and adverts',()=>{
  const id=arabicId('streamtunisie','e','https://streamtunisie.net/show-episode-01/');
  const html='<video src="broken"></video><iframe src="https://ads.test"></iframe><script>switchHlsTvServer(document.querySelector(".tv-server-active"), "https://www.youtube.com/embed/abcdefghijk?rel=0&amp;autoplay=1");</script>';
  assert.deepEqual(parseArabicServers(id,html).map(s=>[s.type,s.videoId]),[['youtube','abcdefghijk']]);
  const film=arabicId('egydead','m','https://tv10.egydead.live/movie/');
  const servers=parseArabicServers(film,'<iframe src="https://www.youtube.com/embed/trailer0000"></iframe><ul class="serversList"><li data-link="https://hgcloud.to/e/real"></li><li data-link="https://user@hgcloud.to/e/bad"></li><li data-link="http://127.0.0.1"></li></ul>');
  assert.equal(servers.length,1);assert.equal(servers[0].embedUrl,'https://hgcloud.to/e/real');
});
test('CimaTN data literals retain sparse actual episode maps and reject executable expressions',()=>{
  const data=dataLiteral('const seriesData = { availableEpisodes: 4, episodes: {\n  1: [{ name: "A", url: "https://www.youtube.com/embed/abcdefghijk" }],\n  4: []\n} };','seriesData');
  assert.deepEqual(Object.keys(data.episodes),['1','4']);
  assert.equal(dataLiteral('const servers = [{url: process.exit()}];','servers'),null);
  assert.equal(dataLiteral('const servers = eval("[]");','servers'),null);
});
test('free Tunisian archive files use the source media host and preserve their actual format',()=>{
  const s=parseArabicServers('sp:cinetimes:m:zohra','<video><source src="https://upload.wikimedia.org/wikipedia/commons/transcoded/film.webm"></video><iframe src="https://evil.test"></iframe>');
  assert.equal(s.length,1);assert.equal(s[0].type,'file');assert.ok(s[0].streamUrl.endsWith('.webm'));
});
test('Ahwak episode search groups retain only exact title episodes and actual numbers',()=>{
  const query='خمسين خمسين',id='sp:ahwaktv:s:q_'+Buffer.from(query).toString('base64url');
  const html='<ul class="pm-ul-search-videos"><li><a href="https://yam.ahwaktv.net/watch.php?vid=ep3" title="مسلسل خمسين خمسين الحلقة 3 HD"></a></li><li><a href="https://yam.ahwaktv.net/watch.php?vid=other" title="مسلسل آخر الحلقة 99 HD"></a></li></ul>';
  const d=parseArabicDetails(id,html);assert.equal(d.title,query);assert.deepEqual(d.episodes.map(e=>[e.season,e.number]),[[null,3]]);
  assert.ok(arabicUrl(id).includes('search.php?keywords='));
});
test('Arabic collections route to relevant providers without widening Dahsha',async()=>{
  const jobs=specialistJobs({kind:'film',collection:'tunisian'});assert.ok(jobs.some(j=>j.provider==='cimatn'));assert.ok(jobs.some(j=>j.provider==='tuniflix'));
  assert.equal(await unifiedTitle('sp:tuniflix:m:the-needle',{product:'dahsha',catalog:{product:'dahsha',shows:[]}}),null);
  await assert.rejects(discoverLibrary({product:'dahsha',collection:'arabic',catalog:{shows:[]}}),/Invalid collection/);
});
test('source artwork and actual synopsis fill gaps without replacing existing metadata',()=>{
  const id='sp:tuniflix:m:the-needle';
  const fresh=parseArabicDetails(id,'<h1>الإبرة</h1><div class="TpRwCont"><div class="Objf"><img class="TPostBg" src="//image.tmdb.org/t/p/original/real.jpg"></div></div><meta name="description" content="Watch online"><div class="Description"><p>A source synopsis with enough narrative detail to describe this film.</p><p class="Cast">Cast should not enter the synopsis</p></div>');
  assert.equal(fresh.portrait,'https://image.tmdb.org/t/p/original/real.jpg');assert.equal(fresh.synopsis,'A source synopsis with enough narrative detail to describe this film.');
  const filled=mergeShow({id,title:'Existing',kind:'film',poster:{},synopsis:'',episodes:[]},fresh);assert.equal(filled.poster.custom,fresh.portrait);assert.equal(filled.synopsis,fresh.synopsis);
  const preserved=mergeShow({...filled,synopsis:'Existing synopsis',poster:{custom:'https://existing.test/poster.jpg'}},fresh);assert.equal(preserved.synopsis,'Existing synopsis');assert.equal(preserved.poster.custom,'https://existing.test/poster.jpg');
});
