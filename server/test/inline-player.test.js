import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../client-terrarium/js/browser.js',import.meta.url),'utf8');
test('the APK excludes stale French premium slots from hosted or cached server lists',()=>{
 const player=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
 const start=player.indexOf('  const publicServers='),end=player.indexOf('  function mount(',start),context=vm.createContext({});
 vm.runInContext(player.slice(start,end)+';globalThis.filter=publicServers;',context);
 const free={id:'frenchstream:vidzy:vf'},other={id:'cimafu:1'};
 assert.deepEqual(Array.from(context.filter([{id:'frenchstream:premium:vf'},free,null,other])),[free,other]);
 assert.deepEqual(Array.from(context.filter(null)),[]);
});
test('native playback carries inline geometry and closes an older surface before opening its replacement',async()=>{
 const events=[],requests=[],plugin={close:async()=>events.push('close'),open:async options=>{events.push('open');requests.push(options);return {reason:'closed'};},updateBounds:async options=>events.push(options),setFullscreen:async options=>events.push(options)};
 const window={Capacitor:{isNativePlatform:()=>true,Plugins:{PlayerView:plugin}}};
 vm.runInNewContext(source,{window,URL,Promise});
 const bounds={x:12,y:180,width:336,height:189,viewportWidth:360};
 await window.FlixerBrowser.openPlayer('https://vidfast.pro/movie/12',{bounds});
 assert.deepEqual(events.slice(0,2),['close','open']);assert.equal(requests[0].bounds,bounds);
 await window.FlixerBrowser.updatePlayerBounds({...bounds,y:80});assert.equal(events.at(-1).bounds.y,80);
 await window.FlixerBrowser.fullscreenPlayer();assert.equal(events.at(-1).fullscreen,true);
});
test('navigating away during native close cannot reopen a cancelled player',async()=>{
 let finish,opened=0;const closing=new Promise(resolve=>finish=resolve);
 const plugin={close:()=>closing,open:async()=>{opened++;}};
 const window={Capacitor:{isNativePlatform:()=>true,Plugins:{PlayerView:plugin}}};
 vm.runInNewContext(source,{window,URL,Promise});
 const pending=window.FlixerBrowser.openPlayer('https://vidfast.pro/movie/12');
 const cancelled=assert.rejects(pending,/Player changed/);
 const navigation=window.FlixerBrowser.closePlayers();finish();await navigation;await cancelled;
 assert.equal(opened,0);
});

test('native media forwards source captions and User-Agent together with the video',async()=>{
 let request;const subtitles=[{url:'https://ndisk.wcostream.com/getvid?evid=actual-captions',mimeType:'text/vtt',language:'en'}],headers={'User-Agent':'Flixer (Android)'};
 const plugin={close:async()=>{},addListener:async()=>({remove:async()=>{}}),open:async options=>{request=options;return {reason:'closed'};}};
 const window={Capacitor:{isNativePlatform:()=>true,Plugins:{DirectVideo:plugin}}};vm.runInNewContext(source,{window,URL,Promise,Math,Date});
 await window.FlixerBrowser.openMedia({type:'mp4',streamUrl:'https://ndisk.wcostream.com/getvid?evid=actual-video',headers,subtitles});
 assert.equal(request.subtitles,subtitles);assert.equal(request.headers,headers);
});

test('embedded progress is isolated to its native session and the listener is removed on close',async()=>{
 let listener,request,finish,removed=0;const progress=[];
 const plugin={close:async()=>{},addListener:async(name,fn)=>{listener=fn;return {remove:async()=>removed++};},open:options=>{request=options;return new Promise(resolve=>finish=resolve);}};
 const window={Capacitor:{isNativePlatform:()=>true,Plugins:{PlayerView:plugin}}};vm.runInNewContext(source,{window,URL,Promise,Math,Date});
 const pending=window.FlixerBrowser.openPlayer('https://uqload.vc/embed-example.html',{startAt:120,onProgress:state=>progress.push(state)});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(request.startAt,120);
 listener({session:'old-session',position:800,duration:1800});assert.equal(progress.length,0);
 listener({session:request.session,position:125,duration:1800});assert.equal(progress[0].position,125);
 finish({reason:'closed'});await pending;assert.equal(removed,1);
});
