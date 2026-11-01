import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
const start=code.indexOf('  function initialIndex('),end=code.indexOf('\n  let hlsReady',start);
test('Tuniflix starts with the recovered public file player while keeping a confirmed user choice',()=>{
 const servers=[{provider:'tuniflix',name:'StreamTape',type:'embed',embedUrl:'https://watch.strp2p.site/e/public'},{provider:'tuniflix',name:'Uqload',type:'embed',embedUrl:'https://uqload.vc/embed-public.html'}];
 let preference=null;const context=vm.createContext({URL,window:{FlixerBrowser:{hasNativeVideo:()=>true},FlixerHgSource:{supports:()=>true}},localStorage:{getItem:()=>JSON.stringify(preference)}});
 vm.runInContext(code.slice(start,end)+';globalThis.choose=initialIndex;',context);
 assert.equal(context.choose(servers),1);
 assert.equal(context.choose([...servers,{provider:'dessinanime',name:'Unresolved relay',type:'dessinanime',playerId:123}]),1);
 preference={provider:'tuniflix',name:'StreamTape',confirmed:true};assert.equal(context.choose(servers),0);
 preference=null;assert.equal(context.choose([...servers,{provider:'tuniflix',name:'Official',type:'youtube'}]),2);
});

test('documented VidFast alternatives start before unconfirmed wrappers without overriding a confirmed choice',()=>{
 let preference=null;
 const context=vm.createContext({URL,window:{FlixerBrowser:{hasNativeVideo:()=>true}},localStorage:{getItem:()=>JSON.stringify(preference)}});
 vm.runInContext(code.slice(start,end)+';globalThis.choose=initialIndex;',context);
 const servers=[{provider:'fmovies',name:'Embos',type:'embed',embedUrl:'https://embos.top/movie/?mid=12'},{provider:'vidfast',name:'VidFast',type:'embed',resolution:'documented-provider-route',embedUrl:'https://vidfast.pro/movie/12?autoPlay=true'}];
 assert.equal(context.choose(servers),1);
 preference={provider:'fmovies',name:'Embos',confirmed:true};assert.equal(context.choose(servers),0);
 preference=null;assert.equal(context.choose([...servers,{provider:'official',name:'Official file',type:'mp4'}]),2);
});
