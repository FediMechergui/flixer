import test from 'node:test';import assert from 'node:assert/strict';import {cimaWatchData,dataLiteral} from '../src/arabic-providers.js';
const entry=(slug,content,origin='https://www.cimatn.com')=>({link:[{rel:'alternate',href:origin+'/p/'+slug+'.html'}],content:{$t:content}});
test('CimaTN reads migrated watch pages from its current origin and traverses all feed pages',async()=>{
 const requests=[],result=await cimaWatchData('const watchPageSlug="test-series";',{fetchPage:async url=>{requests.push(url);assert.equal(new URL(url).origin,'https://www.cimatn.com');return JSON.stringify({feed:{openSearch$totalResults:{$t:'151'},entry:url.includes('start-index=151')?[entry('test-series','const seriesData={availableEpisodes:2,episodes:{1:[{url:"https://hgcloud.to/e/real"}],2:[{url:"https://playmogo.com/e/real"}]}};')]:[]}})}});
 assert.equal(requests.length,2);assert.equal(result.availableEpisodes,2);assert.equal(Object.keys(result.episodes).length,2);assert.equal(result.sourceUrl,'https://www.cimatn.com/p/test-series.html');
});
test('CimaTN film data cannot be supplied by an alternate-host or mismatched watch page',async()=>{
 const result=await cimaWatchData('pageUrl.includes("test-film")',{fetchPage:async()=>JSON.stringify({feed:{entry:[entry('test-film','const servers=[{url:"https://hgcloud.to/e/wrong"}]','https://external.test'),entry('other-film','const servers=[{url:"https://hgcloud.to/e/wrong"}]'),entry('test-film','const servers=[{url:"https://hgcloud.to/e/correct"}]')]}})});
 assert.deepEqual(result.servers,[{url:'https://hgcloud.to/e/correct'}]);assert.equal(result.sourceUrl,'https://www.cimatn.com/p/test-film.html');
});
test('compact numeric download keys cannot invalidate the separate playable episode map',()=>{
 const data=dataLiteral('const seriesData={availableEpisodes:1,episodes:{1:[{url:"https://www.youtube.com/embed/abcdefghijk"}]},downloadLinks:{1:"file-a",2:"file-b"},label:"Leave ,3: text intact"};','seriesData');
 assert.equal(data.episodes[1].length,1);assert.equal(data.downloadLinks[2],'file-b');assert.equal(data.label,'Leave ,3: text intact');assert.equal(dataLiteral('const seriesData={episodes:{1:process.exit()}};','seriesData'),null);
});
