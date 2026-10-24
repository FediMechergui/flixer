import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const java=fs.readFileSync(new URL('../../mobile/android/app/src/main/java/app/flixer/stream/PlayerViewPlugin.java',import.meta.url),'utf8');
assert.ok(java.includes('WebViewCompat.addDocumentStartJavaScript(web,PlayerAdBlock.script(getContext(),"player-health.js"),origins)'));
const script=fs.readFileSync(new URL('../../mobile/android/app/src/main/assets/player-health.js',import.meta.url),'utf8');
function messages(text){const out=[],listeners=new Map();const context=vm.createContext({FlixerPlayback:{postMessage:message=>out.push(message)},document:{body:{innerText:text},addEventListener:(name,fn)=>listeners.set(name,fn)},MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>{},HTMLVideoElement:class{}});vm.runInContext(script,context);listeners.get('DOMContentLoaded')();return out;}
test('Android error-page health detects the soft-404 layouts observed on Embos and VidAPI',()=>{
 assert.deepEqual(messages('🔍\n404\nPage Not Found\nThe page you are looking for does not exist.'),['missing']);
 assert.deepEqual(messages('Series (S01E01)\n404 — Page Not Found\nPlease return to the home page.'),['missing']);
 assert.deepEqual(messages("We Couldn't Find This Content Or Episode Is Not Available."),['missing']);
 for(const text of ['Видеофайл не найден.\nОткрыть ВКонтакте','Video source is unavailable.','Error loading player: No playable sources found','404\nThe page you were looking for is not here.',"Video has been blocked due to author's rights infingement",'File is no longer available as it expired or has been deleted.',"We Couldn't Find This Content .\nPlease check back another time.",'Remove sandboxing to enable playback.'])assert.deepEqual(messages(text),['missing'],text);
});
test('ordinary content, browser verification and long synopsis pages do not become missing-file signals',()=>{
 for(const text of ['Movie 404 — a story about a detective','Checking your browser. Verify you are human.','404 Page Not Found\n'+('Long plot '.repeat(300))])assert.deepEqual(messages(text),[]);
});
