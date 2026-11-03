import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {playerSnapshot,canPressPlay} from '../../scripts/player-snapshot.js';
function snapshot({label='Play',size=40,hidden=false,ad=false,explicit=false}={}){const button={getBoundingClientRect:()=>({x:10,y:20,width:size,height:size}),getAttribute:name=>name==='aria-label'?label:null,matches:()=>explicit,closest:()=>ad?{}:null};return vm.runInNewContext('('+playerSnapshot.toString()+')()',{document:{body:{innerText:'Player'},querySelectorAll:selector=>selector==='video'?[]:[button]},location:{href:'https://player.example/embed'},getComputedStyle:()=>({display:'block',visibility:hidden?'hidden':'visible',opacity:'1'})})}
test('a standard 40-pixel Play control is actionable without treating it as a video',()=>{const result=snapshot();assert.deepEqual(JSON.parse(JSON.stringify(result.play)),{x:30,y:40});assert.equal(result.videos.length,0);assert.ok(snapshot({label:'Play (k)'}).play)});
test('hidden, advertising, pause and unrelated player-option controls are not tapped',()=>{for(const options of [{hidden:true},{ad:true},{label:'Player options'},{label:'Play on TV'},{label:'Pause',explicit:true},{size:1}])assert.equal(snapshot(options).play,null)});
test('ordinary play interaction excludes publisher verification and premium prompts',()=>{for(const text of ["Antispam: I'm not a robot",'Checking your browser','CAPTCHA: Play audio','Premium required'])assert.equal(canPressPlay(text),false);assert.equal(canPressPlay('Video ready'),true)});
test('YouTube snapshots capture the actual player title separately from recommendations',()=>{
 const read=(url,titleLink,title)=>vm.runInNewContext('('+playerSnapshot.toString()+')()',{document:{title,body:{innerText:'Actual episode\nRecommended OFFICIAL TRAILER'},querySelector:selector=>selector==='.ytp-title-link'&&titleLink?{textContent:titleLink}:null,querySelectorAll:()=>[]},location:{href:url},getComputedStyle:()=>({})});
 const url='https://www.youtube.com/embed/aBxBjNbKETU?autoplay=1';
 assert.equal(read(url,'STARTUP | OFFICIAL TRAILER','YouTube').videoTitle,'STARTUP | OFFICIAL TRAILER');
 assert.equal(read(url,null,'Actual episode - YouTube').videoTitle,'Actual episode');
 assert.equal(read(url,null,'YouTube').videoTitle,undefined);
 assert.equal(read('https://player.example/embed/title','OFFICIAL TRAILER','OFFICIAL TRAILER').videoTitle,undefined);
});
test('ordinary Play remains available with a passive badge, while active challenges stay excluded',()=>{
 assert.equal(canPressPlay('Play\nprotected by reCAPTCHA'),true);
 for(const text of ["protected by reCAPTCHA\nI'm not a robot",'protected by reCAPTCHA\nComplete the CAPTCHA challenge','protected by reCAPTCHA\nVerify you are human'])assert.equal(canPressPlay(text),false);
});
