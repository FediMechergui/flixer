import test from 'node:test';import assert from 'node:assert/strict';import {cimaWatchData,cimaMovieEntries,dataLiteral,fetchCimaPage} from '../src/arabic-providers.js';
const entry=(slug,content,origin='https://www.cimatn.com')=>({link:[{rel:'alternate',href:origin+'/p/'+slug+'.html'}],content:{$t:content}});
test('one removed CimaTN watch feed cannot discard available films or blank English-first titles',async()=>{
 const make=(slug,title,origin)=>({title:{$t:title},link:[{rel:'alternate',href:`https://www.cimatn.com/2026/01/${slug}.html`}],content:{$t:`<h1>${title}</h1><script>const feed='${origin}/feeds/pages/default';pageUrl.includes('${slug}');</script>`}}),requests=[];
 const result=await fetchCimaPage({kind:'film',page:1,fetchPage:async url=>{requests.push(url);if(url.includes('/feeds/posts/'))return JSON.stringify({feed:{entry:[make('film-live','Film Live','https://www.cimatn.com'),make('film-missing','Missing','https://cimatunisaaa.blogspot.com'),make('film-missing-two','Missing Two','https://cimatunisaaa.blogspot.com')]}});if(url.startsWith('https://cimatunisaaa.'))throw Error('Arabic source HTTP 404');return JSON.stringify({feed:{entry:[entry('film-live','const servers=[{url:"https://uqload.vc/embed-film.html"}]')]}});}});
 assert.equal(result.items.length,3);assert.equal(result.items[0].title,'Film Live');assert.equal(result.items[0].access,'public');assert.equal(result.unavailablePosts,2);assert.equal(result.providerErrors.length,2);assert.equal(requests.filter(url=>url.startsWith('https://cimatunisaaa.')).length,1);
});
test('CimaTN films follow only the verified feed published on their own title page',async()=>{
 const origin='https://cimatnwatchinggg.blogspot.com',requests=[];
 const result=await cimaWatchData(`const feedUrl='${origin}/feeds/pages/default?alt=json-in-script';pageUrl.includes('film-needle')`,{fetchPage:async url=>{requests.push(url);return JSON.stringify({feed:{entry:[entry('film-needle','const servers=[{url:"https://uqload.vc/embed-correct.html"}]',origin),entry('film-needle','const servers=[{url:"https://uqload.vc/embed-wrong.html"}]')]}});}});
 assert.equal(requests.length,1);assert.equal(new URL(requests[0]).origin,origin);assert.equal(result.sourceUrl,origin+'/p/film-needle.html');assert.equal(result.servers[0].url,'https://uqload.vc/embed-correct.html');
 const missing=await cimaWatchData(`'${origin}/feeds/pages/default';pageUrl.includes('film-absent')`,{fetchPage:async()=>JSON.stringify({feed:{entry:[entry('film-other','const servers=[];',origin)]}})});assert.equal(missing,null);
 await assert.rejects(cimaWatchData("'https://attacker.example/feeds/pages/default';pageUrl.includes('film-needle')",{fetchPage:async()=>{throw Error('Must not fetch');}}),/not verified/);
});

test('Blogger subscription links cannot replace a film-specific watch feed',async()=>{
 const html='<link rel="alternate" href="https://www.cimatn.com/feeds/posts/default"><script>const feed="https://cimatnwatchinggg.blogspot.com/feeds/pages/default";pageUrl.includes("film-needle");</script>';
 const result=await cimaWatchData(html,{fetchPage:async url=>{assert.equal(new URL(url).origin,'https://cimatnwatchinggg.blogspot.com');assert.equal(new URL(url).pathname,'/feeds/pages/default');return JSON.stringify({feed:{entry:[entry('film-needle','const servers=[{url:"https://uqload.vc/embed-correct.html"}]','https://cimatnwatchinggg.blogspot.com')]}});}});assert.equal(result.servers.length,1);
});
test('CimaTN reads migrated watch pages from its current origin and traverses all feed pages',async()=>{
 const requests=[],result=await cimaWatchData('const watchPageSlug="test-series";',{fetchPage:async url=>{requests.push(url);assert.equal(new URL(url).origin,'https://www.cimatn.com');return JSON.stringify({feed:{openSearch$totalResults:{$t:'151'},entry:url.includes('start-index=151')?[entry('test-series','const seriesData={availableEpisodes:2,episodes:{1:[{url:"https://hgcloud.to/e/real"}],2:[{url:"https://playmogo.com/e/real"}]}};')]:[]}})}});
 assert.equal(requests.length,2);assert.equal(result.availableEpisodes,2);assert.equal(Object.keys(result.episodes).length,2);assert.equal(result.sourceUrl,'https://www.cimatn.com/p/test-series.html');
});

test('CimaTN follows published post feeds with multiline slug literals and rejects ambiguous editions',async()=>{
 const origin='https://cimatunisaaaa.blogspot.com',source=`const feed='${origin}//feeds/posts/default';pageUrl.includes(\n 'film-test'\n );`;
 const fetchPage=async url=>{assert.equal(new URL(url).pathname,'/feeds/posts/default');return JSON.stringify({feed:{entry:[{link:[{rel:'alternate',href:origin+'/2026/01/film-test.html'}],content:{$t:'const servers=[{url:"https://uqload.vc/embed-film.html"}]'}}]}});};
 assert.equal((await cimaWatchData(source,{fetchPage})).servers.length,1);
 assert.equal((await cimaWatchData(`const WATCH_PAGE_SLUG='film-test';const feed='${origin}/feeds/posts/default';pageUrl.includes(WATCH_PAGE_SLUG);`,{fetchPage})).servers.length,1);
 const entries=[2025,2026].map(year=>({link:[{rel:'alternate',href:origin+`/${year}/01/film-test.html`}],content:{$t:'const servers=[];'}}));
 assert.equal(await cimaWatchData(source,{fetchPage:async()=>JSON.stringify({feed:{entry:entries}})}),null);
});

test('CimaTN accepts a literal own watch-page button without inventing a film from its trailer',async()=>{
 const fetchPage=async()=>JSON.stringify({feed:{entry:[entry('film-full','const servers=[{url:"https://uqload.vc/embed-full.html"}]')]}});
 const result=await cimaWatchData('<iframe src="https://www.youtube.com/embed/trailer0000"></iframe><div class="BTNSDownWatch"><a class="watch" href="/p/film-full.html">Watch</a></div>',{fetchPage});assert.equal(result.servers.length,1);
 assert.equal(await cimaWatchData('<iframe src="https://www.youtube.com/embed/trailer0000"></iframe><div class="BTNSDownWatch"><a class="watch" href="https://artify.tn/ar/watch/film-full">Watch</a></div>',{fetchPage:async()=>{throw Error('Must not fetch paid destination');}}),null);
});

test('CimaTN does not offer an explicitly differently titled film as an alternate server',()=>{
 const own={name:'دار العرس',url:'https://player.mediadelivery.net/embed/1/own'},other={name:'لص شايح',url:'https://player.mediadelivery.net/embed/1/other'},generic={name:'مشغل 3',url:'https://vkvideo.ru/video_ext.php?id=1'};
 assert.deepEqual(cimaMovieEntries({sourceTitle:'فيلم دار العرس Dar El 3ers HDCAM',servers:[own,other,generic]}),[own,generic]);
 assert.deepEqual(cimaMovieEntries({servers:[own,other]}),[own,other]);
});
test('CimaTN film data cannot be supplied by an alternate-host or mismatched watch page',async()=>{
 const result=await cimaWatchData('pageUrl.includes("test-film")',{fetchPage:async()=>JSON.stringify({feed:{entry:[entry('test-film','const servers=[{url:"https://hgcloud.to/e/wrong"}]','https://external.test'),entry('other-film','const servers=[{url:"https://hgcloud.to/e/wrong"}]'),entry('test-film','const servers=[{url:"https://hgcloud.to/e/correct"}]')]}})});
 assert.deepEqual(result.servers,[{url:'https://hgcloud.to/e/correct'}]);assert.equal(result.sourceUrl,'https://www.cimatn.com/p/test-film.html');
});
test('compact numeric download keys cannot invalidate the separate playable episode map',()=>{
 const data=dataLiteral('const seriesData={availableEpisodes:1,episodes:{1:[{url:"https://www.youtube.com/embed/abcdefghijk"}]},downloadLinks:{1:"file-a",2:"file-b"},label:"Leave ,3: text intact"};','seriesData');
 assert.equal(data.episodes[1].length,1);assert.equal(data.downloadLinks[2],'file-b');assert.equal(data.label,'Leave ,3: text intact');assert.equal(dataLiteral('const seriesData={episodes:{1:process.exit()}};','seriesData'),null);
});
test('published partial film slugs resolve only an unambiguous page and prefer an exact match',async()=>{
 const lookup=entries=>cimaWatchData("pageUrl.includes('film-hbiba')",{fetchPage:async()=>JSON.stringify({feed:{entry:entries}})});
 const a=entry('film-hbiba-complet','const servers=[{url:"https://hgcloud.to/e/a"}];'),b=entry('film-hbiba-second','const servers=[];');
 assert.equal((await lookup([a])).sourceUrl,'https://www.cimatn.com/p/film-hbiba-complet.html');assert.equal(await lookup([a,b]),null);
 assert.equal((await lookup([a,b,entry('film-hbiba','const servers=[];')])).sourceUrl,'https://www.cimatn.com/p/film-hbiba.html');
});
