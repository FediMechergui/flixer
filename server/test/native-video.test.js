import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {unifiedStream} from '../src/library-service.js';
import {parseArabicList} from '../src/arabic-providers.js';

test('Ahwak listings do not execute title-ID parsing outside its scope',()=>{
 const result=parseArabicList('ahwaktv','<ul class="pm-ul-browse-videos"><li><a href="watch.php?vid=actual123" title="Sample film"><img src="https://example.com/poster.jpg"></a></li></ul>','https://yam.ahwaktv.net/category.php?cat=movies',{kind:'film'});
 assert.equal(result.items.length,1);assert.equal(result.items[0].id,'sp:ahwaktv:m:actual123');
});

test('direct transport reaches the Myflixer resolver without changing episode identity',async()=>{
 const episode={id:'mf:m:sample',offerings:[{provider:'myflixer',id:'mf:m:sample'}]};
 const title={id:'mf:m:sample',kind:'film',episodes:[episode]};let transport;
 const result=await unifiedStream(episode.id,{showId:title.id,product:'flixer',catalog:{product:'flixer',shows:[title]},transport:'direct',resolveMyflixer:async(id,prefix,options)=>{transport=options.transport;return {servers:[{type:'hls',streamUrl:'https://cdn.example/master.m3u8'}]};}});
 assert.equal(transport,'direct');assert.equal(result.servers[0].streamUrl,'https://cdn.example/master.m3u8');
});

test('native media uses the original CDN URL, isolates progress sessions and removes its listener',async()=>{
 let progress,removed=0,request;const updates=[];
 const plugin={addListener:async(name,fn)=>{progress=fn;return{remove:async()=>removed++}},open:async args=>{request=args;progress({session:'older-player',position:9});progress({session:args.session,position:12});return{reason:'closed'}}};
 const window={Capacitor:{isNativePlatform:()=>true,Plugins:{DirectVideo:plugin}}};
 vm.runInNewContext(fs.readFileSync(new URL('../../client-terrarium/js/browser.js',import.meta.url),'utf8'),{window,URL});
 const result=await window.FlixerBrowser.openMedia({type:'hls',streamUrl:'https://backend.example/api/stream?proxy=1',rawStreamUrl:'https://cdn.example/master.m3u8'},{onProgress:s=>updates.push(s.position)});
 assert.equal(request.url,'https://cdn.example/master.m3u8');assert.deepEqual(updates,[12]);assert.equal(removed,1);assert.equal(result.reason,'closed');
 plugin.open=async()=>{throw Error('source unavailable')};await assert.rejects(()=>window.FlixerBrowser.openMedia({type:'file',streamUrl:'https://cdn.example/video.mp4'}));assert.equal(removed,2);
});

test('all fixed specialist embed host lists are accepted by the Android isolated player',()=>{
 const android=fs.readFileSync(new URL('../../mobile/android/app/src/main/java/app/flixer/stream/PlayerViewPlugin.java',import.meta.url),'utf8');
 const accepted=new Set([...android.matchAll(/"([a-z0-9.-]+\.[a-z]+)"/g)].map(m=>m[1]));
 for(const file of ['arabic-providers','french-providers','dessinanime','specialist-providers','cimafu']){
  const source=fs.readFileSync(new URL('../src/'+file+'.js',import.meta.url),'utf8');
  const lists=[...source.matchAll(/(?:embedHosts|playerHosts|hosts)\s*=\s*new Set\(\[([^\]]+)\]/g)].map(m=>m[1]);
  if(file==='cimafu')lists.push(/CIMAFU_PLAYER_HOSTS=\[([^\]]+)\]/.exec(source)?.[1]||'');
  for(const list of lists)for(const m of list.matchAll(/['"]([a-z0-9.-]+\.[a-z]+)['"]/g))assert.ok(accepted.has(m[1]),file+': '+m[1]);
 }
 assert.ok(accepted.has('www.animegg.org'));
 assert.ok(accepted.has('sv2.nontongo.stream'));
 assert.ok(accepted.has('sv4.nontongo.day'));
 assert.ok(accepted.has('vidfast.vc'));
});

test('native source errors advance, closing exits, and stale closes do neither',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
 const start=source.indexOf('    async function openNativePlayer('),end=source.indexOf("\n    $('[data-browser-player]'",start);
 for(const reason of ['failed','next','closed'])for(const stale of [false,true]){
  let finish,failed=0,exited=0;const pending=new Promise(resolve=>finish=resolve);
  const st={idx:0,generation:0,destroyed:false},stage={innerHTML:''};
  const context=vm.createContext({st,stage,servers:[{embedUrl:'https://vidsrc.mov/embed/movie/77'}],opts:{onExit:()=>exited++},failover:()=>failed++,teardownMedia:()=>st.generation++,showNotice:()=>{},window:{FlixerBrowser:{openPlayer:()=>pending}}});
  vm.runInContext(source.slice(start,end)+';globalThis.run=openNativePlayer;',context);
  const task=context.run();if(stale){st.generation++;stage.innerHTML='new source';}finish({reason});await task;
  assert.equal(failed,stale||reason==='closed'?0:1);assert.equal(exited,!stale&&reason==='closed'?1:0);if(stale)assert.equal(stage.innerHTML,'new source');
 }
});

test('a public media handoff preserves its position and failed handoffs restore the embedded source once',async()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
 const start=source.indexOf('    async function openDirectPlayer('),end=source.indexOf('\n    function load(',start);
 for(const reason of ['failed','next','closed']){
  let restored=0,failed=0,exited=0,position;
  const context=vm.createContext({st:{generation:1,destroyed:false},stage:{innerHTML:''},opts:{startAt:0,onExit:()=>exited++},openNativePlayer:capture=>{assert.equal(capture,false);restored++},failover:()=>failed++,window:{FlixerBrowser:{openMedia:async(s,o)=>{position=o.startAt;return {reason}}}}});
  vm.runInContext(source.slice(start,end)+';globalThis.run=openDirectPlayer;',context);await context.run({startAt:24,nativeFallbackEmbed:true});
  assert.equal(position,24);assert.equal(restored,reason==='failed'?1:0);assert.equal(failed,reason==='next'?1:0);assert.equal(exited,reason==='closed'?1:0);
 }
});
