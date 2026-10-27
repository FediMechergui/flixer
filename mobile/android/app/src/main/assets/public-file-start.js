// Opening a source in Flixer already follows an explicit request to play.
// Start an eligible public file-host video through its ordinary media API.
// No source URL extraction, ad clicks, verification or access-token changes.
(()=>{
 const eligible=location.hostname==='uqload.vc'&&/^\/embed-[a-z0-9]+\.html$/i.test(location.pathname)
  ||location.hostname==='watch.strp2p.site'&&(/^\/e\/[a-z0-9]+\/?$/i.test(location.pathname)||location.pathname==='/'&&Boolean(location.search));
 if(!eligible)return;
 const attempted=new WeakSet(),encrypted=new WeakSet();
 document.addEventListener('encrypted',event=>encrypted.add(event.target),true);
 const start=event=>{
  const video=event.target;
  if(!(video instanceof HTMLVideoElement)||attempted.has(video)||encrypted.has(video)||video.mediaKeys||!video.paused||!Number.isFinite(video.duration)||video.duration<300||video.readyState<1)return;
  const text=(document.body?.innerText||'').slice(0,4000);
  if(/verify.{0,40}human|captcha|checking your browser|antispam|i.?m not a robot|subscription required|members.only|premium.{0,12}(?:only|required)|sign in to watch|log in to watch/i.test(text))return;
  const rect=video.getBoundingClientRect();if(rect.width<200||rect.height<100||rect.bottom<=0||rect.right<=0||rect.top>=innerHeight||rect.left>=innerWidth)return;
  for(let element=video;element;element=element.parentElement){const style=getComputedStyle(element);if(style.display==='none'||style.visibility==='hidden'||style.opacity==='0')return;}
  if([...document.querySelectorAll('video')].some(other=>other!==video&&other.getBoundingClientRect().width*other.getBoundingClientRect().height>rect.width*rect.height))return;
  attempted.add(video);video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  try{Promise.resolve(video.play()).catch(()=>{});}catch{}
 };
 document.addEventListener('loadedmetadata',start,true);
 document.addEventListener('canplay',start,true);
})();
