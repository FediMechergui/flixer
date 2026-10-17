import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('native failure reporting and accepted player messages cover the same trusted origins',()=>{
 const player=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8'),activity=fs.readFileSync(new URL('../../mobile/android/app/src/main/java/app/flixer/stream/MainActivity.java',import.meta.url),'utf8');
 const list=/const trusted=\[([^\]]+)\]/.exec(player)?.[1];assert.ok(list);
 const origins=[...list.matchAll(/["'](https:\/\/[^"']+)["']/g)].map(m=>m[1]);assert.ok(origins.includes('https://engifuosi.com'));assert.ok(origins.includes('https://vidsrc.mov'));for(const origin of origins)assert.ok(activity.includes('"'+origin+'"'),origin+' must have native health reporting');
 assert.ok(player.includes('event.source!==frame.contentWindow'));assert.ok(player.includes('data-close-player'));
});

// Exercise the actual handoff function with a deferred native close response.
import vm from 'node:vm';
test('closing an older native player cannot overwrite a newer server or a destroyed player',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
 const start=source.indexOf('    async function openNativePlayer()');
 const end=source.indexOf("\n    $('[data-browser-player]'",start);
 for(const action of ['switch','destroy','current']) {
  let finish;const pending=new Promise(resolve=>{finish=resolve;});
  const st={idx:0,generation:0,destroyed:false},stage={innerHTML:''};
  const context=vm.createContext({st,stage,servers:[{embedUrl:'https://example.test/player'}],teardownMedia:()=>{st.generation++;},showNotice:()=>{},window:{FlixerBrowser:{openPlayer:()=>pending}}});
  vm.runInContext(source.slice(start,end)+';globalThis.openNativePlayer=openNativePlayer;',context);
  const opening=context.openNativePlayer();
  if(action==='switch'){st.generation++;stage.innerHTML='new server';}
  if(action==='destroy'){st.destroyed=true;stage.innerHTML='';}
  finish();await opening;
  assert.equal(stage.innerHTML,action==='switch'?'new server':action==='destroy'?'':'<div class="player__loading">Choose a source above to continue.</div>');
 }
});
