import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{rolldown}=await import(pathToFileURL(require.resolve('rolldown',{paths:[fileURLToPath(new URL('../../client',import.meta.url))]})).href);
const built=await rolldown({input:fileURLToPath(new URL('../../scripts/browser-lulu-entry.js',import.meta.url))});
const bundle=(await built.generate({format:'iife'})).output.find(item=>item.type==='chunk').code;await built.close();
const source={id:'stardima:1',provider:'stardima',name:'StarDima LuluStream',type:'embed',embedUrl:'https://lulustream.com/e/ca89bh8wwo66',headers:{Referer:'https://v2.hyperwatching.com/watch/published','User-Agent':'Source Test/1',Authorization:'never-forward',Cookie:'never-forward'},audioLanguages:['ar']};
const moved='https://luluvdo.com/e/ca89bh8wwo66',media='https://sample.tnmr.org/hls2/03/04632/ca89bh8wwo66_h/master.m3u8?t=published';
const setup=`jwplayer("vplayer").setup({sources:[{file:${JSON.stringify(media)}}]});`,manifest='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n720p.m3u8\n';
function helper(get,extra={}){const window={navigator:{userAgent:'Test WebView/1'},Capacitor:{Plugins:{CapacitorHttp:{get}}}};vm.runInNewContext(bundle,{window,URL,setTimeout,clearTimeout,...extra});return window.FlixerLuluSource;}

test('Lulu follows only its published same-file move, verifies HLS and carries source context into native playback',async()=>{
 const calls=[],lulu=helper(async options=>{
  calls.push(options);assert.equal(options.disableRedirects,true);assert.ok(options.readTimeout<=5000);assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers.Cookie,undefined);
  if(options.url===source.embedUrl)return {status:302,data:'',headers:{Location:moved},url:options.url};
  if(options.url===moved)return {status:200,data:setup,url:moved};
  assert.equal(options.url,media);assert.equal(options.headers.Referer,moved);assert.equal(options.headers.Origin,'https://luluvdo.com');return {status:200,data:manifest,url:media};
 });
 const [rows,concurrent]=await Promise.all([lulu.resolve(source),lulu.resolve(source)]);
 assert.equal(calls.length,3,'coalesced metadata request');assert.equal(rows.length,1);assert.equal(concurrent.length,1);
 assert.equal(rows[0].type,'hls');assert.equal(rows[0].streamUrl,media);assert.equal(rows[0].embedUrl,undefined);assert.equal(rows[0].sourceEmbedUrl,source.embedUrl);assert.equal(rows[0].availability,'unverified');assert.deepEqual(rows[0].audioLanguages,['ar']);
 assert.equal(rows[0].headers.Referer,moved);assert.equal(rows[0].headers['User-Agent'],'Source Test/1');assert.equal(rows[0].headers.Authorization,undefined);
 await lulu.resolve(source);assert.equal(calls.length,3);lulu.clearCache();await lulu.resolve(source);assert.equal(calls.length,6);
});

test('Lulu retains embed fallback after denied, moved-to-another-file, oversized or non-HLS responses',async()=>{
 for(const response of [{status:403,data:'Verification required'},{status:302,data:'',headers:{Location:'https://luluvdo.com/e/otherfile123'}},{status:302,data:'',headers:{Location:'https://foreign.test/e/ca89bh8wwo66'}},{status:200,data:setup,url:'https://foreign.test/player'},{status:200,data:'x'.repeat(262145)}]){
  let calls=0;const lulu=helper(async()=>{calls++;return response;});assert.equal((await lulu.resolve(source)).length,0);assert.equal(calls,1);
 }
 let calls=0;const lulu=helper(async options=>{calls++;return {status:200,data:options.url===source.embedUrl?setup:'<html>Access denied</html>'};});
 assert.equal((await lulu.resolve(source)).length,0);assert.equal(calls,2);
 const unsupported={...source,embedUrl:'https://evil.test/e/ca89bh8wwo66'};assert.equal(lulu.supports(unsupported),false);assert.equal((await lulu.resolve(unsupported)).length,0);assert.equal(calls,2);
});

test('Lulu does not start another network request after its aggregate metadata deadline',async()=>{
 let time=100,calls=0;const lulu=helper(async()=>{calls++;time+=10001;return {status:200,data:setup};},{Date:{now:()=>time}});
 assert.equal((await lulu.resolve(source)).length,0);assert.equal(calls,1);
});

test('Lulu player integration retains the original embed if native resolution is empty or direct playback fails',async()=>{
 const sourceCode=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8'),load=sourceCode.slice(sourceCode.indexOf('    function load('),sourceCode.indexOf('\n    async function loadHls('));
 for(const available of [false,true]){
  const servers=[{...source}],st={generation:0,destroyed:false,attempted:new Set(),hgAttempted:new Set()},direct=[],embedded=[];
  const context=vm.createContext({setState:()=>{},st,servers,root:{},$:()=>({}),renderBar:()=>{},teardownMedia:()=>st.generation++,showNotice:()=>{},showError:()=>{},openDirectPlayer:s=>direct.push(s.id),openNativePlayer:()=>embedded.push(st.idx),window:{FlixerBrowser:{hasNativeVideo:()=>true,hasNativePlayer:()=>true},FlixerLuluSource:{supports:s=>Boolean(s.sourceEmbedUrl||s.embedUrl===source.embedUrl),resolve:async()=>available?[{...source,id:'direct',type:'hls',streamUrl:media,sourceEmbedUrl:source.embedUrl,embedUrl:undefined}]:[]}}});
  vm.runInContext(load+';globalThis.start=load;',context);context.start(0,true);await new Promise(resolve=>setImmediate(resolve));
  if(available){assert.deepEqual(direct,['direct']);assert.equal(servers[1].embedUrl,source.embedUrl);context.start(1,true);assert.deepEqual(embedded,[1]);}
  else{assert.deepEqual(embedded,[0]);assert.equal(servers.length,1);}
 }
});
