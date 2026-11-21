import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArabicDetails,parseArabicServers} from '../src/arabic-providers.js';
import {currentFrembedUrl,frembedIdFromUrl,parseFrembedDetails} from '../src/frembed.js';

test('Kirmalk episode parents need not include a numeric season and generic categories stay excluded',()=>{
 const html='<h1>مسلسل حب اسود الحلقة 36</h1><section class="watch-information-section"><div class="video-details-simple"><a href="/category.php?cat=serieseg4">HD مسلسلات مصرية</a><a href="/category.php?cat=7ob-aswad01-02">مسلسل حب اسود</a></div></section><aside class="video-details-simple"><a href="/category.php?cat=unrelated">مسلسل آخر</a></aside>';
 const row=parseArabicDetails('sp:kirmalk:e:3981c3e07',html);assert.equal(row.parent.id,'sp:kirmalk:s:7ob-aswad01-02');
 assert.equal(parseArabicDetails('sp:kirmalk:e:3981c3e07',html.replace('مسلسل حب اسود</a>','الحلقات القادمة</a>')).parent,undefined);
});
test('the observed Kirmalk film player is admitted only on its exact HTTPS embed route',()=>{
 const html=url=>'<script type="application/ld+json">'+JSON.stringify({'@type':'VideoObject',embedUrl:url})+'</script>';
 const url='https://hd1.hdup20.com/embed-uxi82cl0txh5.html';
 assert.equal(parseArabicServers('sp:kirmalk:m:da22d133b',html(url))[0].embedUrl,url);
 for(const value of [url+'?redirect=evil',url.replace('hd1.','other.'),url.replace('https:','http:'),url+'#fragment'])assert.equal(parseArabicServers('sp:kirmalk:m:da22d133b',html(value)).length,0);
 assert.equal(parseArabicServers('sp:ahwaktv:m:da22d133b',html(url)).length,0);
});
test('Frembed saved links migrate to the announced domain without accepting lookalikes or different episode identities',()=>{
 assert.equal(currentFrembedUrl('https://frembed.uno/embed/movie/129'),'https://frembed.shop/embed/movie/129');
 for(const origin of ['https://frembed.uno','https://frembed.shop'])assert.equal(frembedIdFromUrl(origin+'/movies/spirited-away/129'),'sp:frembed:m:129');
 for(const url of ['https://frembed.shop.attacker.test/movies/a/129','https://user@frembed.shop/movies/a/129','http://frembed.shop/movies/a/129'])assert.equal(currentFrembedUrl(url),null);
 const row=parseFrembedDetails('sp:frembed:s:246',{status:200,result:{items:[{title:'Avatar',tmdb:'246',sa:1,epi:2,link:'https://frembed.uno/embed/serie/246?sa=1&epi=2'}]}});
 assert.equal(row.episodes[0].sourceUrl,'https://frembed.shop/embed/serie/246?sa=1&epi=2');
});
