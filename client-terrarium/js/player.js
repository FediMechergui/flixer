/* Flixer player: HLS (<video> + Hls.js) or an embedded third-party player, a server bar with
   automatic failover, and a fullscreen toggle. Playback logic ported from the Flixer React
   player (client/src/components/Player.jsx). Exposes window.FlixerPlayer.mount(container, opts). */

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ICON = {
    fs: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
    fsExit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z"/></svg>'
  };

  // Player 2 first when present: the most reliable embed in practice, then the list order.
  function initialIndex(servers) {
    try{
      const preference=JSON.parse(localStorage.getItem('flixer:player-preference')||'null');
      if(preference?.confirmed){
        let index=servers.findIndex(s=>s.provider===preference.provider && s.name===preference.name);
        if(index<0 && preference.audioMode)index=servers.findIndex(s=>s.audioMode===preference.audioMode);
        if(index>=0)return index;
      }
    }catch{}
    const i = servers.findIndex(s => s.type==='youtube'||s.videoId||s.type==='file');
    return i !== -1 ? i : 0;
  }

  let hlsReady;
  function loadHlsLibrary() {
    if(window.Hls)return Promise.resolve(window.Hls);
    if(!hlsReady) hlsReady=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL('js/vendor/hls.min.js',document.baseURI).href;
      script.onload=()=>resolve(window.Hls);script.onerror=()=>{hlsReady=null;script.remove();reject(new Error('Could not load video player'));};
      document.head.appendChild(script);
    });
    return hlsReady;
  }
  async function resolveDessinPlayer(server) {
    if(server?.provider!=='dessinanime'||server.type!=='dessinanime'||!Number.isSafeInteger(server.playerId)||server.playerId<1)throw Error('Invalid source player');
    const controller=new AbortController();let timer;
    try{
      const data=await Promise.race([fetch('https://dessinanime.cc/api/stream?playerId='+server.playerId,{signal:controller.signal}).then(response=>{if(!response.ok)throw Error('Source HTTP '+response.status);return response.json();}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Source player timed out'));},12000);})]);
      if(!['mp4','hls'].includes(data.type))throw Error('Unsupported source video');
      const seen=new Set(),choices=[];
      for(const quality of [{url:data.url,label:'Auto'},...(Array.isArray(data.qualities)?data.qualities:[])])try{
        const u=new URL(quality.url);if(u.origin!=='https://relay.dessinanime.cc'||!u.pathname.startsWith('/api/stream-relay/')||u.username||u.password||seen.has(u.href))continue;seen.add(u.href);
        choices.push({...server,id:server.id+':'+choices.length,name:server.name+' - '+String(quality.label).slice(0,25),type:data.type,streamUrl:u.href});
      }catch{}
      if(!choices.length)throw Error('No verified source video');return choices;
    }finally{clearTimeout(timer);}
  }

  function mount(container, opts) {
    const servers = Array.isArray(opts.servers) ? opts.servers : [];
    const st = { idx: initialIndex(servers), hls: null, destroyed: false, noticeTimer: null, switchTimer: null, startupTimer: null, generation: 0, attempted: new Set() };

    container.innerHTML = `<div class="player" tabindex="-1">
      <div class="player__bar">
        <div class="player__servers" id="pl-servers"></div>
        <button type="button" class="btn btn--ghost btn--sm" data-browser-player>Open player</button>
        <button type="button" class="player__fs" data-fs aria-label="Fullscreen">${ICON.fs}</button>
      </div>
      <div class="player__hot" data-hot aria-hidden="true"></div>
      <div class="player__stage" id="pl-stage"></div>
      <div class="player__notice" id="pl-notice" hidden></div>
    </div>`;
    const root = $(".player", container);
    const stage = $("#pl-stage", root);
    const notice = $("#pl-notice", root);
    const bar = $("#pl-servers", root);
    const fsBtn = $("[data-fs]", root);

    function renderBar() {
      if (servers.length <= 1) { bar.hidden = true; return; }
      bar.hidden = false;
      bar.innerHTML = `<span class="player__bar-title"><i class="dot"></i>Server</span>` +
        servers.map((s, i) => `<button type="button" class="player__srv ${i === st.idx ? "is-active" : ""}" data-i="${i}" title="Switch to ${esc(s.name)}">${esc(s.name)}</button>`).join("");
      $$("[data-i]", bar).forEach(b => b.addEventListener("click", () => {
        const index=+b.dataset.i;
        load(index);
      }));
      const active = $(".is-active", bar);
      if (active && active.scrollIntoView) active.scrollIntoView({ inline: "nearest", block: "nearest" });
    }

    function showNotice(text) {
      notice.innerHTML = `<span class="spinner"></span><span>${esc(text)}</span>`;
      notice.hidden = false;
      clearTimeout(st.noticeTimer);
      st.noticeTimer = setTimeout(() => { notice.hidden = true; }, 2500);
    }

    function teardownMedia() {
      clearTimeout(st.switchTimer);
      clearTimeout(st.startupTimer);
      st.generation++;
      if (st.hls) { try { st.hls.destroy(); } catch { /* already gone */ } st.hls = null; }
      const v = $("video", stage);
      if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* ignore */ } }
      stage.innerHTML = "";
    }

    $('[data-browser-player]',root).addEventListener('click',()=>{const server=servers[st.idx],url=server?.embedUrl||opts.sourceUrl;window.FlixerBrowser?.open(url).catch(()=>{});});

    function load(i, automatic = false) {
      if (st.destroyed) return;
      if (!automatic) st.attempted.clear();
      st.attempted.add(i);
      st.idx = i;
      $('[data-browser-player]',root).hidden=servers[i]?.provider==='dessinanime'||!['embed','browser'].includes(servers[i]?.type);
      renderBar();
      teardownMedia();
      const s = servers[i];
      if (!s) return showError();
      if(s.type==='dessinanime'){
        const generation=st.generation;showNotice('Resolving source video...');
        resolveDessinPlayer(s).then(choices=>{if(st.destroyed||st.generation!==generation)return;servers.splice(i,1,...choices);load(i);}).catch(()=>{if(!st.destroyed&&st.generation===generation)failover();});return;
      }
      if (["hls","mp4","file"].includes(s.type) && s.streamUrl) return loadHls(s);
      if(s.type==='browser'&&s.embedUrl){stage.innerHTML='<div class="player__error"><p>Open the source player in the app browser.</p><button class="btn btn--primary" data-source-player>Open player</button></div>'; $('[data-source-player]',stage).addEventListener('click',()=>window.FlixerBrowser?.open(s.embedUrl).catch(()=>{}));return;}
      if (s.embedUrl) return loadEmbed(s);
      failover();
    }

    async function loadHls(s) {
      stage.innerHTML = `<video controls playsinline preload="auto" ${opts.poster ? `poster="${esc(opts.poster)}"` : ""}></video>`;
      const v = $("video", stage);
      const generation = st.generation;
      const current = () => !st.destroyed && generation === st.generation;
      const failed = () => { if (current()) failover(); };
      const ready = () => { if (current()) { clearTimeout(st.startupTimer); notice.hidden = true; } };
      showNotice("Loading video...");
      st.startupTimer = setTimeout(failed, 25000);
      v.addEventListener("loadeddata", ready, { once: true });
      v.addEventListener("playing", () => {ready();try{localStorage.setItem('flixer:player-preference',JSON.stringify({provider:s.provider,name:s.name,audioMode:s.audioMode,confirmed:true}));}catch{}});
      v.addEventListener("waiting", () => { if (current()) showNotice("Buffering... You can switch servers above"); });
      v.addEventListener("error", failed);
      v.addEventListener("timeupdate", () => { if (v.duration > 0 && opts.onProgress) opts.onProgress(v.currentTime, v.duration); });
      v.addEventListener("ended", () => { if (opts.onEnded) opts.onEnded(); });
      const seek = () => { if (opts.startAt > 0) { try { v.currentTime = opts.startAt; } catch { /* not seekable yet */ } } };
      if(!['mp4','file'].includes(s.type) && !v.canPlayType("application/vnd.apple.mpegurl") && !window.Hls) {
        try {await loadHlsLibrary();} catch {if(!st.destroyed && stage.contains(v)) failover();return;}
        if(st.destroyed || !stage.contains(v))return;
      }
      if (['mp4','file'].includes(s.type) || v.canPlayType("application/vnd.apple.mpegurl")) {
        v.src = s.streamUrl;
        v.addEventListener("loadedmetadata", seek, { once: true });
        v.play().catch(() => {});
      } else if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, maxBufferLength: 30, manifestLoadingTimeOut: 10000, manifestLoadingMaxRetry: 1, fragLoadingTimeOut: 15000, fragLoadingMaxRetry: 1 });
        st.hls = hls;
        hls.loadSource(s.streamUrl);
        hls.attachMedia(v);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => { seek(); v.play().catch(() => {}); });
        hls.on(window.Hls.Events.ERROR, (_, data) => { if (data && data.fatal) { console.warn("[player] HLS fatal error:", data.type, data.details); failed(); } });
      } else {
        v.src = s.streamUrl;
        v.play().catch(() => {});
      }
    }

    function loadEmbed(s) {
      showNotice("Opening player...");
      // Cross-origin load cannot confirm playback: offer help without interrupting a working film.
      st.startupTimer = setTimeout(() => {
        if (!st.destroyed) showNotice("Taking a while? Try another server above");
      }, 12000);
      stage.innerHTML = `<iframe src="${esc(s.embedUrl)}" title="${esc(opts.title || "Player")}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen ${s.sandbox === null ? "" : 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"'} frameborder="0" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
      const frame=$('iframe',stage),generation=st.generation;
      frame.addEventListener('error',()=>{if(generation===st.generation)failover();});
    }

    const onPlayerFailure=event=>{
      const frame=$('iframe',stage);if(!frame||!event.detail?.url)return;
      try{const failed=new URL(event.detail.url),current=new URL(frame.src);failed.hash='';current.hash='';if(failed.href===current.href||event.detail.document&&failed.origin===current.origin)failover();}catch{}
    };
    window.addEventListener('flixer:player-error',onPlayerFailure);
    const onProviderMessage=event=>{
      const frame=$('iframe',stage);
      const trusted=['https://embos.top','https://mxdrop.click','https://mixdrop.top','https://hgcloud.to','https://vkvideo.ru','https://www.ok.ru','https://ok.ru','https://s1.hdup400.com','https://player.mediadelivery.net','https://playmogo.com','https://watch.easyvidplayer.com','https://vidcore.io','https://vidcore.net'];
      if(!frame||!trusted.includes(event.origin)||event.source!==frame.contentWindow)return;
      if(event.data?.type==='flixer:provider-missing')failover();
      if(event.data?.type==='flixer:provider-playing'){
        clearTimeout(st.startupTimer);notice.hidden=true;
        const s=servers[st.idx];try{localStorage.setItem('flixer:player-preference',JSON.stringify({provider:s.provider,name:s.name,audioMode:s.audioMode,confirmed:true}));}catch{}
      }
    };
    window.addEventListener('message',onProviderMessage);

    function failover() {
      if (st.destroyed) return;
      const cur = servers[st.idx];
      clearTimeout(st.startupTimer);
      clearTimeout(st.switchTimer);
      // Wrap around so a preferred middle server cannot skip earlier alternatives.
      const next = servers.map((_, offset) => (st.idx + offset + 1) % servers.length)
        .find(index => !st.attempted.has(index));
      if (next !== undefined) {
        showNotice(`${cur ? cur.name : "Server"} unavailable. Switching to ${servers[next].name}...`);
        const generation = st.generation;
        st.switchTimer = setTimeout(() => { if (!st.destroyed && generation === st.generation) load(next, true); }, 200);
      } else showError();
    }

    function showError() {
      teardownMedia();
      stage.innerHTML = `<div class="player__error">
        <p>Unable to play this title on any server right now.</p>
        <div class="player__error-actions">
          ${servers.length||opts.onRetry ? `<button type="button" class="btn btn--primary btn--sm" data-retry>Refresh servers</button>` : ""}
          ${opts.onDiscover?`<button class="btn btn--outline btn--sm" data-discover-players>Find other sources</button>`:""}
          ${opts.sourceUrl&&!/^https:\/\/dessinanime\.cc(?:\/|$)/i.test(opts.sourceUrl) ? `<a class="btn btn--outline btn--sm" href="${esc(opts.sourceUrl)}" target="_blank" rel="noopener" data-open-source>Open source player</a>` : ""}
        </div></div>`;
      const discover=$('[data-discover-players]',stage);if(discover)discover.addEventListener('click',async()=>{discover.disabled=true;discover.textContent='Searching sources...';try{const fresh=await opts.onDiscover();if(st.destroyed)return;if(fresh?.servers?.length){servers.splice(0,servers.length,...fresh.servers);load(initialIndex(servers));}else discover.textContent='No other players found';}catch{discover.textContent='Sources unavailable';}finally{discover.disabled=false;}});
      const r = $("[data-retry]", stage);
      if (r) r.addEventListener("click", async () => {
        r.disabled=true;r.textContent='Finding fresh servers…';
        if(opts.onRetry)try{const fresh=await opts.onRetry();if(st.destroyed)return;if(fresh?.servers?.length)servers.splice(0,servers.length,...fresh.servers);}catch{}
        if(!st.destroyed)load(initialIndex(servers));
      });
    }

    /* Fullscreen: the whole player box goes fullscreen so the server bar stays reachable.
       iOS Safari only allows <video> itself, hence the webkitEnterFullscreen fallback. */
    function toggleFullscreen() {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); }
        return;
      }
      const v = $("video", stage);
      if (root.requestFullscreen) root.requestFullscreen().catch(() => { if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen(); });
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
      else if (v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    }
    /* In fullscreen the server list is masked; a tap on the top strip (or moving the pointer
       there) shows it for a few seconds. The exit button stays visible. */
    let uiTimer = null;
    const revealUi = () => {
      if (!root.classList.contains("is-fullscreen")) return;
      root.classList.add("show-ui");
      clearTimeout(uiTimer);
      uiTimer = setTimeout(() => root.classList.remove("show-ui"), 3000);
    };
    const onFsChange = () => {
      const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
      root.classList.toggle("is-fullscreen", on);
      root.classList.remove("show-ui");
      clearTimeout(uiTimer);
      fsBtn.innerHTML = on ? ICON.fsExit : ICON.fs;
      fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Fullscreen");
    };
    // Reveal only once the tap on the strip has completed, so the same tap can never land on a
    // server button that appears underneath it.
    const hot = $("[data-hot]", root);
    hot.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); setTimeout(revealUi, 60); });
    hot.addEventListener("pointermove", e => { if (e.pointerType === "mouse") revealUi(); });
    bar.addEventListener("pointerdown", revealUi);
    bar.addEventListener("pointermove", revealUi);
    fsBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);

    if (servers.length) load(st.idx); else showError();

    return {
      switchTo: load,
      updateServers(additional){
        if(st.destroyed)return;
        const key=s=>s.streamUrl||s.embedUrl||s.videoId,seen=new Set(servers.map(key)),first=servers.length;
        for(const server of additional||[])if(!seen.has(key(server))){seen.add(key(server));servers.push(server);}
        if(servers.length===first)return;
        if($('.player__error',stage))load(first,true);else renderBar();
      },
      destroy() {
        st.destroyed = true;
        clearTimeout(st.noticeTimer);
        clearTimeout(uiTimer);
        window.removeEventListener('flixer:player-error',onPlayerFailure);
        window.removeEventListener('message',onProviderMessage);
        document.removeEventListener("fullscreenchange", onFsChange);
        document.removeEventListener("webkitfullscreenchange", onFsChange);
        teardownMedia();
        container.innerHTML = "";
      }
    };
  }

  window.FlixerPlayer = { mount, resolveDessinPlayer };
})();
