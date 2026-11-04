import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../../client-terrarium/js/app.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('  function recentItems('),source.indexOf('  function card('));
const refresh=source.slice(source.indexOf('  async function refreshRecentRow('),source.indexOf('  /* ---------- Universes:'));
const escape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function helperContext(){
  const context=vm.createContext({esc:escape});
  vm.runInContext(helpers+';globalThis.ui={recentItems,recentUpdateMeta,recentSection};',context);
  return context.ui;
}

test('recent cards combine explicit source aliases but retain unrelated titles sharing a name',()=>{
  const {recentItems}=helperContext();
  const rows=[
    {id:'canonical',title:'Same title',type:'tv',offerings:[{id:'fm:1'}],providers:[{id:'fmovies',name:'FMovies'}]},
    {id:'wco:1',title:'Same title',type:'tv',providers:[{id:'wco',name:'WCO'}]},
    {id:'bridge',title:'Same title',type:'tv',offerings:[{id:'wco:1'},{id:'fm:1'}],providers:[{id:'carateen',name:'Carateen'}]},
    {id:'remake',title:'Same title',type:'tv'},
    {id:'fm:1',title:'Same title',type:'movie'}
  ];
  const before=JSON.stringify(rows),result=recentItems(rows);
  assert.deepEqual(Array.from(result,item=>item.id),['canonical','remake','fm:1']);
  assert.deepEqual(Array.from(result[0].providers,item=>item.id),['fmovies','wco','carateen']);
  assert.equal(JSON.stringify(rows),before,'painting a rail cannot mutate the catalogue');
});

test('update labels show proven episode coordinates, unknown seasons and escaped episode titles',()=>{
  const {recentUpdateMeta}=helperContext(),now=new Date(2026,10,4,12).getTime(),updatedAt=new Date(2026,10,4,9).toISOString();
  const html=recentUpdateMeta({updateKind:'episodes',updatedAt,recentEpisode:{id:'actual',season:2,number:6,title:'A <new> beginning'}},now);
  assert.match(html,/S2 · E6 added/);assert.match(html,/>Today<\/time>/);assert.match(html,/A &lt;new&gt; beginning/);assert.ok(!html.includes('A <new>'));
  const unknown=recentUpdateMeta({updateKind:'episodes',updatedAt,recentEpisode:{id:'actual',season:null,number:6,title:'Episode 6'}},now);
  assert.match(unknown,/Episode 6 added/);assert.doesNotMatch(unknown,/S0|S1|card__episode/);
  const intro=recentUpdateMeta({updateKind:'episodes',updatedAt,recentEpisode:{id:'intro',season:null,number:null,title:'Opening'}},now);
  assert.match(intro,/Episodes added/);assert.doesNotMatch(intro,/E0|Episode 1/);
  assert.match(recentUpdateMeta({updateKind:'added',updatedAt:'invalid'},now),/Added to library/);
  assert.doesNotMatch(recentUpdateMeta({updateKind:'added',updatedAt:'invalid'},now),/<time/);
  const observed=recentUpdateMeta({updateKind:'episodes',updatedAt,updateObserved:true,recentUpdate:{source:'feed',at:'',observedAt:updatedAt},recentEpisode:{id:'actual',season:2,number:6}},now);
  assert.match(observed,/S2 · E6 · Latest on source/);assert.doesNotMatch(observed,/Today|added|<time/,'observing an undated feed today is not its publication date');
});

test('an empty recent feed explains that catalogue additions are separate instead of inventing update cards',()=>{
  const html=helperContext().recentSection([]);
  assert.match(html,/Recently updated/);assert.match(html,/No confirmed release or episode updates/);assert.doesNotMatch(html,/card__art|Added to library/);
});

function refreshContext(resolveItems){
  const state={renderedTab:'home',homeGeneration:1,catalogRevision:2};
  let rail;
  const box={isConnected:true,html:''};
  function makeRail(items,scroll=0){
    const row={scrollLeft:scroll,getBoundingClientRect:()=>({left:20})};
    row.cards=items.map((item,index)=>({dataset:{titleId:item.id},contains:()=>false,focus(){this.focused=true;},getBoundingClientRect:()=>({left:20+index*120-row.scrollLeft,right:140+index*120-row.scrollLeft})}));
    return row;
  }
  rail=makeRail([{id:'a'},{id:'b'},{id:'c'}],130);
  const document={activeElement:rail.cards[1]};
  Object.defineProperty(box,'innerHTML',{get:()=>box.html,set:value=>{box.html=value;rail=makeRail(JSON.parse(value));}});
  const context=vm.createContext({state,document,api:{trending:resolveItems},$:selector=>selector==='#home-recent'?box:selector==='.row'?rail:selector==='.section'?{classList:{remove(){}}}:null,$$:(_selector,row)=>row.cards,recentItems:items=>items,recentSection:items=>JSON.stringify(items),section:(_title,_sub,items)=>JSON.stringify(items)});
  vm.runInContext(refresh+';globalThis.refresh=refreshRecentRow;',context);
  return {state,box,context,get rail(){return rail;}};
}

test('live recent updates retain the visible title, keyboard focus and the rest of the home page',async()=>{
  const c=refreshContext(async()=>[{id:'new'},{id:'a'},{id:'b'},{id:'c'}]);
  await c.context.refresh();
  assert.equal(c.rail.scrollLeft,250,'new cards inserted before the visible title do not move it');
  assert.equal(c.rail.cards[2].getBoundingClientRect().left,10);
  assert.equal(c.rail.cards[2].focused,true);assert.equal(c.state.homeRevision,2);assert.equal(c.state.homeGeneration,1);
});

test('an older pending recent refresh cannot repaint a newer update or a different tab',async()=>{
  let first,second,calls=0;
  const c=refreshContext(()=>new Promise(resolve=>{if(++calls===1)first=resolve;else second=resolve;}));
  const one=c.context.refresh();c.state.catalogRevision=3;const two=c.context.refresh();
  second([{id:'fresh'}]);await two;first([{id:'old'}]);await one;
  assert.match(c.box.html,/fresh/);assert.doesNotMatch(c.box.html,/old/);assert.equal(c.state.homeRevision,3);
  let finish;const d=refreshContext(()=>new Promise(resolve=>finish=resolve));
  const pending=d.context.refresh();d.state.renderedTab='shows';finish([{id:'late'}]);await pending;assert.equal(d.box.html,'');
});
