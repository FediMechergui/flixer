(function(){
  function publicUrl(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||/^(?:localhost$|(?:\d{1,3}\.){3}\d{1,3}$|\[)/.test(u.hostname)||u.hostname.endsWith('.local'))return null;return u.href;}catch{return null;}}
  async function open(value){const url=publicUrl(value);if(!url)throw new Error('Invalid player page');const capacitor=window.Capacitor;if(capacitor?.isNativePlatform?.()){const browser=capacitor.Plugins?.Browser||capacitor.registerPlugin?.('Browser');if(browser?.open){await browser.open({url,toolbarColor:'#0b1511'});return;}}window.open(url,'_blank','noopener,noreferrer');}
  const nativePlayer=()=>{const c=window.Capacitor;return c?.isNativePlatform?.()?(c.Plugins?.PlayerView||c.registerPlugin?.('PlayerView')):null;};
  const directPlayer=()=>{const c=window.Capacitor;return c?.isNativePlatform?.()?(c.Plugins?.DirectVideo||c.registerPlugin?.('DirectVideo')):null;};
  let playbackGeneration=0;
  const dismissPlayers=()=>Promise.allSettled([nativePlayer()?.close?.(),directPlayer()?.close?.()]);
  async function startPlayer(player,options,generation){if(generation!==playbackGeneration)throw Error('Player changed');await dismissPlayers();if(generation!==playbackGeneration)throw Error('Player changed');return player.open(options);}
  async function openPlayer(value,{captureMedia=true,bounds,startAt=0,onProgress}={}){
    const url=publicUrl(value),player=nativePlayer();if(!url||!player?.open)throw Error('In-app player unavailable');
    const generation=++playbackGeneration,session=String(Date.now())+':'+Math.random(),listener=await player.addListener?.('progress',state=>{if(state.session===session)onProgress?.(state);});
    try{return await startPlayer(player,{url,captureMedia,bounds,startAt,session},generation);}finally{await listener?.remove();}
  }
  async function openMedia(server,{title,startAt,onProgress,bounds}={}){
    const url=publicUrl(server.rawStreamUrl||server.streamUrl),player=directPlayer();if(!url||!player?.open)throw Error('Native video unavailable');
    const generation=++playbackGeneration,session=String(Date.now())+':'+Math.random(),listener=await player.addListener('progress',state=>{if(state.session===session)onProgress?.(state);});
    try{return await startPlayer(player,{url,type:server.type,title,startAt,session,headers:server.headers||{},subtitles:server.subtitles||[],bounds},generation);}finally{await listener.remove();}
  }
  async function closePlayers(){playbackGeneration++;await dismissPlayers();}
  const updatePlayerBounds=bounds=>Promise.allSettled([nativePlayer()?.updateBounds?.({bounds}),directPlayer()?.updateBounds?.({bounds})]);
  const fullscreenPlayer=()=>Promise.allSettled([nativePlayer()?.setFullscreen?.({fullscreen:true}),directPlayer()?.setFullscreen?.({fullscreen:true})]);
  window.FlixerBrowser={open,publicUrl,openPlayer,openMedia,closePlayers,updatePlayerBounds,fullscreenPlayer,hasNativePlayer:()=>!!nativePlayer(),hasNativeVideo:()=>!!directPlayer()};
})();
