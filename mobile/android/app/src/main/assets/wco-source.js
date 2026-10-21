// Observe only the normal public getJSON response. No upstream script evaluation,
// authentication fabrication, media decryption or playback-limit modification.
(()=>{
 const send=data=>{try{FlixerWcoResult.postMessage(JSON.stringify(data))}catch{}};
 if(location.hostname==='www.wcostream.tv'){
  if(window.__flixerWcoPage)document.addEventListener('DOMContentLoaded',()=>{
   const search=window.__flixerWcoSearch&&(document.querySelector('.aramadabaslik')||/no (?:results|anime) (?:found|available)/i.test(document.querySelector('#content,#container')?.textContent||''));
   if(search||!window.__flixerWcoSearch&&document.querySelector('#episodeList')&&document.querySelector('.vsbaslik h2'))send({html:document.documentElement.outerHTML});
  },{once:true});
  return;
 }
 if(location.hostname!=='embed.wcostream.com'||window.__flixerWcoPage)return;
 // Report the publisher's terminal capacity page; keep its access restriction
 // intact and let the app try a different provider instead of waiting 35s.
 if(location.pathname==='/inc/embed/full-capacity.html'){
  send({error:'WCO_CAPACITY'});return;
 }
 const open=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(method,url,...rest){
  let u;try{u=new URL(url,location.href)}catch{}
  if(String(method).toUpperCase()==='GET'&&u?.origin===location.origin&&u.pathname==='/inc/embed/getvidlink.php'){
   this.addEventListener('load',()=>{if(this.status!==200)return;try{
    const data=this.responseType==='json'?this.response:JSON.parse(this.responseText);
    if(data&&typeof data==='object')send({configuration:{server:data.server,cdn:data.cdn,enc:data.enc,hd:data.hd,fhd:data.fhd,sub:data.sub}});
   }catch{}},{once:true});
  }
  return open.call(this,method,url,...rest);
 };
 // The publisher's initial announcement has an ordinary Close button enabled
 // after its own countdown. Do not alter that countdown or disabled state.
 let attempts=0;
 const timer=setInterval(()=>{
  const close=document.querySelector('button#close-btn');
  if(close&&!close.disabled&&close.innerText.trim()==='Close'){close.click();clearInterval(timer);}
  if(++attempts>=34)clearInterval(timer);
 },1000);
 window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
})();
