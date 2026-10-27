import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const code=fs.readFileSync(new URL('../../client-terrarium/js/player.js',import.meta.url),'utf8');
const start=code.indexOf('  function initialIndex('),end=code.indexOf('\n  let hlsReady',start);
test('Tuniflix starts with the recovered public file player while keeping a confirmed user choice',()=>{
 const servers=[{provider:'tuniflix',name:'StreamTape',type:'embed',embedUrl:'https://watch.strp2p.site/e/public'},{provider:'tuniflix',name:'Uqload',type:'embed',embedUrl:'https://uqload.vc/embed-public.html'}];
 let preference=null;const context=vm.createContext({URL,window:{FlixerBrowser:{hasNativeVideo:()=>true},FlixerHgSource:{supports:()=>true}},localStorage:{getItem:()=>JSON.stringify(preference)}});
 vm.runInContext(code.slice(start,end)+';globalThis.choose=initialIndex;',context);
 assert.equal(context.choose(servers),1);
 preference={provider:'tuniflix',name:'StreamTape',confirmed:true};assert.equal(context.choose(servers),0);
 preference=null;assert.equal(context.choose([...servers,{provider:'tuniflix',name:'Official',type:'youtube'}]),2);
});
