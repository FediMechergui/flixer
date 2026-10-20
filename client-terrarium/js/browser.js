(function(){
  function publicUrl(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||/^(?:localhost$|(?:\d{1,3}\.){3}\d{1,3}$|\[)/.test(u.hostname)||u.hostname.endsWith('.local'))return null;return u.href;}catch{return null;}}
  async function open(value){const url=publicUrl(value);if(!url)throw new Error('Invalid player page');const capacitor=window.Capacitor;if(capacitor?.isNativePlatform?.()){const browser=capacitor.Plugins?.Browser||capacitor.registerPlugin?.('Browser');if(browser?.open){await browser.open({url,toolbarColor:'#0b1511'});return;}}window.open(url,'_blank','noopener,noreferrer');}
  const nativePlayer=()=>{const c=window.Capacitor;return c?.isNativePlatform?.()?(c.Plugins?.PlayerView||c.registerPlugin?.('PlayerView')):null;};
  const directPlayer=()=>{const c=window.Capacitor;return c?.isNativePlatform?.()?(c.Plugins?.DirectVideo||c.registerPlugin?.('DirectVideo')):null;};
  async function openPlayer(value){const url=publicUrl(value),player=nativePlayer();if(!url||!player?.open)throw Error('In-app player unavailable');return player.open({url});}
  async function openMedia(server,{title,startAt,onProgress}={}){
    const url=publicUrl(server.rawStreamUrl||server.streamUrl),player=directPlayer();if(!url||!player?.open)throw Error('Native video unavailable');
    const session=String(Date.now())+':'+Math.random(),listener=await player.addListener('progress',state=>{if(state.session===session)onProgress?.(state);});
    try{return await player.open({url,type:server.type,title,startAt,session,headers:server.headers||{}});}finally{await listener.remove();}
  }
  async function closePlayers(){await Promise.allSettled([nativePlayer()?.close?.(),directPlayer()?.close?.()]);}
  window.FlixerBrowser={open,publicUrl,openPlayer,openMedia,closePlayers,hasNativePlayer:()=>!!nativePlayer(),hasNativeVideo:()=>!!directPlayer()};
})();
