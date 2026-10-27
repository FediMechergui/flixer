import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/player-progress.js',import.meta.url),'utf8');
function fixture({startAt=0,ad=false,hidden=false,duration=1800}={}){
 const events={},windowEvents={},messages=[];let now=10000;
 class Video{}const video=Object.assign(new Video(),{currentTime:0,duration,readyState:1,paused:true,seeking:false,parentElement:null,closest:()=>ad?{}:null,getBoundingClientRect:()=>({width:640,height:360,top:0,left:0,bottom:360,right:640})});
 const document={querySelectorAll:()=>[video],addEventListener:(name,fn)=>events[name]=fn,visibilityState:'visible'};
 vm.runInNewContext(source.replace('/*FLIXER_START_AT*/0',String(startAt)),{document,window:{addEventListener:(name,fn)=>windowEvents[name]=fn},HTMLVideoElement:Video,innerWidth:720,innerHeight:1560,getComputedStyle:()=>({display:hidden?'none':'block',visibility:'visible',opacity:'1'}),FlixerPlayback:{postMessage:m=>messages.push(JSON.parse(m))},Date:{now:()=>now},WeakSet,WeakMap});
 return {video,document,messages,fire:name=>events[name]({target:video}),tick:ms=>now+=ms,hide:()=>{document.visibilityState='hidden';events.visibilitychange();},windowEvents};
}
test('embedded content seeks once, reports playback and flushes pause/background without resetting a later rewind',()=>{
 const f=fixture({startAt:120});f.fire('loadedmetadata');assert.equal(f.video.currentTime,120);assert.equal(f.messages.length,0);
 f.video.paused=false;f.video.currentTime=123;f.fire('timeupdate');assert.equal(f.messages[0].position,123);
 f.video.currentTime=124;f.fire('timeupdate');assert.equal(f.messages.length,1);
 f.video.paused=true;f.fire('pause');assert.equal(f.messages.at(-1).final,true);assert.equal(f.messages.at(-1).position,124);
 f.video.currentTime=80;f.hide();assert.equal(f.messages.at(-1).position,80,'user rewind is preserved');
 f.video.currentTime=1800;f.fire('ended');assert.equal(f.messages.at(-1).ended,true);
});
test('advertising, hidden videos, idle metadata and invalid/live durations do not overwrite content progress',()=>{
 for(const options of [{ad:true},{hidden:true},{duration:15},{duration:Infinity},{duration:NaN}]){const f=fixture(options);f.video.paused=false;f.video.currentTime=4;f.fire('timeupdate');assert.equal(f.messages.length,0,JSON.stringify(options));}
 const f=fixture();f.video.currentTime=120;f.fire('pause');assert.equal(f.messages.length,0,'a prepared but unplayed source does not count');
});
