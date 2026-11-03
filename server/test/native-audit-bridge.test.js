import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installNativeAuditBridge} from '../../scripts/native-audit-bridge.js';

test('audit wrappers attribute callbacks to each native invocation without changing production callbacks',async()=>{
 const calls=[],updates=[];
 const open=async(value,options)=>new Promise(resolve=>calls.push({value,options,resolve}));
 const window={FlixerBrowser:{openPlayer:open,openMedia:open},__auditAttempt:7,__auditNativeProgress:[],__auditNativeResults:[]};
 const context=vm.createContext({window});vm.runInContext('('+installNativeAuditBridge.toString()+')()',context);
 const first=window.FlixerBrowser.openPlayer('https://emmmmbed.com/embed/real',{onProgress:state=>updates.push(state.position)});
 calls[0].options.onProgress({position:0.108,duration:1400,playing:true});
 const second=window.FlixerBrowser.openMedia({streamUrl:'https://example.org/real.mp4'},{onProgress:state=>updates.push(state.position)});
 calls[1].options.onProgress({position:4.086,duration:1400,playing:true});
 assert.equal(window.__auditNativeProgress[0].transport,'webview');assert.equal(window.__auditNativeProgress[1].transport,'media3');
 assert.notEqual(window.__auditNativeProgress[0].invocation,window.__auditNativeProgress[1].invocation);
 assert.deepEqual(updates,[0.108,4.086]);
 vm.runInContext('('+installNativeAuditBridge.toString()+')()',context);
 calls[1].options.onProgress({position:5.1,duration:1400,playing:true});assert.equal(window.__auditNativeProgress.length,3,'Installing twice does not duplicate callbacks');
 window.__auditAttempt=8;calls[0].options.onProgress({position:10,duration:1400,playing:true});assert.equal(window.__auditNativeProgress.length,3,'Old attempts cannot populate new proof');
 calls[0].resolve({reason:'closed'});calls[1].resolve({reason:'closed'});await Promise.all([first,second]);
 assert.equal(window.__auditNativeResults.length,0,'Old attempts cannot populate new results');
});

test('a retained old debug wrapper does not duplicate completed invocation results',async()=>{
 const result={reason:'closed'},window={__auditAttempt:1,__auditWrapped:true,__auditNativeProgress:[],__auditNativeResults:[]};
 window.FlixerBrowser={openPlayer:async()=>{window.__auditNativeResults.push({surface:'openPlayer',result});return result;},openMedia:async()=>result};
 vm.runInNewContext('('+installNativeAuditBridge.toString()+')()',{window});
 await window.FlixerBrowser.openPlayer('https://example.org/embed');
 assert.equal(window.__auditNativeResults.length,1);assert.equal(window.__auditNativeResults[0].transport,'webview');
 assert.ok(window.__auditNativeResults[0].invocation);
});
