import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const script=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/player-cleanup.js',import.meta.url),'utf8');
function fixture({url='https://cdn.example/movie.mp4',duration=1800,encrypted=false,hidden=false,hostname='player.example'}={}){
 const events={},messages=[],styles=[];class Video{};const video=Object.assign(new Video(),{paused:false,currentTime:4,duration,mediaKeys:null,currentSrc:url,parentElement:null,getBoundingClientRect:()=>({width:640,height:360,bottom:360,right:640,top:0,left:0})});
 const root={appendChild:s=>styles.push(s)},document={documentElement:root,addEventListener:(name,fn)=>events[name]=fn,getElementById:()=>styles[0],createElement:()=>({}),querySelectorAll:()=>[video]};
 const window={open:()=>{throw Error('Popup opened')},addEventListener:()=>{},FlixerPlayback:{postMessage:message=>messages.push(JSON.parse(message))}};
 vm.runInNewContext(script,{window,document,location:{hostname},MutationObserver:class{observe(){}disconnect(){}},HTMLVideoElement:Video,WeakSet,URL,innerWidth:800,innerHeight:600,getComputedStyle:()=>({display:hidden?'none':'block',visibility:'visible',opacity:'1'})});
 if(encrypted)events.encrypted?.({target:video});events.timeupdate?.({target:video});return {messages,styles,window};
}
test('player cleanup blocks popups and offers only already-playing public content media',()=>{
 const f=fixture();assert.equal(f.window.open('https://ads.example'),null);assert.ok(f.styles[0].textContent.includes('.adsbygoogle'));assert.equal(f.messages[0].type,'public-media');assert.equal(f.messages[0].url,'https://cdn.example/movie.mp4');assert.equal(f.messages[0].position,4);
 assert.equal(fixture({url:'https://cdn.example/main.m3u8?token=actual'}).messages[0].format,'hls');
 for(const options of [{url:'blob:https://player.example/id'},{url:'http://cdn.example/movie.mp4'},{duration:30},{encrypted:true},{hidden:true},{hostname:'localhost'}])assert.equal(fixture(options).messages.length,0,JSON.stringify(options));
});

test('Uqload promotional frames are hidden while video, verification and account frames stay available',()=>{
 const observers=[],timers=[],styles=[],frames=['Claim your bonus!','Confirm you are not a robot','Upgrade your account to watch videos with no limits!',''].map(text=>({contentDocument:{body:{innerText:text}},attributes:{},setAttribute(key,value){this.attributes[key]=value;}}));
 const root={appendChild:style=>styles.push(style)},events={};
 const document={documentElement:root,querySelectorAll:()=>frames,addEventListener:(name,fn)=>events[name]=fn,getElementById:()=>styles[0],createElement:()=>({})};
 vm.runInNewContext(script,{document,location:{hostname:'uqload.vc'},window:{addEventListener(){},open(){}},WeakSet,MutationObserver:class{constructor(fn){this.fn=fn;}observe(target){observers.push({target,fn:this.fn});}disconnect(){}},setTimeout:fn=>timers.push(fn)});
 while(timers.length)timers.shift()();
 assert.ok(Object.hasOwn(frames[0].attributes,'data-flixer-promotional-ad'));
 for(const frame of frames.slice(1))assert.deepEqual(frame.attributes,{});
 assert.ok(styles[0].textContent.includes('iframe[data-flixer-promotional-ad]'));
 assert.ok(styles[0].textContent.includes('#uqcs-bar'));
 assert.ok(styles[0].textContent.includes('#uqcs-box'));
 assert.ok(!styles[0].textContent.includes('#play_limit_box'));
 assert.ok(!styles[0].textContent.includes('#adbd'));
 // A later injected promotion is caught without clicking its buttons.
 frames[3].contentDocument.body.innerText='Claim your free spins';
 observers.find(o=>o.target===frames[3].contentDocument.body).fn();
 while(timers.length)timers.shift()();
 assert.ok(Object.hasOwn(frames[3].attributes,'data-flixer-promotional-ad'));
});
