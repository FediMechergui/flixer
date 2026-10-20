// Cosmetic advertising rules for approved remote players only. Keep video,
// subtitle, consent and playback controls; do not rewrite provider media scripts.
(()=>{
 if(location.hostname==='localhost')return;
 const selectors=['.adsbygoogle','ins.adsbygoogle','[data-ad-slot]','[data-ad-client]',
  '#ad-banner','#ad-container','#ads-container','.ad-banner','.ads-banner','.advertisement',
  '.advertising','.banner-ad','.popunder-overlay','iframe[title="Advertisement"]'];
 const hide=()=>{
  if(!document.documentElement)return;
  let style=document.getElementById('flixer-ad-filter');
  if(!style){style=document.createElement('style');style.id='flixer-ad-filter';style.textContent=selectors.join(',')+'{display:none!important;visibility:hidden!important;pointer-events:none!important}';document.documentElement.appendChild(style);}
 };
 // Popups and notification prompts cannot take over the in-app player.
 try{window.open=()=>null;}catch{}
 // CSS also covers dynamically inserted ads; observe only removal of our style.
 const start=()=>{hide();const observer=new MutationObserver(hide);observer.observe(document.documentElement,{childList:true});window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});};
 if(document.documentElement)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
 const encrypted=new WeakSet();let offered=false;
 document.addEventListener('encrypted',event=>encrypted.add(event.target),true);
 document.addEventListener('timeupdate',event=>{
  const video=event.target;
  if(offered||!(video instanceof HTMLVideoElement)||video.paused||video.currentTime<3||video.duration<300||!Number.isFinite(video.duration)||video.mediaKeys||encrypted.has(video))return;
  const rect=video.getBoundingClientRect();if(rect.width<200||rect.height<100||rect.bottom<=0||rect.right<=0||rect.top>=innerHeight||rect.left>=innerWidth)return;
  for(let el=video;el;el=el.parentElement){const style=getComputedStyle(el);if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')return;}
  if([...document.querySelectorAll('video')].some(other=>other!==video&&other.getBoundingClientRect().width*other.getBoundingClientRect().height>rect.width*rect.height))return;
  try{
   const url=new URL(video.currentSrc);if(url.protocol!=='https:'||url.username||url.password||url.port)return;
   const extension=/\.(mp4|m3u8|mpd)$/i.exec(url.pathname)?.[1]?.toLowerCase();if(!extension)return;
   const type=extension==='m3u8'?'hls':extension==='mpd'?'dash':'mp4';
   // Only a source's already-playing public media URL; no blob extraction or DRM handling.
   window.FlixerPlayback?.postMessage(JSON.stringify({type:'public-media',url:url.href,format:type,position:video.currentTime}));offered=true;
  }catch{}
 },true);
})();
