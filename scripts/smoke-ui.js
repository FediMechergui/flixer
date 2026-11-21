// Deterministic browser checks against the real supported client, with fixture data.
// Uses an installed Chromium browser; no provider traffic or account is needed.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const root=path.resolve('client-terrarium'),out=path.resolve('artifacts/ui-smoke');
fs.mkdirSync(out,{recursive:true});
const binary=[process.env.FLIXER_BROWSER_BINARY,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(file=>file&&fs.existsSync(file));
if(!binary)throw Error('Set FLIXER_BROWSER_BINARY to a Chromium browser');
const shows=Array.from({length:12},(_,i)=>({id:'fm:m:'+(i+1),kind:'film',title:['The Quiet Coast','Night Train','Another Summer'][i%3]+' '+(i+1),year:2025,tags:['drama'],synopsis:'A small town, an unexpected journey and the people who make it worth taking.',episodes:[{id:'fm:m:'+(i+1),title:'Full film',season:1,number:1}],recentUpdate:{kind:'release',source:'provider',at:'2026-11-20T12:00:00Z'},publishedAt:'2026-11-20T12:00:00Z'}));
const snapshot={product:'flixer',generatedAt:'2026-11-20T12:00:00Z',shows};
snapshot.generatedAt=new Date().toISOString();
for(const show of shows){show.recentUpdate.at=snapshot.generatedAt;show.publishedAt=snapshot.generatedAt;}
let offline=false;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),json=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 if(url.pathname==='/config.js'){res.setHeader('Content-Type','text/javascript');return res.end(`window.FLIXER_CONFIG={mobile:true,live:false,dataBase:location.origin,apiBase:location.origin};`);}
 if(url.pathname==='/data/bootstrap.json')return json({error:'No bundled bootstrap'},404);
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/data/')){
  if(offline)return json({error:'Offline fixture'},503);
  if(url.pathname==='/data/index.json')return json(snapshot);
  if(url.pathname==='/api/catalogue'&&url.searchParams.get('part')==='bootstrap')return json(snapshot);
  if(url.pathname==='/api/title'){const row=shows.find(show=>show.id===url.searchParams.get('id'));return json(row||{error:'Title unavailable'},row?200:404);}
  return json({items:[],services:[],universes:[]});
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const portProbe=net.createServer();await new Promise(resolve=>portProbe.listen(0,'127.0.0.1',resolve));const port=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));
const browser=spawn(binary,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-dev-shm-usage','--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+path.join(out,'profile-'+Date.now()),'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,sequence=0;const pending=new Map(),errors=[];
try{
 let pages;
 for(let attempt=0;attempt<40;attempt++){try{pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();if(pages.some(page=>page.type==='page'))break;}catch{}await delay(250);}
 const page=pages?.find(page=>page.type==='page');if(!page)throw Error('Browser did not start');
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data)),task=pending.get(message.id);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);if(task){clearTimeout(task.timer);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser timeout: '+method));},10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;};
 const until=async expression=>{for(let attempt=0;attempt<60;attempt++){if(await evaluate(expression))return;await delay(100);}fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({expression,errors,body:await evaluate('document.body.innerText'),html:await evaluate('document.querySelector("#view")?.innerHTML')},null,2));throw Error('UI did not settle: '+expression);};
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`const originalFetch=window.fetch.bind(window);window.fetch=(input,options)=>new URL(typeof input==='string'?input:input.url,location.href).origin===location.origin?originalFetch(input,options):Promise.resolve(new Response('{}',{headers:{'Content-Type':'application/json'}}));`});
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await until('!!document.querySelector("#home-rows .card")');
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'mobile home overflows');
 const screenshot=async name=>{await delay(500);const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(result.data,'base64'));};
 await screenshot('home-mobile');
 await evaluate('document.querySelector("#btn-settings").focus();document.querySelector("#btn-settings").click()');
 await until('!!document.querySelector(".sheet")');
 assert.equal(await evaluate('document.querySelector("#view").inert&&document.querySelector(".sheet").contains(document.activeElement)'),true);
 await evaluate('const controls=[...document.querySelectorAll(".sheet button")];controls.at(-1).focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await evaluate('document.querySelector(".sheet").contains(document.activeElement)'),true);
 await screenshot('settings-mobile');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until('!document.querySelector(".sheet")');
 assert.equal(await evaluate('document.activeElement.id==="btn-settings"&&!document.querySelector("#view").inert'),true,'closing dialog must restore focus');
 await evaluate('location.hash="#/movie/%E0%A4%A"');await until('location.hash==="#/home"');
 await evaluate('location.hash="#/movie/fm:m:1"');await until('!!document.querySelector(".detail__title")');
 assert.equal(await evaluate('document.querySelector("#view").inert'),true);
 await screenshot('details-mobile');
 await evaluate('location.hash="#/watch/fm:m:404/fm:m:404"');await until('!!document.querySelector("[data-retry-episode]")');
 assert.equal(await evaluate('!!document.querySelector(".player__loading")'),false,'failed episode cannot leave a spinning player');
 await evaluate('location.hash="#/home"');offline=true;await send('Page.reload');await until('!!document.querySelector("#home-rows .card")');
 await send('Emulation.setDeviceMetricsOverride',{width:1365,height:900,deviceScaleFactor:1,mobile:false});await delay(200);await screenshot('home-desktop-offline');
 await evaluate('document.querySelector("#btn-settings").click()');await until('!!document.querySelector("[data-refresh-library]")');
 await evaluate('document.querySelector("[data-refresh-library]").click()');await until('document.querySelector("[data-refresh-status]").textContent.includes("saved library is still available")');
 assert.equal(await evaluate('document.querySelector("[data-refresh-library]").disabled'),false);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,checks:['clean mobile startup','mobile layout','dialog focus trap and restoration','malformed links','title details','episode failure recovery','offline restart'],screenshots:4},null,2));
 console.log('UI smoke passed: startup, responsive layout, focus, route recovery, episode errors and offline restart.');
 await send('Browser.close').catch(()=>{});
}finally{
 socket?.close();for(const task of pending.values())clearTimeout(task.timer);browser.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
