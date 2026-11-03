import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {load} from 'cheerio';

// Minimal browser DOM for the actual detail rendering and refresh handlers.
function documentFixture(){
  const dom=load('<main id="root"></main>'),nodes=new WeakMap();
  const wrap=node=>{
    if(!node)return null;if(nodes.has(node))return nodes.get(node);
    const element={node,dataset:{},isConnected:true,addEventListener(){},setAttribute:(name,value)=>dom(node).attr(name,value),
      appendChild:child=>dom(node).append(child.node),prepend:child=>dom(node).prepend(child.node),before:child=>dom(node).before(child.node),
      get innerHTML(){return dom(node).html();},set innerHTML(value){dom(node).html(value);},
      get textContent(){return dom(node).text();},set textContent(value){dom(node).text(value);},
      get className(){return dom(node).attr('class');},set className(value){dom(node).attr('class',value);},
      get id(){return dom(node).attr('id');},set id(value){dom(node).attr('id',value);},
      get value(){return this.selectedValue??dom(node).find('option').first().attr('value');},set value(value){this.selectedValue=value;}};
    nodes.set(node,element);return element;
  };
  const select=(selector,root)=>dom(root?.node||dom.root()[0]).find(selector);
  return {document:{createElement:tag=>wrap(dom(`<${tag}></${tag}>`)[0])},root:()=>wrap(dom('#root')[0]),$: (selector,root)=>wrap(select(selector,root)[0]),$$:(selector,root)=>select(selector,root).toArray().map(wrap)};
}

test('late source guides update the title header, season facts and visible episodes together',async()=>{
  const source=fs.readFileSync(new URL('../../client-terrarium/js/app.js',import.meta.url),'utf8'),start=source.indexOf('  async function openDetails('),end=source.indexOf('  /* ---------- Watch ---------- */',start),view=documentFixture();
  const episode=n=>({id:'source:episode:'+n,title:'Episode '+n,season:4,n});
  const initial={id:'sp:stardima:s:6ae791af3be9a',type:'tv',title:'Kaiju No. 8',year:'2024',overview:'A source synopsis.',genres:[],universes:[],versions:[],episodes:[episode(1)],episodeCount:1,seasonCount:1,seasons:[{season_number:4,name:'Season 4',episode_count:1}]};
  const context=vm.createContext({...view,api:{details:async()=>initial,related:async()=>({universe:[],franchise:[],similar:[]}),extras:async()=>null},syncRoot(){},goBack(){},ensureMeta:async()=>{},ICON:{back:'',bookmark:'',play:'',ext:''},inList:()=>false,isFresh:()=>false,artPlaceholder:()=>'',entryEpisode:show=>show.episodes[0],pctOf:()=>0,progressFor:()=>null,epLabel:()=>'',esc:value=>String(value),episodeRow:(show,ep)=>`<a data-episode="${ep.id}">${ep.title}</a>`});
  vm.runInContext(source.slice(start,end)+';globalThis.open=openDetails;',context);
  await context.open('tv',initial.id);const detail=view.$('.detail');
  assert.equal(view.$('[data-detail-meta]',detail).textContent,'2024 · 1 episode');
  const refreshed={...initial,episodes:[1,2,3,4].map(episode),episodeCount:4,seasons:[{season_number:4,name:'Season 4',episode_count:4}]};
  detail.refreshEpisodes(refreshed);
  assert.equal(view.$('[data-detail-meta]',detail).textContent,'2024 · 4 episodes');
  assert.equal(view.$('.facts .fact__v',detail).textContent,'1 · 4 ep');
  assert.equal(view.$$('#episodes [data-episode]',detail).length,4);
  assert.equal(view.$('.detail'),detail,'a background guide update preserves the current dialog');
  const extra={...refreshed,episodes:[...refreshed.episodes,{...episode(5),season:5}],episodeCount:5,seasonCount:2,seasons:[...refreshed.seasons,{season_number:5,name:'Season 5',episode_count:1}]};
  detail.refreshEpisodes(extra);view.$('#season',detail).value='5';detail.refreshEpisodes({...extra,year:'2025'});
  assert.equal(view.$('#season',detail).value,'5','a metadata repaint preserves the selected season');
  assert.equal(view.$('[data-detail-meta]',detail).textContent,'2025 · 5 episodes');
  assert.equal(view.$$('#episodes [data-episode]',detail).length,1);
});
