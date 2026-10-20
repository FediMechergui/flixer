import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {unifiedStream} from '../src/library-service.js';
const require=createRequire(import.meta.url),{rolldown}=await import(pathToFileURL(require.resolve('rolldown',{paths:[fileURLToPath(new URL('../../client',import.meta.url))]})).href);
const built=await rolldown({input:fileURLToPath(new URL('../../scripts/browser-hg-entry.js',import.meta.url))});
const bundle=(await built.generate({format:'iife'})).output.find(item=>item.type==='chunk').code;await built.close();
function helper(get){const window={Capacitor:{Plugins:{CapacitorHttp:{get}}}};vm.runInNewContext(bundle,{window,URL,setTimeout,clearTimeout});return window.FlixerHgSource;}
test('device HG resolves public HLS on the device, preserves source identity, and avoids arbitrary CDN requests',async()=>{
 const calls=[],source={id:'cimafu:6',name:'Arabic source',provider:'cimafu',type:'embed',embedUrl:'https://cybervynx.com/e/abcdefghijkl',subtitleLanguages:['ar']};
 const hg=helper(async options=>{calls.push(options);assert.deepEqual(Object.keys(options.headers),['Accept']);assert.equal(options.disableRedirects,true);
  return {status:200,data:options.url.includes('hglamioz')?'var links={hls2:"https://s1.premilkyway.com/master.m3u8?token=published",hls3:"https://unrelated.example/master.m3u8"};':'#EXTM3U\n#EXTINF:10,\nsegment.ts\n'};
 });
 const rows=await hg.resolve(source);assert.equal(rows.length,1);assert.equal(rows[0].type,'hls');assert.equal(rows[0].sourceEmbedUrl,source.embedUrl);assert.deepEqual(rows[0].subtitleLanguages,['ar']);assert.equal(rows[0].deviceResolved,true);assert.equal(calls.length,2);
 await hg.resolve(source);assert.equal(calls.length,2,'Metadata is cached independently of media segments');
 hg.clearCache();await hg.resolve(source);assert.equal(calls.length,4,'Explicit server refresh obtains new source metadata');
});
test('device HG never fetches unsupported source URLs or treats an HTML gate as a manifest',async()=>{
 let calls=0;const hg=helper(async options=>{calls++;return {status:200,data:options.url.includes('hglamioz')?'var links={hls2:"https://s1.premilkyway.com/master.m3u8"};':'<html>Access denied</html>'};});
 assert.equal(hg.supports({embedUrl:'https://evil.example/e/abcdefghijkl'}),false);
 assert.equal((await hg.resolve({embedUrl:'https://evil.example/e/abcdefghijkl'})).length,0);assert.equal(calls,0);
 assert.equal((await hg.resolve({id:'x',name:'x',embedUrl:'https://cybervynx.com/e/abcdefghijkl'})).length,0);assert.equal(calls,2);
});

test('a stalled secondary mirror cannot delay a verified device manifest',async()=>{
 let release,settled=false;const slow=new Promise(resolve=>release=resolve);
 const hg=helper(async options=>options.url.includes('hglamioz')?{status:200,data:'var links={hls2:"https://s1.premilkyway.com/master.m3u8",hls3:"https://s1.riskanalytics.cfd/master.m3u8"};'}:options.url.includes('riskanalytics')?slow:{status:200,data:'#EXTM3U\n#EXTINF:10,\nsegment.ts\n'});
 const pending=hg.resolve({id:'x',name:'x',embedUrl:'https://cybervynx.com/e/abcdefghijkl'}).then(rows=>{settled=true;return rows;});
 await new Promise(resolve=>setImmediate(resolve));
 try{assert.equal(settled,true);assert.equal((await pending).length,1);}finally{release({status:403,data:'Access denied'});}
});
test('native specialist playback propagates direct transport to avoid hosted HG metadata work',async()=>{
 const id='sp:cimafu:e:'+Buffer.from('/episode-1/').toString('base64url'),title={id:'title',kind:'series',episodes:[{id,offerings:[{provider:'cimafu',id}]}]};let received;
 await unifiedStream(id,{showId:'title',product:'flixer',transport:'direct',catalog:{shows:[title]},resolveSpecialist:async(_,options)=>{received=options;return [];}});
 assert.equal(received.transport,'direct');
});
test('native initial selection prefers a resolvable HG source over opaque embeds while preserving explicit confirmed preferences',()=>{
 const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8'),start=source.indexOf('  function initialIndex('),end=source.indexOf('\n  let hlsReady',start);
 const context=vm.createContext({window:{FlixerBrowser:{hasNativeVideo:()=>true},FlixerHgSource:{supports:s=>s.id==='hg'}},localStorage:{getItem:()=>null}});
 vm.runInContext(source.slice(start,end)+';globalThis.choose=initialIndex;',context);
 const servers=[{id:'opaque',provider:'one',name:'Old',type:'embed'},{id:'hg',provider:'two',name:'HG',type:'embed'}];assert.equal(context.choose(servers),1);
 context.localStorage.getItem=()=>JSON.stringify({confirmed:true,provider:'one',name:'Old'});assert.equal(context.choose(servers),0);
});
