import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {DESSIN_ORIGIN} from '../server/src/dessinanime.js';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function launchDessinBrowser({port,profile}){
 const binary=[process.env.DESSIN_BROWSER_BINARY,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'].find(file=>file&&fs.existsSync(file));
 if(!binary)throw Error('No Chrome/Chromium browser found');
 fs.mkdirSync(profile,{recursive:true});
 const child=spawn(binary,['--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.resolve(profile),DESSIN_ORIGIN+'/'],{windowsHide:false,stdio:'ignore'});
 child.on('error',()=>{});return child;
}
export async function connectDessinBrowser(port){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local browser port');
 let pages;for(let attempt=0;attempt<40;attempt++){try{pages=await(await fetch(`http://127.0.0.1:${port}/json`,{signal:AbortSignal.timeout(1000)})).json();if(pages.some(p=>p.type==='page'))break;}catch{}await pause(500);}
 const page=pages?.find(p=>p.type==='page'&&p.url.startsWith(DESSIN_ORIGIN+'/'))||pages?.find(p=>p.type==='page'&&p.url==='about:blank');
 if(!page)throw Error('No isolated DessinAnime browser page found');
 const endpoint=new URL(page.webSocketDebuggerUrl);if(!['127.0.0.1','localhost'].includes(endpoint.hostname)||Number(endpoint.port)!==port)throw Error('Non-local browser debugger rejected');
 const socket=new WebSocket(endpoint.href),pending=new Map();let sequence=0;
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Browser connection timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Browser connection failed'))},{once:true});});
 socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data)),task=pending.get(message.id);if(task){clearTimeout(task.timer);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
 socket.addEventListener('close',()=>{for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('Browser disconnected'));}pending.clear();});
 const send=(method,params={})=>new Promise((resolve,reject)=>{if(socket.readyState!==WebSocket.OPEN){reject(Error('Browser disconnected'));return;}const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser operation timed out'));},18000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error('Source browser request failed');return result.result?.value;};
 return {
  async warmup(url){
   if(new URL(url).origin!==DESSIN_ORIGIN)throw Error('Invalid DessinAnime browser page');
   await send('Page.enable');await send('Page.navigate',{url});
   for(let attempt=0;attempt<25;attempt++){await pause(1000);const ready=await evaluate('location.origin==="https://dessinanime.cc"&&document.readyState!=="loading"&&document.querySelector("h1")&&!/Just a moment|Access denied/i.test(document.title)');if(ready)return true;}return false;
  },
  async readPage(url){
   const u=new URL(url);if(u.origin!==DESSIN_ORIGIN||u.username||u.password||u.search||u.hash||!/^\/(?:tv|movie)\//.test(u.pathname))throw Error('Invalid DessinAnime metadata destination');
   if(!await evaluate('location.origin==="https://dessinanime.cc"'))throw Error('Source browser left DessinAnime');
   return evaluate(`fetch(${JSON.stringify(u.href)},{credentials:'same-origin',signal:AbortSignal.timeout(12000)}).then(async response=>({status:response.status,url:response.url,html:await response.text()}))`);
  },
  async stop(){try{await send('Browser.close');}catch{}socket.close();},
  disconnect(){socket.close();for(const task of pending.values()){clearTimeout(task.timer);task.reject(Error('Browser disconnected'));}pending.clear();},
 };
}
