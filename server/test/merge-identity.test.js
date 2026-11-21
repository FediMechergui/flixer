import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLibrary} from '../src/merge-library.js';
const title=(id,extra={})=>({id,kind:'film',title:'Same title',year:2020,poster:{custom:'https://art.test/same.jpg'},episodes:[{id,season:1,number:1}],...extra});
test('conflicting external identities never merge through names, posters or persisted aliases',()=>{
  for(const key of ['tmdbId','imdbId'])for(const year of [2020,null]){
    const a=title('fm:m:100',{[key]:'100',year}),b=title('fm:m:200',{[key]:'200',year});
    const result=mergeLibrary({shows:[a]},[b],{aliases:{[b.id]:a.id}});
    assert.equal(result.catalog.shows.length,2);assert.equal(result.report.aliases[b.id],undefined);
    assert.equal(result.report.pending.length,0);assert.equal(result.catalog.shows[0].episodes[0].offerings.length,1);
  }
});
test('a verified identity can merge alternate names, while the same source can correct metadata',()=>{
  const a=title('fm:m:100',{tmdbId:100}),b=title('mf:m:100',{tmdbId:'100',title:'Alternate title'});
  assert.equal(mergeLibrary({shows:[a]},[b]).catalog.shows.length,1);
  assert.equal(mergeLibrary({shows:[a]},[{...a,title:'Corrected title'}]).catalog.shows.length,1);
});
