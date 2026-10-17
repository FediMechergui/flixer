(function(){
  function publicUrl(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||/^(?:localhost$|(?:\d{1,3}\.){3}\d{1,3}$|\[)/.test(u.hostname)||u.hostname.endsWith('.local'))return null;return u.href;}catch{return null;}}
  async function open(value){const url=publicUrl(value);if(!url)throw new Error('Invalid player page');const capacitor=window.Capacitor;if(capacitor?.isNativePlatform?.()){const browser=capacitor.Plugins?.Browser||capacitor.registerPlugin?.('Browser');if(browser?.open){await browser.open({url,toolbarColor:'#0b1511'});return;}}window.open(url,'_blank','noopener,noreferrer');}
  const nativePlayer=()=>{const c=window.Capacitor;return c?.isNativePlatform?.()?(c.Plugins?.PlayerView||c.registerPlugin?.('PlayerView')):null;};
  async function openPlayer(value){const url=publicUrl(value),player=nativePlayer();if(!url||!player?.open)throw Error('In-app player unavailable');return player.open({url});}
  window.FlixerBrowser={open,publicUrl,openPlayer,hasNativePlayer:()=>!!nativePlayer()};
})();
