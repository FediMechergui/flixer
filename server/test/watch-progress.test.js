import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../client-terrarium/js/app.js',import.meta.url),'utf8');
function fixture(progress={}){
 const state={progress},saved=[];let now=100;
 const c=vm.createContext({state,Date:{now:()=>++now},saveProgress:()=>{state.progressRevision=(state.progressRevision||0)+1;saved.push(JSON.parse(JSON.stringify(state.progress)));}});
 const start=source.indexOf('  const episodeIds='),end=source.indexOf('  /* ---------- Components',start);
 vm.runInContext(source.slice(start,end)+';globalThis.watch={setProgress,markFinished,resumeAt,pctOf,entryEpisode,progressFor};',c);
 return {state,saved,...c.watch};
}
test('resume follows explicit episode aliases after an updated catalogue changes its primary source',()=>{
 const old='mf:e:episode-8',episode={id:'fm:e:8',season:2,n:8,title:'Eight',offerings:[{id:old}]},f=fixture({[old]:{showId:'show',position:123,duration:1800,at:1,finished:false}});
 assert.equal(f.resumeAt(episode),123);
 f.setProgress(episode,'show',145,1800);assert.equal(f.resumeAt(old),145);assert.equal(Object.keys(f.state.progress).length,1);
 assert.equal(f.state.progress[episode.id].episode.n,8);
 assert.equal(f.entryEpisode({episodes:[{id:'episode-1'},episode]}).id,episode.id);
 assert.equal(f.resumeAt({id:'different-edition',season:2,n:8}),0,'numbering alone never joins different provider editions');
});
test('failed startup and invalid telemetry cannot wipe the saved episode or time',()=>{
 const f=fixture(),episode={id:'episode-4',season:1,n:4};f.setProgress(episode,'show',300,1800);
 for(const [pos,dur] of [[0,1800],[NaN,1800],[12,0],[Infinity,1800],[1900,1800]])f.setProgress(episode,'show',pos,dur);
 assert.equal(f.resumeAt(episode),300);assert.equal(f.saved.length,1);
 f.markFinished(episode,'show');assert.equal(f.resumeAt(episode),0);assert.equal(f.progressFor(episode).finished,true);
});
test('newest unfinished episode is retained independently of another episode or edition',()=>{
 const f=fixture(),a={id:'a',season:1,n:2},b={id:'b',season:1,n:3};f.setProgress(a,'show',100,1800);f.setProgress(b,'show',200,1800);
 assert.equal(f.entryEpisode({episodes:[a,b]}).id,'b');assert.equal(f.resumeAt(a),100);assert.equal(f.resumeAt(b),200);
});
test('returning to the cached home refreshes progress without reloading catalogue rows',()=>{
 let refreshed=0,rendered=0;const state={renderedTab:'home',homeRevision:4,catalogRevision:4,homeProgressRevision:1,progressRevision:2};
 const c=vm.createContext({state,$$:()=>[],refreshContinueWatching:()=>refreshed++,TAB_RENDERERS:{home:()=>rendered++}});
 const start=source.indexOf('  function renderTab('),end=source.indexOf('\n  function ',start+10);
 vm.runInContext(source.slice(start,end)+';renderTab("home");',c);assert.equal(refreshed,1);assert.equal(rendered,0);
});
