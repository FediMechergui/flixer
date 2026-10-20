// Exercise the installed Android player. HTTP 200 alone never counts as playback.
// Requires a running emulator/device and a debuggable Flixer audit build.
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const adb=option('--adb',path.join(process.env.ANDROID_HOME||path.join(process.env.LOCALAPPDATA||'', 'Android','Sdk'),'platform-tools',process.platform==='win32'?'adb.exe':'adb'));
const serial=option('--serial','emulator-5554'),pkg=option('--package','app.flixer.stream.audit'),port=Number(option('--port','9224'));
const activity=option('--activity','app.flixer.stream.PlayerAuditActivity');
const seconds=Number(option('--seconds','30')),selected=option('--cases','').split(',').filter(Boolean).map(Number);
const source=JSON.parse(fs.readFileSync(option('--input','artifacts/failure-investigation.json'),'utf8'));
const output=option('--output','artifacts/native-route-verification.json');
const report=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{at:new Date().toISOString(),secondsPerRoute:seconds,device:serial,package:pkg,scope:'Fresh Android WebView/Media3 attempts for original route descriptors; positive playback requires an advancing content video clock.',cases:[]};
const save=()=>{fs.writeFileSync(output+'.tmp',JSON.stringify(report,null,2));fs.renameSync(output+'.tmp',output);};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function shell(...params){return (await run(adb,['-s',serial,...params],{timeout:15000,windowsHide:true,maxBuffer:1024*1024})).stdout.trim();}
async function pages(){return (await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(6000)})).json();}
async function connect(page){
 const socket=new WebSocket(page.webSocketDebuggerUrl),pending=new Map(),listeners=new Set();let id=0;
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP handshake timeout')),4000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP connection failed'))},{once:true});});
 socket.addEventListener('message',event=>{const r=JSON.parse(String(event.data)),task=pending.get(r.id);if(task){clearTimeout(task.timer);pending.delete(r.id);r.error?task.reject(Error(r.error.message)):task.resolve(r.result);}else if(r.method)for(const listener of listeners)listener(r);});
 return {on:fn=>listeners.add(fn),async send(method,params={},timeout=2500){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(`${method} timeout`));},timeout);pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));});},async evaluate(expression,contextId){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,...(contextId?{contextId}:{})});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value;},close(){socket.close();for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('CDP closed'));}pending.clear();}};
}
async function app(){
 await shell('shell','am','start','-n',`${pkg}/${activity}`);
 let pid;for(let n=0;n<15&&!pid;n++){try{pid=await shell('shell','pidof',pkg);}catch{}if(!pid)await pause(1000);}
 if(!pid)throw Error('Audit app did not start');
 await shell('forward',`tcp:${port}`,`localabstract:webview_devtools_remote_${pid}`);
 for(let n=0;n<20;n++){try{const p=(await pages()).find(p=>p.url.startsWith('https://localhost'));if(p){const c=await connect(p);if(await c.evaluate('Boolean(window.Capacitor?.Plugins?.PlayerView)'))return c;c.close();}}catch{}await pause(1000);}
 throw Error('Debug app bridge unavailable');
}
const snapshot=`(()=>{const visible=e=>{const b=e.getBoundingClientRect();return b.width>80&&b.height>40&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none'};const videos=[...document.querySelectorAll('video')].filter(visible).map((v,index)=>({index,time:v.currentTime,duration:Number.isFinite(v.duration)?v.duration:0,paused:v.paused,src:v.currentSrc,error:v.error?.code||null,ready:v.readyState}));const play=[...document.querySelectorAll('button[aria-label],.vjs-big-play-button,.jw-icon-playback,.plyr__control--overlaid')].find(e=>visible(e)&&(/play/i.test(e.getAttribute('aria-label')||'')||e.matches('.vjs-big-play-button,.jw-icon-playback,.plyr__control--overlaid')));const v=[...document.querySelectorAll('video')].find(v=>visible(v)&&v.paused&&v.currentSrc);const dismiss=${args.includes('--publisher-controls')}&&location.hostname==='embed.wcostream.com'?[...document.querySelectorAll('button#close-btn')].find(e=>!e.disabled&&e.innerText.trim()==='Close'):null;const target=dismiss||play||v;const box=target?.getBoundingClientRect();return {url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,900),videos,iframes:[...document.querySelectorAll('iframe')].filter(visible).map(f=>f.src),play:box?{x:box.x+box.width/2,y:box.y+box.height/2}:null}})()`;
let main=await app();
const appVersion=/versionName=([^\s]+)/.exec(await shell('shell','dumpsys','package',pkg))?.[1]||'unknown';
for(const row of source.cases.filter(r=>!selected.length||selected.includes(r.case))){
 if(args.includes('--stop-file')&&fs.existsSync(option('--stop-file')))break;
 if(report.cases.some(r=>r.case===row.case))continue;
 const budgetSeconds=Math.max(Number(row.seconds)||0,row.retest?.category==='browser-verification-required'?Math.max(35,seconds):seconds);
 const result={case:row.case,titleId:row.titleId,title:row.title,provider:row.provider,host:row.host,serverId:row.id,appVersion,windowSeconds:budgetSeconds,deviceResolve:Boolean(row.deviceResolve),at:new Date().toISOString(),playbackConfirmed:false,observations:[],network:[],errors:[]};
 let remote,contexts=new Map(),requests=new Map(),start=Date.now(),clicks=0,lastClick=0,proof=new Map();
 try{
  let url=row.retest?.url;
  if(!url&&row.case===54){const replacement=JSON.parse(fs.readFileSync('artifacts/cinetimes-replacement.json','utf8'));url=replacement.servers?.[0]?.streamUrl;result.replacementRoute=true;}
  if(!url)throw Error('No current source URL');
  const session=`route-${row.case}-${Date.now()}`,type=row.type==='embed'&&!row.deviceResolve?'embed':'file';
  const deviceServer={id:row.id,name:row.name||row.title,provider:row.provider,type:row.provider==='wco'?'wco':'embed',embedUrl:url};
  const resolveDevice=row.deviceResolve?`const choices=await ${row.provider==='wco'?'FlixerWcoSource':'FlixerHgSource'}.resolve(${JSON.stringify(deviceServer)});if(!choices.length)throw Error('No device-resolved source media');const choice=choices.find(c=>c.id.endsWith(${JSON.stringify(':'+ (row.quality||'hd'))}))||choices[0];request.url=choice.streamUrl;request.type=choice.type==='hls'?'hls':'file';request.headers=choice.headers;window.__deviceSource=choice.sourceEmbedUrl;`:'';
  const workflow=row.playerWorkflow?`window.__mountedPlayer=FlixerPlayer.mount(document.getElementById('audit-player'),{title:${JSON.stringify(row.title)},servers:[${JSON.stringify({id:row.id,name:row.name||row.title,provider:row.provider,type:row.provider==='wco'?'wco':'embed',embedUrl:url})}],onExit:()=>window.__routeResult={result:{reason:'closed'}}});return;`:'';
  await main.evaluate(`(()=>{window.__routeResult=null;window.__routeProgress=[];setTimeout(async()=>{const plugin=Capacitor.Plugins.${type==='embed'?'PlayerView':'DirectVideo'};${type==='file'?`window.__routeListener=plugin.addListener('progress',p=>window.__routeProgress.push(p));`:''}try{${workflow}const request=${JSON.stringify(type==='embed'?{url,captureMedia:false}:{url,type:row.type==='hls'?'hls':'file',session,title:row.title,...(row.headers?{headers:row.headers}:{})})};${resolveDevice}const result=await plugin.open(request);window.__routeResult={session:${JSON.stringify(session)},result};}catch(e){window.__routeResult={session:${JSON.stringify(session)},error:e.message};}},150);return true})()`);
  while(Date.now()-start<budgetSeconds*1000){
   if(type==='embed'&&!remote){let current;try{current=await pages();}catch{await pause(1000);continue;}const p=current.find(p=>!p.url.startsWith('https://localhost')&&p.type==='page');if(p){remote=await connect(p);remote.on(({method,params:p})=>{
     if(method==='Runtime.executionContextCreated'&&p.context.auxData?.isDefault)contexts.set(p.context.id,p.context.auxData.frameId);
     if(method==='Runtime.executionContextDestroyed')contexts.delete(p.executionContextId);
     if(method==='Runtime.executionContextsCleared')contexts.clear();
     if(method==='Network.requestWillBeSent')requests.set(p.requestId,p.request.url);
     if(method==='Network.responseReceived'&&p.response.status>=400)result.network.push({status:p.response.status,url:p.response.url,type:p.type});
     if(method==='Network.loadingFailed')result.network.push({error:p.errorText,url:requests.get(p.requestId),type:p.type});
     if(method==='Runtime.exceptionThrown')result.errors.push(p.exceptionDetails.exception?.description||p.exceptionDetails.text);
     if(['Page.frameScheduledNavigation','Page.frameRequestedNavigation'].includes(method))result.network.push({navigation:p.url,reason:p.reason});
   });for(const method of ['Runtime.enable','Network.enable','Page.enable'])try{await remote.send(method);}catch(e){result.errors.push('Debugger attachment: '+e.message);}}}
   if(remote){
    for(const [id,frame] of [...contexts].slice(0,8)){
     try{
      const s=await remote.evaluate(snapshot,id);s.frame=frame;s.elapsedMs=Date.now()-start;result.observations.push(s);
      if(/click play button in order to verify.{0,20}human/i.test(s.text))result.interactionRequired=true;
      for(const v of s.videos){if(v.paused||v.duration<120||v.error)continue;const key=`${frame}:${v.index}:${v.src}`,before=proof.get(key);if(before&&v.time-before.time>=1&&v.time>=3){result.playbackConfirmed=true;result.proof={frame,start:before.time,end:v.time,duration:v.duration,elapsedMs:Date.now()-start};}else if(!before)proof.set(key,{time:v.time});}
      if(clicks<3&&s.play&&Date.now()-start>6000&&Date.now()-lastClick>8000&&!/verify.{0,40}human|checking your browser|captcha/i.test(s.text)){
       let point={...s.play};const tree=await remote.send('Page.getFrameTree');
       if(frame!==tree.frameTree.frame.id){
        try{const owner=await remote.send('DOM.getFrameOwner',{frameId:frame});const box=await remote.send('DOM.getBoxModel',{backendNodeId:owner.backendNodeId});point.x+=box.model.content[0];point.y+=box.model.content[1];}catch{continue;}
       }
       await remote.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
       await remote.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});clicks++;lastClick=Date.now();
      }
     }catch(e){result.errors.push(e.message);}
    }
   }
   if(result.playbackConfirmed&&!args.includes('--sustain')||result.interactionRequired)break;
   let current;try{current=await pages();}catch{await pause(1000);continue;}if(type==='embed'&&Date.now()-start>6000&&!current.some(p=>!p.url.startsWith('https://localhost')&&p.type==='page'))break;
   await pause(2000);
  }
  // Read the final result after closing the surface. This also supports older
  // APKs whose fullscreen dialogs could suspend the app WebView's timers.
  try{await main.evaluate(`setTimeout(()=>Capacitor.Plugins.${type==='embed'?'PlayerView':'DirectVideo'}.close(),100);true`);}catch{await shell('shell','input','keyevent','4');}
  await pause(1000);
  let state;try{state=await main.evaluate(`({result:window.__routeResult,progress:window.__routeProgress,${row.playerWorkflow?"componentText:document.getElementById('audit-player')?.innerText,":""}})`);}catch{}
  result.native=state;try{await main.evaluate('window.__mountedPlayer?.destroy();window.__mountedPlayer=null;Promise.resolve(window.__routeListener).then(l=>l?.remove?.());true');}catch{}
  if(type==='file'){
   const progress=state?.progress||[],moving=progress.filter(p=>(row.playerWorkflow||p.session===session)&&p.playing&&p.position>0);
   if(moving.length>=2&&moving.at(-1).position-moving[0].position>=1&&moving.at(-1).position>=3){result.playbackConfirmed=true;result.proof={start:moving[0].position,end:moving.at(-1).position,duration:moving.at(-1).duration};}
  }
  if(state?.result?.result?.played&&!result.playbackConfirmed)result.nativePlayingSignal=true;
 }catch(e){result.error=e.message;}
 finally{
  remote?.close();result.ms=Date.now()-start;result.network=result.network.slice(0,80);result.errors=[...new Set(result.errors)].slice(0,20);report.cases.push(result);save();
  console.log(JSON.stringify({case:row.case,host:row.host,played:result.playbackConfirmed,nativeSignal:result.nativePlayingSignal,error:result.error,observations:result.observations.length,ms:result.ms}));
  try{await main.evaluate('setTimeout(()=>{Capacitor.Plugins.PlayerView.close();Capacitor.Plugins.DirectVideo.close()},100);true');}catch{await shell('shell','input','keyevent','4').catch(()=>{});}
  await pause(500);
  try{await main.evaluate('true');}catch{main.close();await shell('shell','am','force-stop',pkg);main=await app();}
 }
}
main.close();save();console.log(JSON.stringify({total:report.cases.length,confirmed:report.cases.filter(r=>r.playbackConfirmed).length}));
