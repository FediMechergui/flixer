import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(startAt=60){
 class Element{
  constructor(){this.events={};this.classList={contains:()=>false,add(){},remove(){},toggle(){}};this.dataset={};}
  addEventListener(name,fn){this.events[name]=fn;}removeEventListener(){}setAttribute(){}removeAttribute(){}scrollIntoView(){}
  getBoundingClientRect(){return {x:0,y:100,width:360,height:200};}contains(){return false;}
  set innerHTML(value){this.html=value;if(this===bar){this.buttons=[...value.matchAll(/data-i="(\d+)"/g)].map(match=>Object.assign(new Element(),{dataset:{i:match[1]}}));}}
  get innerHTML(){return this.html||'';}
  querySelector(selector){if(this===container)return root;if(this===root)return nodes.get(selector)||null;if(this===bar)return this.buttons?.[0]||null;return null;}
  querySelectorAll(){return this===bar?this.buttons||[]:[];}
 }
 const container=new Element(),root=new Element(),stage=new Element(),bar=new Element(),nodes=new Map([['.player',root],['#pl-stage',stage],['#pl-servers',bar]]);
 for(const key of ['#pl-notice','[data-fs]','[data-hot]','[data-browser-player]','[data-refresh-sources]','[data-close-player]'])nodes.set(key,new Element());
 const direct=[],embedded=[],progress=[],timers=[],docEvents={},windowEvents={};
 const browser={hasNativeVideo:()=>true,hasNativePlayer:()=>true,closePlayers(){},openMedia(server,options){return new Promise(resolve=>direct.push({server,options,resolve}));},openPlayer(url,options){return new Promise(resolve=>embedded.push({url,options,resolve}));}};
 const window={FlixerBrowser:browser,innerWidth:360,addEventListener:(k,fn)=>windowEvents[k]=fn,removeEventListener(){}};
 const document={addEventListener:(k,fn)=>docEvents[k]=fn,removeEventListener(){},visibilityState:'visible'};
 vm.runInNewContext(source,{window,document,URL,console,localStorage:{getItem:()=>null,setItem(){}},setTimeout:(fn,ms)=>{const task={fn,ms};timers.push(task);return task;},clearTimeout:task=>{if(task)task.cancelled=true;}});
 const servers=[{id:'one',provider:'test',name:'One',type:'file',streamUrl:'https://media.example/one.mp4'},{id:'two',provider:'test',name:'Two',type:'file',streamUrl:'https://media.example/two.mp4'},{id:'embed',provider:'test',name:'Embed',type:'embed',embedUrl:'https://uqload.vc/embed-example.html'}];
 const player=window.FlixerPlayer.mount(container,{servers,startAt,onProgress:(position,duration,meta)=>progress.push({position,duration,...meta})});
 return {player,direct,embedded,progress,timers,docEvents,document};
}
test('a failed first server preserves resume time and subsequent sources start at the latest content position',async()=>{
 const f=fixture(120);assert.equal(f.direct[0].options.startAt,120);
 f.direct[0].options.onProgress({position:0,duration:1800,playing:false});assert.equal(f.progress.length,0);
 f.direct[0].resolve({reason:'failed',played:false});await settle();f.timers.find(t=>t.ms===200&&!t.cancelled).fn();
 assert.equal(f.direct[1].options.startAt,120);
 f.direct[1].options.onProgress({position:145,duration:1800,playing:true});
 f.player.switchTo(2);assert.equal(f.embedded[0].options.startAt,145);
 f.direct[1].options.onProgress({position:999,duration:1800,playing:true});assert.equal(f.progress.at(-1).position,145,'old source events cannot overwrite the replacement');
 f.embedded[0].options.onProgress({position:155,duration:1800});
 f.document.visibilityState='hidden';f.docEvents.visibilitychange();assert.equal(f.progress.at(-1).position,155);assert.equal(f.progress.at(-1).force,true);
 f.player.destroy();assert.equal(f.progress.at(-1).position,155);assert.equal(f.progress.at(-1).force,true);
});
test('closing a played native source saves its final position rather than waiting for a periodic tick',async()=>{
 const f=fixture();f.direct[0].options.onProgress({position:63,duration:1800,playing:true});f.direct[0].resolve({reason:'closed',played:true,position:65.8,duration:1800});await settle();
 assert.equal(f.progress.at(-1).position,65.8);assert.equal(f.progress.at(-1).force,true);f.player.destroy();
});
