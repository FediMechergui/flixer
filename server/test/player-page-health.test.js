import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const java=fs.readFileSync(new URL('../../mobile/android/app/src/main/java/app/flixer/stream/PlayerViewPlugin.java',import.meta.url),'utf8');
const literal=java.match(/WebViewCompat\.addDocumentStartJavaScript\(web,("(?:\\.|[^"\\])*"),origins\);/)[1],script=JSON.parse(literal);
function messages(text){const out=[],listeners=new Map();const context=vm.createContext({FlixerPlayback:{postMessage:message=>out.push(message)},document:{body:{innerText:text},addEventListener:(name,fn)=>listeners.set(name,fn)},MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>{},HTMLVideoElement:class{}});vm.runInContext(script,context);listeners.get('DOMContentLoaded')();return out;}
test('Android error-page health detects the soft-404 layouts observed on Embos and VidAPI',()=>{
 assert.deepEqual(messages('🔍\n404\nPage Not Found\nThe page you are looking for does not exist.'),['missing']);
 assert.deepEqual(messages('Series (S01E01)\n404 — Page Not Found\nPlease return to the home page.'),['missing']);
 assert.deepEqual(messages("We Couldn't Find This Content Or Episode Is Not Available."),['missing']);
});
test('ordinary content, browser verification and long synopsis pages do not become missing-file signals',()=>{
 for(const text of ['Movie 404 — a story about a detective','Checking your browser. Verify you are human.','404 Page Not Found\n'+('Long plot '.repeat(300))])assert.deepEqual(messages(text),[]);
});
