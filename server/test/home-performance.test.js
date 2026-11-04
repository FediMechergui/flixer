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
 const state={renderedTab:'home',settings:{},meta:{genres:{}}},c=vm.createContext({state,api,skelRow:()=>'',$:key=>nodes.get(key)||node(),$$:()=>[],isFresh:()=>false,inList:()=>false,esc:String,ICON:{},genreName:()=>'',continueWatchingRow:()=>saved,recentItems:items=>items,section:(title,sub,items)=>'<section>'+title+':'+items.map(i=>i.title).join(',')+'</section>',requestAnimationFrame:()=>{},setTimeout,clearInterval(){},setInterval(){},clearTimeout(){}});
 vm.runInContext(source.slice(start,end)+';globalThis.render=renderHome;',c);c.render(node());await new Promise(r=>setImmediate(r));
 assert.match(nodes.get('#hero').innerHTML,/Test/);assert.match(nodes.get('#home-rows').innerHTML,/Recently updated:Test/);assert.equal(nodes.get('#continue-watching').innerHTML,'');assert.equal(nodes.get('#home-extras').innerHTML,'');resume('<section>Saved episode</section>');await new Promise(r=>setImmediate(r));assert.match(nodes.get('#continue-watching').innerHTML,/Saved episode/);release([]);
});

test('a slow ranking cannot hold ready home rows, and old requests cannot replace a different tab',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/app.js',import.meta.url),'utf8'),start=source.indexOf('  async function renderHome('),end=source.indexOf('  /* ---------- Universes:',start);
 const nodes=new Map(),node=()=>({innerHTML:'',addEventListener(){},remove(){}}),get=key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key);};
 let release;const pending=new Promise(resolve=>release=resolve),item={id:'ready',title:'Ready',type:'movie',genreIds:[]};
 const api={trending:async()=>[item],nowPlaying:()=>pending,onTheAir:async()=>[item],topRated:async()=>[],popular:()=>pending,collections:async()=>[],universeList:async()=>[],serviceList:async()=>[],topUniverses:async()=>[]};
 const state={renderedTab:'home',meta:{genres:{}}},context=vm.createContext({state,api,$:get,$$:()=>[],skelRow:()=>'<loading>',continueWatchingRow:async()=>'',recentItems:items=>items,ensureMeta:()=>pending,section:(title,sub,items)=>title+':'+items.map(i=>i.title),esc:String,requestAnimationFrame:fn=>fn(),setTimeout});
 vm.runInContext(source.slice(start,end)+';globalThis.render=renderHome;',context);
 const rendering=context.render(node());await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(get('#home-row-series').innerHTML,'New series:Ready');
 assert.match(get('#home-main-rows').innerHTML,/Loading New movies/);
 state.renderedTab='shows';get('#home-row-movies').innerHTML='Different tab';release([item]);await rendering;await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('#home-row-movies').innerHTML,'Different tab');
});

test('browse displays saved matches before the full index, then waits for unseen indexed titles without repeats',async()=>{
 const start=apiSource.indexOf('    async discover('),end=apiSource.indexOf('    async genres(',start),compare=(a,b)=>a.rank-b.rank;
 const context=vm.createContext({PER_PAGE:24,nativeStardima:()=>null,...Object.fromEntries(['byUpdated','byAdded','byYearDesc','byYearAsc','byEpisodes','byTitle','byWeight','byRating'].map(key=>[key,compare]))});
 vm.runInContext('globalThis.api=new(class{'+apiSource.slice(start,end)+'})();',context);
 const api=context.api,rows=[{id:'saved',rank:0}];let finishIndex;
 api.catalog=async()=>{};api.all=async()=>rows;api._indexReady=new Promise(resolve=>finishIndex=resolve);api.liveEnabled=false;
 let first;const initial=api.discover('movie',{sort:'added'},1).then(value=>first=value);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(first?.items[0].id,'saved','a saved page must not wait for the full index');await initial;
 let settled=false;const next=api.discover('movie',{sort:'added'},2).then(value=>{settled=true;return value;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
 rows.push({id:'from-full-index',rank:1});finishIndex();
 assert.deepEqual(Array.from((await next).items,item=>item.id),['from-full-index']);
});
