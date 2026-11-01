import test from 'node:test';
import assert from 'node:assert/strict';
import {fmoviesPageUrl,parseFmoviesDetails} from '../src/fmovies.js';

test('the publisher move preserves legacy FMovies title and episode coordinates',()=>{
 assert.equal(fmoviesPageUrl('https://www.f-movies.org/tv/example-88?season=2&episode=3').href,'https://www.f-moviess.org/tv/example-88?season=2&episode=3');
 assert.equal(fmoviesPageUrl('/api/search?q=Example').href,'https://www.f-moviess.org/api/search?q=Example');
 const html='<script type="application/ld+json">'+JSON.stringify({'@type':'Movie',name:'Example',genre:['Drama']})+'</script>';
 for(const origin of ['https://www.f-movies.org','https://www.f-moviess.org']){
  const item=parseFmoviesDetails(html,origin+'/movie/example-88');
  assert.equal(item.id,'fm:m:88');assert.equal(item.sourceUrl,'https://www.f-moviess.org/movie/example-88');
 }
});

test('FMovies only accepts the two verified publisher origins',()=>{
 for(const url of ['http://www.f-moviess.org/movie/example-88','https://www.f-moviess.org.evil.test/movie/example-88','https://attacker@www.f-moviess.org/movie/example-88','https://www.f-moviess.org:8443/movie/example-88'])assert.throws(()=>fmoviesPageUrl(url),/Invalid FMovies/);
});
