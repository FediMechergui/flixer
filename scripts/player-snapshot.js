export function playerSnapshot(){
 const visible=(element,width,height)=>{const box=element.getBoundingClientRect(),style=getComputedStyle(element);return box.width>=width&&box.height>=height&&style.visibility!=='hidden'&&style.display!=='none'&&style.opacity!=='0'};
 const advert=element=>!!element.closest('.ytp-ad-showing,[class*=ad-container]');
 const videos=[...document.querySelectorAll('video')].filter(v=>visible(v,80,40)).map((v,index)=>({index,time:v.currentTime,duration:Number.isFinite(v.duration)?v.duration:0,paused:v.paused,src:v.currentSrc,error:v.error?.code||null,ad:advert(v)}));
 const explicit='.vjs-big-play-button,.jw-icon-playback,.jw-icon-display,.plyr__control--overlaid,.ytp-large-play-button,.fp-play,[data-plyr="play"]';
 const play=videos.some(v=>!v.paused&&!v.ad&&v.time>0)?null:[...document.querySelectorAll('button[aria-label],button[title],[role="button"][aria-label],'+explicit)].find(element=>{const label=element.getAttribute('aria-label')||element.getAttribute('title')||'';return visible(element,16,16)&&!advert(element)&&!/\b(?:pause|stop)\b/i.test(label)&&(/^(?:play|replay|start)(?: video)?(?:\s*\([^)]*\))?$/i.test(label)||element.matches(explicit))});
 const video=[...document.querySelectorAll('video')].find(v=>visible(v,80,40)&&v.paused&&v.currentSrc&&!advert(v)),box=(play||video)?.getBoundingClientRect();
 return {url:location.href,text:(document.body?.innerText||'').slice(0,800),videos,play:box?{x:box.x+box.width/2,y:box.y+box.height/2}:null};
}
export function canPressPlay(text){return !/verify.{0,40}human|captcha|checking your browser|premium|antispam|i.?m not a robot/i.test(text);}
