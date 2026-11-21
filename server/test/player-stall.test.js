import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
function helpers(storage=new Map()){
  const context=vm.createContext({window:{},URL,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
  vm.runInContext(source.slice(source.indexOf('  function initialIndex('),source.indexOf('\n  let hlsReady'))+';globalThis.helpers={initialIndex,sourceOutcome,watchMediaStall};',context);
  return context.helpers;
}
test('a failed exact route is deprioritized, manual success restores it and storage failure is harmless',()=>{
  const storage=new Map(),h=helpers(storage),a={id:'a',provider:'test',name:'Preferred',type:'hls',streamUrl:'https://media.test/a.m3u8'},b={...a,id:'b',name:'Other',streamUrl:'https://media.test/b.m3u8'};
  storage.set('flixer:player-preference',JSON.stringify({provider:'test',name:'Preferred',confirmed:true}));
  h.sourceOutcome(a,false);assert.equal(h.initialIndex([a,b]),1);
  h.sourceOutcome(a,true);assert.equal(h.initialIndex([a,b]),0);
  storage.set('flixer:source-failures','broken');assert.equal(h.initialIndex([a,b]),0);
});
test('buffering has one deadline and progress, pause and teardown cancel recovery',()=>{
  for(const event of ['deadline','timeupdate','pause','dispose']){
    const events=new Map(),timers=new Map();let fired=0,next=0;
    const video={currentTime:1,paused:false,ended:false,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
    const dispose=helpers().watchMediaStall(video,{isCurrent:()=>true,onStall:()=>fired++,onBuffer(){},setTimer:fn=>{timers.set(++next,fn);return next;},clearTimer:id=>timers.delete(id)});
    events.get('waiting')();events.get('stalled')();assert.equal(timers.size,1);
    if(event==='timeupdate'){video.currentTime=2;events.get(event)();}
    if(event==='pause'){video.paused=true;events.get(event)();}
    if(event==='dispose')dispose();
    for(const timer of timers.values())timer();assert.equal(fired,event==='deadline'?1:0);
    dispose();assert.equal(events.size,0);
  }
});
