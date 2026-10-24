// A loaded frame or native "playing" flag is not playback evidence.
export function observeVideoClock(clocks,frame,video){
 if(video.paused||video.error||video.ad||!Number.isFinite(video.time)||!Number.isFinite(video.duration)||video.duration<120||!video.src)return null;
 const key=JSON.stringify([frame,video.index,video.src]),before=clocks.get(key);
 if(before!==undefined&&video.time-before>=1&&video.time>=3)return {start:before,end:video.time,duration:video.duration,transport:'webview'};
 if(before===undefined)clocks.set(key,video.time);
 return null;
}
