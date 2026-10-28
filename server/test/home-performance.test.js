import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const apiSource=fs.readFileSync(new URL('../../client-terrarium/js/api.js',import.meta.url),'utf8');
test('bounded home ranking matches stable complete sorting and does not mutate the catalogue',()=>{
 const start=apiSource.indexOf('  function topItems('),end=apiSource.indexOf('\n  }',start)+4,c=vm.createContext({});vm.runInContext(apiSource.slice(start,end)+';globalThis.select=topItems;',c);
 const items=Array.from({length:10000},(_,id)=>({id,score:(id*37)%101,type:id%3?'tv':'movie'})),before=items.slice(),compare=(a,b)=>b.score-a.score;
 for(const limit of [0,1,14,24,12000])assert.deepEqual(Array.from(c.select(items,compare,limit,i=>i.type==='tv')),items.filter(i=>i.type==='tv').sort(compare).slice(0,limit));
 assert.deepEqual(items,before);
});
test('home renders the hero and recent cards before optional ranking or metadata complete',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/app.js',import.meta.url),'utf8'),start=source.indexOf('  async function renderHome('),end=source.indexOf('  /* ---------- Universes:',start),nodes=new Map();
 const node=()=>({innerHTML:'',addEventListener(){},remove(){}});nodes.set('#hero',node());nodes.set('#home-rows',node());nodes.set('#home-main-rows',node());nodes.set('#home-extras',node());nodes.set('#continue-watching',node());
 let release,resume;const pending=new Promise(resolve=>release=resolve),saved=new Promise(resolve=>resume=resolve),item={id:'test',type:'movie',title:'Test',genreIds:[],poster:'poster',firstEpisodeId:'test'};
 const api={trending:async()=>[item],nowPlaying:()=>pending,onTheAir:()=>pending,topRated:()=>pending,popular:()=>pending};
 const state={renderedTab:'home',settings:{},meta:{genres:{}}},c=vm.createContext({state,api,skelRow:()=>'',$:key=>nodes.get(key)||node(),$$:()=>[],isFresh:()=>false,inList:()=>false,esc:String,ICON:{},genreName:()=>'',continueWatchingRow:()=>saved,section:(title,sub,items)=>'<section>'+title+':'+items.map(i=>i.title).join(',')+'</section>',requestAnimationFrame:()=>{},setTimeout,clearInterval(){},setInterval(){},clearTimeout(){}});
 vm.runInContext(source.slice(start,end)+';globalThis.render=renderHome;',c);c.render(node());await new Promise(r=>setImmediate(r));
 assert.match(nodes.get('#hero').innerHTML,/Test/);assert.match(nodes.get('#home-rows').innerHTML,/Recently updated:Test/);assert.equal(nodes.get('#continue-watching').innerHTML,'');assert.equal(nodes.get('#home-extras').innerHTML,'');resume('<section>Saved episode</section>');await new Promise(r=>setImmediate(r));assert.match(nodes.get('#continue-watching').innerHTML,/Saved episode/);release([]);
});
