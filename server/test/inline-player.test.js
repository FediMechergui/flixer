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
