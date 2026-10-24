// Run each freshly resolved server through the production Android player.
// Private checkpoints retain source URLs. Published summaries must omit them.
import fs from 'node:fs';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {auditServer} from './audit-server.js';
import {observeVideoClock} from './playback-proof.js';
const run=promisify(execFile),args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const dir=path.resolve(opt('--out','artifacts/provider-device-audit-2026-10-24')),input=path.join(dir,'resolved.private.json'),output=path.join(dir,'device.private.json');
const serial=opt('--serial','emulator-5558'),port=Number(opt('--port','9226')),seconds=Number(opt('--seconds','35')),pkg='app.flixer.stream.audit',adb=opt('--adb',path.join(process.env.LOCALAPPDATA||'','Android/Sdk/platform-tools/adb.exe'));
const selected=new Set(opt('--cases','').split(',').filter(Boolean).map(Number));
const report=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{startedAt:new Date().toISOString(),serial,seconds,scope:'Every returned server for the provider/type/language sample matrix, using the production player; not every catalogue episode.',cases:[]};
if(args.includes('--retest')){
 if(!selected.size)throw Error('--retest requires explicit --cases');
 report.previousAttempts=[...(report.previousAttempts||[]),...report.cases.filter(row=>selected.has(row.case))];
 report.cases=report.cases.filter(row=>!selected.has(row.case));
}
delete report.finishedAt;delete report.pausedAt;
const pause=ms=>new Promise(r=>setTimeout(r,ms)),save=()=>{fs.writeFileSync(output+'.tmp',JSON.stringify(report,null,2));fs.renameSync(output+'.tmp',output)};
async function shell(...params){return(await run(adb,['-s',serial,...params],{timeout:20000,windowsHide:true,maxBuffer:1024*1024})).stdout.trim()}
async function pages(){const r=await fetch('http://127.0.0.1:'+port+'/json',{signal:AbortSignal.timeout(5000)});return r.json()}
async function connect(page){const socket=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),listeners=new Set();let id=0;
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Debugger connection timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Debugger connection failed'))},{once:true})});
 socket.addEventListener('message',event=>{const row=JSON.parse(String(event.data)),task=pending.get(row.id);if(task){clearTimeout(task.timer);pending.delete(row.id);row.error?task.reject(Error(row.error.message)):task.resolve(row.result)}else if(row.method)for(const listener of listeners)listener(row)});
 return {page,on:fn=>listeners.add(fn),off:fn=>listeners.delete(fn),send(method,params={},timeout=10000){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method+' timed out'))},timeout);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}))})},async evaluate(expression,contextId,timeout=10000){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,...(contextId?{contextId}:{})},timeout);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value},close(){socket.close();for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('Debugger closed'))}pending.clear()}};
}
async function app(restart=false){if(restart)await shell('shell','am','force-stop',pkg);await shell('shell','am','start','-n',pkg+'/app.flixer.stream.PlayerAuditActivity');
 for(let i=0;i<45;i++){try{const pid=await shell('shell','pidof',pkg);await shell('forward','tcp:'+port,'localabstract:webview_devtools_remote_'+pid);const page=(await pages()).find(p=>p.url.includes('/playback-audit.html'));if(page){const c=await connect(page);if(await c.evaluate('Boolean(window.FlixerPlayer&&window.FlixerBrowser&&window.Capacitor?.Plugins?.DirectVideo)'))return c;c.close()}}catch{}await pause(1000)}throw Error('Android audit bridge unavailable');
}
const snapshot=`(()=>{const visible=e=>{const b=e.getBoundingClientRect();return b.width>80&&b.height>40&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'};const videos=[...document.querySelectorAll('video')].filter(visible).map((v,index)=>({index,time:v.currentTime,duration:Number.isFinite(v.duration)?v.duration:0,paused:v.paused,src:v.currentSrc,error:v.error?.code||null,ad:!!v.closest('.ytp-ad-showing,[class*=ad-container]')}));const play=[...document.querySelectorAll('button[aria-label],.vjs-big-play-button,.jw-icon-playback,.plyr__control--overlaid,.ytp-large-play-button')].find(e=>visible(e)&&(/play/i.test(e.getAttribute('aria-label')||'')||e.matches('.vjs-big-play-button,.jw-icon-playback,.plyr__control--overlaid,.ytp-large-play-button')));const v=[...document.querySelectorAll('video')].find(v=>visible(v)&&v.paused&&v.currentSrc),box=(play||v)?.getBoundingClientRect();return {url:location.href,text:(document.body?.innerText||'').slice(0,800),videos,play:box?{x:box.x+box.width/2,y:box.y+box.height/2}:null}})()`;
function observe(c,result){const contexts=new Map(),requests=new Map(),listener=({method,params:p})=>{
 if(method==='Runtime.executionContextCreated'&&p.context.auxData?.isDefault)contexts.set(p.context.id,p.context.auxData.frameId);
 if(method==='Runtime.executionContextDestroyed')contexts.delete(p.executionContextId);if(method==='Runtime.executionContextsCleared')contexts.clear();
 if(method==='Network.requestWillBeSent')requests.set(p.requestId,p.request.url);
 if(method==='Network.responseReceived'&&p.response.status>=400&&result.network.length<80)result.network.push({status:p.response.status,url:p.response.url,type:p.type});
 if(method==='Network.loadingFailed'&&result.network.length<80)result.network.push({error:p.errorText,url:requests.get(p.requestId),type:p.type});
 };c.on(listener);contexts.dispose=()=>c.off(listener);return contexts;
}
async function enable(c){for(const method of ['Runtime.enable','Page.enable','Network.enable'])await c.send(method)}
function classify(result){if(result.playbackConfirmed)return 'playback_confirmed';if(result.infrastructureError)return 'infrastructure_error';const text=[result.playerError,...result.nativeResults.map(r=>r.error||r.result?.error||''),...result.observations.map(s=>s.text)].join(' ');
 if(/verify.{0,40}human|captcha|checking your browser|verification required/i.test(text))return 'verification_required';
 if(/(?:file|video).{0,20}(?:not found|deleted|removed)|no video was found|video.{0,10}not available|error 404|404[\s—–-]*Page Not Found|couldn.t find this content/i.test(text))return 'missing_video';
 if(/premium.{0,12}(?:only|required)|members.only|redeem your code|subscription required/i.test(text))return 'restricted';
 if(result.network.some(n=>['Document','Media'].includes(n.type)&&[401,403,451].includes(n.status))||/HTTP (?:401|403|451)|Forbidden|Access denied/i.test(text))return 'access_denied';
 if(result.playerError||result.nativeResults.some(r=>r.error||r.result?.error||r.result?.reason==='failed'))return 'player_error';return 'no_advancing_video';
}
let main=await app(),failures=0;const version=/versionName=([^\s]+)/.exec(await shell('shell','dumpsys','package',pkg))?.[1]||'unknown';report.appVersion=version;save();
while(true){if(fs.existsSync(path.join(dir,'pause'))){report.pausedAt=new Date().toISOString();save();break}const matrix=JSON.parse(fs.readFileSync(input,'utf8')),counts=new Map();for(const done of report.cases)counts.set(done.provider,(counts.get(done.provider)||0)+1);const row=matrix.cases.filter(r=>(!selected.size||selected.has(r.case))&&!report.cases.some(done=>done.case===r.case)).sort((a,b)=>(counts.get(a.provider)||0)-(counts.get(b.provider)||0))[0];if(!row){if(matrix.complete)break;await pause(1500);continue}
 const result={case:row.case,provider:row.provider,serverProvider:row.serverProvider,title:row.title,titleId:row.titleId,kind:row.kind,serverId:row.id,host:row.host,type:row.type,appVersion:version,at:new Date().toISOString(),playbackConfirmed:false,observations:[],network:[],nativeResults:[]},proof=new Map(),surfaces=new Map();let start=Date.now(),clicks=0,lastClick=0,server=auditServer(row.server);
 try{
  const focus=await shell('shell','dumpsys','window','displays');
  if(/mCurrentFocus=.*(?:Not Responding|Application Error|ImmersiveModeConfirmation)/i.test(focus))throw Error('An emulator system dialog covers the app; playback interaction is not a valid source test');
  if(['hls','mp4','file','dash'].includes(row.type))try{const response=await fetch(matrix.api+'/api/stream?'+new URLSearchParams({id:row.episodeId,showId:row.titleId,transport:'direct',fresh:'1'}),{signal:AbortSignal.timeout(30000)}),data=await response.json();if(!response.ok)throw Error(data.error||'Source refresh HTTP '+response.status);const fresh=data.servers?.find(s=>s.id===row.id&&s.provider===row.serverProvider&&s.type===row.type);if(fresh){server=auditServer(fresh);result.refreshed=true}else result.sourceRefreshWarning='This server was not returned by the fresh lookup; testing the last advertised descriptor';}catch(error){result.sourceRefreshWarning=error.message}
  result.resolveMs=Date.now()-start;start=Date.now();try{result.testedHost=new URL(server.streamUrl||server.embedUrl).hostname}catch{}
  await main.evaluate(`(()=>{window.__auditPlayer?.destroy();window.__auditAttempt=${row.case};window.__auditProgress=[];window.__auditNativeResults=[];if(!window.__auditWrapped){for(const name of ['openPlayer','openMedia']){const original=FlixerBrowser[name];FlixerBrowser[name]=async(...args)=>{const attempt=window.__auditAttempt;try{const result=await original(...args);if(attempt===window.__auditAttempt)window.__auditNativeResults.push({surface:name,result});return result}catch(error){if(attempt===window.__auditAttempt)window.__auditNativeResults.push({surface:name,error:error.message});throw error}}}window.__auditWrapped=true}window.__auditPlayer=FlixerPlayer.mount(document.getElementById('audit-player'),{title:${JSON.stringify(row.title)},servers:[${JSON.stringify(server)}],onProgress:(position,duration)=>window.__auditProgress.push({position,duration}),onExit:()=>{}});return true})()`);
  const mainContexts=observe(main,result);await enable(main);surfaces.set(main.page.id,{c:main,contexts:mainContexts});
  while(Date.now()-start<seconds*1000){
   for(const page of await pages())if(page.type==='page'&&!surfaces.has(page.id)&&!page.url.startsWith('https://localhost'))try{const c=await connect(page),contexts=observe(c,result);await enable(c);surfaces.set(page.id,{c,contexts})}catch{}
   for(const {c,contexts}of surfaces.values())for(const [id,frame]of [...contexts].slice(0,8))try{const s=await c.evaluate(snapshot,id,2500);s.frame=frame;s.elapsedMs=Date.now()-start;
    if(!s.url.startsWith('https://localhost'))result.observations.push(s);
    for(const v of s.videos){const advancing=observeVideoClock(proof,frame,v);if(advancing){result.playbackConfirmed=true;result.proof=advancing}}
    if(row.provider!=='wco'&&s.play&&clicks<3&&Date.now()-start>5000&&Date.now()-lastClick>8000&&!/verify.{0,40}human|captcha|checking your browser|premium/i.test(s.text)){
     const point={...s.play},tree=await c.send('Page.getFrameTree');if(frame!==tree.frameTree.frame.id){const owner=await c.send('DOM.getFrameOwner',{frameId:frame}),box=await c.send('DOM.getBoxModel',{backendNodeId:owner.backendNodeId});point.x+=box.model.content[0];point.y+=box.model.content[1]}
     await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});clicks++;lastClick=Date.now();
    }
   }catch{}
   const state=await main.evaluate(`({progress:window.__auditProgress,native:window.__auditNativeResults,error:document.querySelector('.player__error')?.innerText})`);result.nativeResults=state.native||[];result.playerError=state.error;
   const moving=(state.progress||[]).filter(p=>p.duration>=120&&p.position>0);if(moving.length>1&&moving.at(-1).position-moving[0].position>=1&&moving.at(-1).position>=3){result.playbackConfirmed=true;result.proof={start:moving[0].position,end:moving.at(-1).position,duration:moving.at(-1).duration,transport:'media3'}}
   if(result.playbackConfirmed||result.playerError)break;await pause(1500);
  }
  await main.evaluate('window.__auditPlayer?.destroy();true');await pause(300);const state=await main.evaluate('({native:window.__auditNativeResults,progress:window.__auditProgress})');result.nativeResults=state.native||result.nativeResults;
  result.nativeProgress=state.progress;failures=0;
 }catch(error){result.infrastructureError=error.message;failures++;try{main.close();main=await app(true)}catch(recovery){result.recoveryError=recovery.message;failures=3}}
 finally{for(const {c,contexts}of surfaces.values()){contexts.dispose();if(c!==main)c.close()}result.category=classify(result);result.ms=Date.now()-start;report.cases.push(result);save();console.log(JSON.stringify({case:row.case,provider:row.provider,host:row.host,category:result.category,ms:result.ms,done:report.cases.length,total:matrix.cases.length,preparationComplete:matrix.complete}));}
 if(failures>=3)throw Error('Emulator repeatedly unavailable; checkpoint retained without treating these as source failures');
}
main.close();report.runEndedAt=new Date().toISOString();const finalMatrix=JSON.parse(fs.readFileSync(input,'utf8')),finished=finalMatrix.complete&&finalMatrix.cases.every(row=>report.cases.some(done=>done.case===row.case));if(finished)report.finishedAt=report.runEndedAt;save();console.log(JSON.stringify({finished,paused:!!report.pausedAt,cases:report.cases.length,confirmed:report.cases.filter(c=>c.playbackConfirmed).length}));
