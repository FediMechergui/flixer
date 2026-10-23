import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const player=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8'),start=player.indexOf("    $('[data-refresh-sources]'"),end=player.indexOf('\n    async function openDirectPlayer(',start),code=player.slice(start,end);

test('manual source refresh replaces stale alternatives while preserving active playback',async()=>{
 for(const keep of [true,false]){
  let handler,loaded=false;const active={id:'active',name:'old name',embedUrl:'https://source.example/active'},servers=[active,{id:'stale',embedUrl:'https://source.example/old'}],st={idx:0,generation:1,sourceErrors:new Map()},button={disabled:false,setAttribute(){},removeAttribute(){}};
  const fresh=[...(keep?[{...active,name:'updated name'}]:[]),{id:'new',embedUrl:'https://source.example/new'}];
  const context=vm.createContext({st,servers,root:{},stage:{},publicServers:r=>r,opts:{onRetry:async()=>({servers:fresh})},$:selector=>selector==='[data-refresh-sources]'?{addEventListener:(_,fn)=>handler=fn}:null,resetHgSources:()=>{},renderBar:()=>{},showNotice:()=>{},load:()=>loaded=true,Set});vm.runInContext(code,context);await handler({currentTarget:button});
  assert.equal(loaded,false,'refresh must not interrupt working playback');assert.equal(servers.some(s=>s.id==='stale'),false);assert.ok(servers.some(s=>s.id==='new'));assert.equal(servers[st.idx].id,'active');assert.equal(servers[0].name,keep?'updated name':'old name');assert.equal(button.disabled,false);
 }
});

test('late or empty refresh responses cannot replace a newer source or clear working choices',async()=>{
 for(const stale of [false,true]){
  let handler,resolve;const st={idx:0,generation:1},servers=[{id:'playing'}],button={disabled:false,setAttribute(){},removeAttribute(){}},pending=new Promise(r=>resolve=r);
  const context=vm.createContext({st,servers,root:{},stage:{},publicServers:r=>r||[],opts:{onRetry:()=>pending},$:selector=>selector==='[data-refresh-sources]'?{addEventListener:(_,fn)=>handler=fn}:null,resetHgSources:()=>{},renderBar:()=>{},showNotice:()=>{},Set});vm.runInContext(code,context);const request=handler({currentTarget:button});if(stale)st.generation++;resolve({servers:stale?[{id:'obsolete'}]:[]});await request;assert.deepEqual(servers,[{id:'playing'}]);
 }
});

test('WCO observes normal fetch configuration without replacing requests or source responses',async()=>{
 const script=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/wco-source.js',import.meta.url),'utf8'),messages=[],calls=[];let clones=0;
 const response={ok:true,clone:()=>{clones++;return {json:async()=>({server:'https://lb.wcostream.com',enc:'published-token'})}}};
 class XHR{open(){}addEventListener(){}}
 const window={addEventListener(){},fetch:(...args)=>{calls.push(args);return Promise.resolve(response)}};
 vm.runInNewContext(script,{window,location:{hostname:'embed.wcostream.com',origin:'https://embed.wcostream.com',href:'https://embed.wcostream.com/inc/embed/video-js.php'},document:{querySelector:()=>null},XMLHttpRequest:XHR,URL,FlixerWcoResult:{postMessage:m=>messages.push(JSON.parse(m))},setInterval:()=>1,clearInterval(){}});
 const options={headers:{'X-Publisher':'unchanged'}};assert.equal(await window.fetch('/inc/embed/getvidlink.php?v=source',options),response);await new Promise(r=>setImmediate(r));assert.equal(messages[0].configuration.enc,'published-token');assert.deepEqual(calls[0],['/inc/embed/getvidlink.php?v=source',options]);
 await window.fetch('https://other.example/inc/embed/getvidlink.php');await new Promise(r=>setImmediate(r));assert.equal(clones,1);
});
