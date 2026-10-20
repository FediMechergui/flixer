import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
const loadCode=source.slice(source.indexOf('    function load('),source.indexOf('\n    async function loadHls('));
test('device resolution opens native HLS, keeps the original fallback, and preserves attempted indices',async()=>{
 for(const action of ['success','empty','stale','destroyed']){
  let resolve;const pending=new Promise(r=>resolve=r),direct=[],embedded=[];
  const url='https://cybervynx.com/e/abcdefghijkl',servers=[{id:'earlier'},{id:'hg',type:'embed',embedUrl:url},{id:'later',type:'embed',embedUrl:'https://vidcore.net/movie/1'}];
  const st={generation:0,destroyed:false,attempted:new Set([0,2]),hgAttempted:new Set()};
  const context=vm.createContext({st,servers,root:{},$:()=>({}),renderBar:()=>{},teardownMedia:()=>st.generation++,showNotice:()=>{},showError:()=>{},openDirectPlayer:s=>direct.push(s.id),openNativePlayer:()=>embedded.push(st.idx),window:{FlixerBrowser:{hasNativeVideo:()=>true,hasNativePlayer:()=>true},FlixerHgSource:{supports:s=>Boolean(s.sourceEmbedUrl||s.embedUrl===url),resolve:()=>pending}}});
  vm.runInContext(loadCode+';globalThis.start=load;',context);context.start(1,true);
  if(action==='stale')st.generation++;if(action==='destroyed')st.destroyed=true;
  resolve(action==='empty'?[]:[{id:'hls2',type:'hls',streamUrl:'https://cdn.example/master.m3u8',sourceEmbedUrl:url},{id:'hls3',type:'hls',streamUrl:'https://cdn.example/second.m3u8',sourceEmbedUrl:url}]);
  await new Promise(r=>setImmediate(r));
  if(action==='success'){assert.deepEqual(direct,['hls2']);assert.equal(servers[3].id,'hg');assert.equal(st.attempted.has(4),true);assert.equal(st.attempted.has(2),false);}
  else if(action==='empty'){assert.deepEqual(embedded,[1]);assert.equal(servers.length,3);}
  else{assert.equal(direct.length,0);assert.equal(embedded.length,0);assert.equal(servers.length,3);}
 }
});
