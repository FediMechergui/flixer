import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFrenchList,parseFrenchSearch,parseFrenchDetails,parseFrenchServers,parseFrenchId,parseFrenchSeasons} from '../src/french-providers.js';
import {parseDessinCatalogue,verifiedDessinAlias,fetchDessinPage,mergeDessinPlayback} from '../src/dessinanime.js';
import {refreshSeriesEpisodes} from '../src/episode-refresh.js';
import {mergeLibrary,mergeShow} from '../src/merge-library.js';
import {unifiedSearch,SEARCH_PROVIDERS} from '../src/library-service.js';
import {matchesCollection} from '../../shared/collections.js';
import {matchesSearch} from '../../shared/search.js';
import {leanCatalog} from '../src/export-catalog.js';

const titleHtml=`<div id="serie-data" data-newsid="123" data-title="Une histoire - Saison 2" data-affiche="https://image.tmdb.org/t/p/w500/a.jpg"></div><span class="sd-tagz">s-77</span><ul id="s-list"><li><span>Titre Original:</span>A Story</li></ul><div class="flist"><li><span>Langue d'origine:</span>Anglais</li><li><span>Date de sortie:</span>2024</li><li><span>Genre:</span>Animation, Comédie</li></div><div id="s-desc">Actual plot<span class="desc-text">Marketing text</span></div>`;
const data={vf:{1:{vidzy:'https://vidzy.cc/embed-a.html'},2:{premium:'https://fsvid.lol/embed-b.html'},3:{vidzy:'https://vidzy.cc/embed-c.html'}},vostfr:{1:{voe:'https://kokoflix.lol/osaka_go.php?id=c'}},info:{1:{title:'Premier'},2:{title:'Future'},3:{title:'Third'}}};
test('French seasons use verified identities and actual sparse playable episodes, preserving VF and VOSTFR',()=>{
 const s=parseFrenchDetails('sp:frenchstream:s:123',titleHtml,data);
 assert.equal(s.title,'Une histoire');assert.deepEqual(s.altTitles,['A Story']);assert.equal(s.tmdbId,77);assert.equal(s.originalLanguage,'en');assert.equal(s.year,2024);assert.equal(s.synopsis,'Actual plot');
 assert.deepEqual(s.episodes.map(e=>[e.season,e.number]),[[2,1],[2,3]]);assert.equal(matchesCollection(s,'french-cartoons'),true);assert.equal(matchesCollection(s,'french-originals'),false);
 const players=parseFrenchServers(s.episodes[0].id,data);assert.equal(players.length,2);assert.deepEqual(players[0].audioLanguages,['fr']);assert.deepEqual(players[1].subtitleLanguages,['fr']);assert.equal(parseFrenchServers('sp:frenchstream:e:123:2:2',data).length,0);
 assert.throws(()=>parseFrenchDetails('sp:frenchstream:s:124',titleHtml,data),/identity/);assert.equal(parseFrenchId('sp:frenchstream:e:123:2:../1'),null);
 assert.equal(parseFrenchServers('sp:frenchstream:m:123',{players:{vidzy:{vf:'https://127.0.0.1/private',vo:'https://vidzy.cc.evil.org/embed'}}}).length,0);
});
test('French public playback excludes account-only player slots even on a free title',()=>{
 const result=parseFrenchServers('sp:frenchstream:m:123',{players:{premium:{default:'https://fsvid.lol/embed-paid.html'},vidzy:{vf:'https://vidzy.cc/embed-free.html'}}});
 assert.equal(result.length,1);assert.equal(result[0].embedUrl,'https://vidzy.cc/embed-free.html');
 assert.equal(parseFrenchServers('sp:frenchstream:e:123:2:2',data).length,0);
});
test('French catalogue pagination reads cstart and search parses public AJAX output without executing onclick',()=>{
 const r=parseFrenchList('<div class="short"><a class="short-poster" href="/index.php?newsid=123"><img src="https://image.tmdb.org/a.jpg"></a><div class="short-title">A Film</div></div><div class="pagi"><a href="/index.php?cstart=716&do=cat&category=films">716</a></div>');assert.equal(r.totalPages,716);assert.equal(r.hasNext,true);
 const found=parseFrenchSearch(`<div class="search-item" onclick="location.href='/123-une-histoire.html'"><div class="search-title">Une histoire - Saison 2</div></div><div class="search-item" onclick="location.href='https://evil.org/123-a.html'"><div class="search-title">Evil</div></div><button id="load-more">More</button>`);assert.equal(found.items.length,1);assert.equal(found.items[0].kind,'series');assert.equal(found.hasNext,true);
 assert.throws(()=>parseFrenchSearch('<html>Homepage unrelated</html>'),/format/);
});
test('DessinAnime stays catalogue-only until playback is verified, and aliases require matching identity, year and kind',async()=>{
 const [r]=parseDessinCatalogue([{id:14799,slug:'456-les-simpson',title:'Les Simpson',releaseYear:1989,mediaType:'TV',posterPath:'https://image.tmdb.org/t/p/w500/a.jpg'}]);
 assert.equal(r.access,'catalogue-only');assert.equal(r.episodes.length,0);assert.equal(r.tmdbId,undefined);assert.equal(verifiedDessinAlias(r,{tmdbId:456,kind:'series',year:1989}),true);
 for(const candidate of [{tmdbId:14799,kind:'series',year:1989},{tmdbId:456,kind:'film',year:1989},{tmdbId:456,kind:'series',year:2026}])assert.equal(verifiedDessinAlias(r,candidate),false);
 await assert.rejects(fetchDessinPage({page:2}),/cursor/);
 const lean=leanCatalog({shows:[r]},'flixer');assert.equal(lean.shows[0].access,'catalogue-only');
});
test('rotating episode refresh adds new seasons, retains partial older episodes and preserves blocked providers',async()=>{
 const episode=(id,season,number)=>({id,season,number,title:id});const old={id:'fm:s:77',title:'A Story',kind:'series',episodes:[episode('old',1,1)],providerUpdatedAt:'2026-01-01'};
 const blocked={id:'sp:kirmalk:s:blocked',title:'Blocked',kind:'series',episodes:[episode('kept',1,1)]};const skipped={id:'sp:dessinanime:s:456-les-simpson',title:'Les Simpson',kind:'series',access:'catalogue-only'};
 const r=await refreshSeriesEpisodes([old,blocked,skipped],{now:Date.parse('2026-10-16T12:00:00Z'),resolveDetails:async row=>{if(row===blocked)throw Error('HTTP 403');return {...row,episodes:[episode('new',2,1)]};}});
 assert.deepEqual(r.items[0].episodes.map(e=>e.id),['old','new']);assert.equal(r.items[0].latestEpisode,'new');assert.equal(r.items[0].providerUpdatedAt,'2026-10-16T12:00:00.000Z');assert.equal(r.items[1].episodes[0].id,'kept');assert.equal(r.report.errors.length,1);assert.equal(r.report.checked,1);assert.equal(r.items[2],skipped);
 const quiet=await refreshSeriesEpisodes(r.items,{now:Date.parse('2026-10-16T13:00:00Z'),resolveDetails:()=>{throw Error('must not run');}});assert.equal(quiet.report.errors.length,0);
});
test('incoming source aliases merge verified Arabic and Latin titles without collapsing remakes',()=>{
 const base={shows:[{id:'base',title:'Arabic Show',kind:'series',year:2024,episodes:[]}],tags:[],channels:[]};
 const r=mergeLibrary(base,[{id:'sp:kirmalk:s:show',title:'عنوان عربي',altTitles:['Arabic Show'],kind:'series',year:2024,episodes:[]}],{product:'flixer'});assert.equal(r.catalog.shows.length,1);
 const remake=mergeLibrary(base,[{id:'new',title:'عنوان عربي',altTitles:['Arabic Show'],kind:'series',year:2025}],{product:'flixer'});assert.equal(remake.catalog.shows.length,2);
 assert.equal(matchesSearch('على', 'علي'),true);assert.equal(matchesSearch('ســلام','سلام'),true);
});
test('search starts every provider simultaneously and widens known aliases before merging',async()=>{
 const started=[],terms=[];let release;const gate=new Promise(r=>release=r);const fetchers=Object.fromEntries(SEARCH_PROVIDERS.map(name=>[name,async q=>{started.push(name);terms.push(q);await gate;return name==='frenchstream'?[{id:'sp:frenchstream:m:123',title:'French Name',altTitles:['English Name'],year:2024,kind:'film',episodes:[]}]:[];} ]));
 const pending=unifiedSearch('English Name',{product:'flixer',catalog:{shows:[{id:'base',title:'English Name',altTitles:['French Name'],year:2024,kind:'film',episodes:[]}],channels:[],tags:[]},fetchers});
 await new Promise(r=>setImmediate(r));assert.deepEqual(new Set(started),new Set(SEARCH_PROVIDERS));assert.ok(terms.includes('French Name'));release();assert.equal((await pending).length,1);
 await assert.rejects(unifiedSearch('x',{provider:'arbitrary',catalog:{shows:[]}}),/Invalid/);
});

test('French season discovery retains explicit valid season records and rejects untrusted identities',()=>{
 assert.deepEqual(parseFrenchSeasons([{id:123,title:'Seasonless announcement'},{id:124,title:'A - Saison 3'},{id:125,title:'A - Saison 4'},{id:'126',title:'A - Saison 5'},{id:0,title:'A - Saison 6'}],'sp:frenchstream:s:124'),['sp:frenchstream:s:125']);
 assert.throws(()=>parseFrenchSeasons({error:'blocked'},'sp:frenchstream:s:124'),/format/);
});
test('catalogue-only updates never create fake episodes or disable another verified playable offering',()=>{
 const source={id:'sp:dessinanime:m:123-a',title:'A',kind:'film',year:2024,access:'catalogue-only',episodes:[],offerings:[{id:'sp:dessinanime:m:123-a',provider:'dessinanime',availability:'catalogue-only'}]};
 assert.equal(mergeShow(source,source).episodes.length,0);
 const playable=mergeShow(source,{id:'fm:m:123',title:'A',kind:'film',year:2024,episodes:[{id:'fm:m:123',season:1,number:1}],offerings:[{provider:'fmovies',id:'fm:m:123'}]});
 assert.equal(playable.access,'public');assert.equal(playable.episodes.length,1);
 const again=mergeShow(playable,source);assert.equal(again.access,'public');assert.equal(again.episodes.length,1);
 assert.equal(parseDessinCatalogue([{id:10,slug:'super-sentai',mediaType:'TV',title:'Super Sentai'}]).length,1);
});

test('French catalogue entries gain real provider episodes only after identity, kind and year match',()=>{
 const [row]=parseDessinCatalogue([{id:99,slug:'456-les-simpson',title:'Les Simpson',releaseYear:1989,mediaType:'TV'}]);
 const candidate={id:'sp:frenchstream:s:123',tmdbId:456,kind:'series',year:1989,title:'The Simpsons',access:'public',episodes:[{id:'sp:frenchstream:e:123:35:1',season:35,number:1}],offerings:[{provider:'frenchstream',id:'sp:frenchstream:s:123'}]};
 assert.equal(mergeDessinPlayback(row,candidate).access,'public');assert.equal(mergeDessinPlayback(row,candidate).episodes[0].season,35);
 for(const other of [{...candidate,year:2026},{...candidate,tmdbId:999},{...candidate,kind:'film'},{...candidate,access:'account-required'}])assert.equal(mergeDessinPlayback(row,other),row);
 const [unicode]=parseDessinCatalogue([{id:1,slug:'233547-\uB2E4\uC774',title:'Cartoon',releaseYear:2023,mediaType:'TV'}]);assert.ok(unicode);assert.match(unicode.sourceUrl,/%/);
});
