import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('native player recognizes a late provider content error without treating loading as failure',()=>{
 const java=fs.readFileSync(new URL('../../mobile/android/app/src/main/java/app/flixer/stream/PlayerViewPlugin.java',import.meta.url),'utf8');
 assert.ok(java.includes('WebViewCompat.addDocumentStartJavaScript(web,PlayerAdBlock.script(getContext(),"player-health.js"),origins)'),'Exercise the actual Java-injected health asset');
 const script=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/player-health.js',import.meta.url),'utf8');
 const messages=[],events={},timers=[];let observer,disconnected=false;
 const document={body:{innerText:'Fetching your content...'},addEventListener:(type,fn)=>events[type]=fn};
 const context={document,HTMLVideoElement:class {},FlixerPlayback:{postMessage:m=>messages.push(m)},
  MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){disconnected=true;}},
  setTimeout:(fn,ms)=>timers.push({fn,ms})};
 vm.runInNewContext(script,context);events.DOMContentLoaded();assert.deepEqual(messages,[]);
 // Many providers finish their content lookup after the old 15-second window.
 for(const timer of timers.filter(t=>t.ms<=31000))timer.fn();
 assert.equal(disconnected,false);document.body.innerText='(404)\nOOPS! SOMETHING WENT WRONG.\nPLEASE TRY LATER.';
 observer();assert.deepEqual(messages,['missing']);
 document.body.innerText='Video unavailable\nNo video was found for this title. Please try again later.';observer();
 document.body.innerText='404\nAN UNEXPECTED ERROR OCCURRED.\nPLEASE TRY AGAIN LATER.';observer();
 assert.deepEqual(messages,['missing','missing','missing']);
 for(const timer of timers)timer.fn();assert.equal(disconnected,true);
});
