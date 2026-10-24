/* Flixer data layer. Same surface as Terrarium's TmdbApi/DemoApi so the views stay untouched.
   Tiers:
   - the bundled index (data/catalog.json): every title, lean (no synopsis), loads instantly and
     works offline; filters, sorting, search and relations run on it. Series carry TVmaze data
     (popularity weight, rating, network / web channel) merged at build time;
   - the live source tier: the Flixer endpoints (/api/...) when the app is served next to them,
     otherwise the source's public JSON API directly (same requests the Flixer server makes).
     Keeps the index fresh (new titles every few minutes), fetches synopsis and episodes when a
     title is opened, widens search;
   - TVmaze (keyless, series only): rating, where it airs or streams, status, cast, episode guide,
     poster fallback. Universes and franchises come from js/universes.js (title patterns).
   Normalized item shape (what the views consume):
   { id, type: 'movie'|'tv', title, date, year, poster, backdrop, rating, votes, genreIds, overview,
     lang, country[], episodeCount, firstEpisodeId, sourceUrl, weight, service, universes[], stem } */

(function () {
  const CFG = window.FLIXER_CONFIG || {};
  const DATA_BASE = (CFG.dataBase || "").replace(/\/$/, "");
  const API_BASE = (CFG.apiBase || "").replace(/\/$/, "");
  const PER_PAGE = 24;
  const SOURCE = "https://myflixerz.day";
  const WP = SOURCE + "/wp-json/wp/v2";
  const SYNC_EVERY = 3 * 60 * 1000;
  const DELTA_CAP = 2500;
  const UNI = window.FlixerUniverses;
  const unrestrictedPlayers=new Set(['vidsrc.mov','vidsrc.fyi','embed.vidsrc.si','vidfast.pro','vidup.to','vidrock.net','vidnest.fun','vidlink.pro','111movies.net','multiembed.mov','mappletv.uk','moviesapi.to','embos.top','vidcore.net','vidcore.io','vidapi.xyz','embedmaster.link','player.vidlove.cc']);
  const embedSandbox=server=>{try{const u=new URL(server.embedUrl||server.rawEmbedUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&(unrestrictedPlayers.has(u.hostname)||/^(?:balance|[1-9])\.medmedia03\.wiki$/.test(u.hostname)))return null;}catch{}return server.sandbox;};
  const GENRES = [
    [39, "Action", "action"], [42, "Adventure", "adventure"], [97, "Animation", "animation"], [2343589, "Biography", "biography"],
    [46, "Comedy", "comedy"], [160, "Crime", "crime"], [212, "Documentary", "documentary"], [56, "Drama", "drama"],
    [99, "Family", "family"], [48, "Fantasy", "fantasy"], [236, "History", "history"], [237, "Horror", "horror"],
    [238, "Music", "music"], [40, "Mystery", "mystery"], [130, "Romance", "romance"], [2716699, "Sci-Fi", "sci-fi"],
    [2340416, "Sport", "sport"], [45, "Thriller", "thriller"], [150, "War", "war"], [220, "Western", "western"]
  ];
  const GENRE_NAME = new Map(GENRES.map(g => [g[0], g[1]]));
  const GENRE_SLUG_ID = new Map(GENRES.map(g => [g[2], g[0]]));
  const SLUG_LABEL = new Map(GENRES.map(g => [g[2], g[1]]));

  const store = {
    get(k, d) { try { const v = localStorage.getItem("flixer:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("flixer:" + k, JSON.stringify(v)); } catch { /* quota or unavailable */ } }
  };

  async function getJson(url, ms = 12000, signal) {
    if(window.FlixerCatalogueSource?.enabled()&&url.startsWith(`${API_BASE}/api/catalogue?`)){
      const query=new URL(url).searchParams;
      return {body:await window.FlixerCatalogueSource.get(query.get('part')||'manifest',query.get('hash')||undefined),headers:new Headers()};
    }
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    let rejectCancelled;
    const cancelled = new Promise((_, reject) => { rejectCancelled=reject; });
    const abort = () => {ctrl?.abort();const error=new Error("Request cancelled or timed out");error.name="AbortError";rejectCancelled(error);};
    const timer=setTimeout(abort,ms);
    if(signal){if(signal.aborted)abort();else signal.addEventListener("abort",abort,{once:true});}
    try {
      // Capacitor's native HTTP transport can ignore fetch's AbortSignal.
      // Bound the caller independently, while still cancelling browsers' fetch.
      return await Promise.race([cancelled,(async()=>{
        const res=await fetch(url,{...(ctrl?{signal:ctrl.signal}:{}),cache:'no-cache'});
        const text=await res.text();let body=null;
        try{body=JSON.parse(text);}catch{}
        if(!res.ok||body==null){const error=new Error((body&&body.error)||(res.ok?"Not found":"Request failed ("+res.status+")"));error.status=res.ok?404:res.status;throw error;}
        return {body,headers:res.headers};
      })()]);
    } finally {clearTimeout(timer);if(signal)signal.removeEventListener("abort",abort);}
  }

  const titleCase = s => String(s || "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”" };
  const decodeEntities = s => String(s || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code) => {
    if (code[0] === "#") { const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return NAMED[code.toLowerCase()] || m;
  });
  const plain = html => decodeEntities(String(html || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const posterFor = wpId => wpId ? `${SOURCE}/wp-content/uploads/posters/${wpId}_medium.jpg` : null;
  const backdropFor = wpId => wpId ? `${SOURCE}/wp-content/uploads/posters/${wpId}.jpg` : null;
  const artwork=value=>typeof value==='string'&&/^https:\/\//.test(value)&&!/(?:^|\/)(?:undefined|null|none)(?:\.[a-z]+)?$/i.test(value)?value:null;
  const byAdded = (a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title);
  const byUpdated = (a,b) => (b.updatedAt || "").localeCompare(a.updatedAt || "") || byAdded(a,b);
  const byYearDesc = (a, b) => (+b.year || 0) - (+a.year || 0) || byAdded(a, b);
  const byYearAsc = (a, b) => (+a.year || 0) - (+b.year || 0) || byAdded(a, b);
  const byEpisodes = (a, b) => (b.episodeCount || 0) - (a.episodeCount || 0) || byAdded(a, b);
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const byWeight = (a, b) => (b.weight || 0) - (a.weight || 0) || (b.rating || 0) - (a.rating || 0) || byAdded(a, b);
  const byRating = (a, b) => (b.rating || 0) - (a.rating || 0) || byWeight(a, b);

  // The source sometimes titles a show in its original language while the slug keeps the
  // international name ("Poketto monsutâ" / pokemon). The slug, minus the source's random
  // de-duplication suffix ("-hx3bz"), is used as an alternate title.
  function slugTitle(slug) {
    const parts = String(slug || "").split("-").filter(Boolean);
    if (parts.length > 1 && /^(?=.*d)[a-z0-9]{4,6}$/.test(parts[parts.length - 1])) parts.pop();
    return parts.join(" ");
  }

  /* ----- raw show -> view item ----- */
  async function savedTitle(id,ms){
    if(window.FlixerCatalogueSource?.enabled())try{const body=await window.FlixerCatalogueSource.title(id);if(body)return {body};}catch(error){console.warn('[flixer] Published title unavailable:',error.message);}
    return getJson(`${DATA_BASE}/data/shows/${encodeURIComponent(encodeURIComponent(id))}.json`,ms);
  }
  const PROVIDER_NAMES={myflixer:'MyFlixer',fmovies:'FMovies',hdtoday:'HDToday',wco:'WCO',animegg:'AnimeGG',megacartoons:'MegaCartoons',toontales:'ToonTales',myasiantv:'MyAsianTV',multimovies:'MultiMovies',yoturkish:'YoTurkish',dessinanime:'DessinAnime',onepace:'One Pace',youtubeoriginals:'YouTube',youtube:'YouTube',cimafu:'Cimafu',streamtunisie:'StreamTunisie',kirmalk:'Kirmalk',ahwaktv:'AhwakTV',egydead:'EgyDead',tuniflix:'Tuniflix',cinetimes:'Cinetimes',cimatn:'CimaTN',frenchstream:'FrenchStream'};
  function providersOf(show) {
    const ids=new Set(),seen=new Set();
    const visit=row=>{if(!row||seen.has(row))return;seen.add(row);
      for(const id of [row.id,...(row.aliasIds||[])]){const provider=/^sp:([^:]+):/.exec(id||'')?.[1]||({'mf':'myflixer','fm':'fmovies','hd':'hdtoday'}[String(id||'').split(':')[0]]);if(PROVIDER_NAMES[provider])ids.add(provider);}
      for(const offering of row.offerings||[])if(PROVIDER_NAMES[offering.provider])ids.add(offering.provider);
      for(const version of row.versions||[])visit(version);
    };visit(show);
    // YouTube channels and YouTube's player are the same source badge.
    if(ids.has('youtubeoriginals'))ids.delete('youtube');
    return [...ids].sort().map(id=>({id,name:PROVIDER_NAMES[id]}));
  }
  function coalesceEpisodes(rows, preferredIds=new Set()) {
    // A refreshed canonical list may choose a different primary provider ID.
    // Only explicit episode aliases prove equivalence; an equal episode number
    // alone must not collapse an OVA, alternate cut or sub/dub source edition.
    const aliases=new Map(),groups=new Set();
    for(const row of rows){
      const ids=[row.id,...(row.offerings||[]).map(offering=>offering.id)].filter(Boolean);
      const matches=[...new Set(ids.map(id=>aliases.get(id)).filter(Boolean))];
      const group=matches[0]||{rows:[],ids:new Set()};
      if(!matches.length)groups.add(group);
      for(const other of matches.slice(1)){group.rows.push(...other.rows);for(const id of other.ids){group.ids.add(id);aliases.set(id,group);}groups.delete(other);}
      group.rows.push(row);for(const id of ids){group.ids.add(id);aliases.set(id,group);}
    }
    const order=new Map(rows.map((row,i)=>[row,i]));
    return [...groups].map(group=>{
      const members=group.rows.sort((a,b)=>order.get(a)-order.get(b)),first=members[0];
      const merged=Object.assign({},...members.slice().reverse());
      const canonical=members.find(row=>preferredIds.has(row.id))||first;
      merged.id=canonical.id;
      for(const key of ['sourceUrl','slug'])if(canonical[key])merged[key]=canonical[key];
      merged.offerings=[...new Map(members.slice().reverse().flatMap(row=>{
        const inferred=/^sp:([^:]+):/.exec(row.id||'')?.[1]||({mf:'myflixer',fm:'fmovies',hd:'hdtoday'}[String(row.id||'').split(':')[0]]);
        return [...(inferred?[{provider:inferred,id:row.id,sourceUrl:row.sourceUrl}]:[]),...(row.offerings||[])];
      }).map(offering=>[offering.provider+':'+offering.id,offering])).values()];
      for(const key of ['audioModes','audioLanguages','subtitleLanguages'])merged[key]=[...new Set(members.flatMap(row=>row[key]||[]))];
      return {episode:merged,order:order.get(first)};
    }).sort((a,b)=>a.order-b.order).map(group=>group.episode);
  }
  function normalize(s) {
    const type = s.kind === "series" ? "tv" : "movie";
    const date = String([s.providerUpdatedAt,s.latestAt,s.publishedAt,s.firstSeenAt].filter(Boolean).sort().pop() || "").slice(0,10);
    const poster = s.poster || {};
    const episodes = Array.isArray(s.episodes) ? s.episodes : [];
    const tvm = s.tvm || null;
    const title = decodeEntities(s.title);
    const slugName=slugTitle(s.slug),alternate=slugName&&UNI.norm(slugName)!==UNI.norm(title)?slugName:"";
    return {
      id: s.id,
      offerings: s.offerings || [],
      providers: providersOf(s),
      access:s.access,
      versions: s.versions || [],
      sourceUrl: s.sourceUrl,
      type,
      title,
      altTitles: s.altTitles || [],
      date: String(s.publishedAt || s.firstSeenAt || "").slice(0,10),
      updatedAt: [s.latestEpisode?s.providerUpdatedAt:null,s.latestAt,s.publishedAt].filter(Boolean).sort().pop() || "",
      year: s.year ? String(s.year) : "",
      poster: artwork(s.portrait) || artwork(poster.custom) || artwork(poster.default) || artwork(tvm?.img) || posterFor(s.wpId),
      backdrop: artwork(poster.backdrop) || artwork(poster.hq) || artwork(poster.custom) || artwork(s.portrait) || backdropFor(s.wpId),
      rating: tvm ? tvm.r || 0 : 0,
      votes: 0,
      weight: tvm ? tvm.w || 0 : 0,
      service: tvm && tvm.svc ? tvm.svc : "",
      status: tvm && tvm.st ? tvm.st : "",
      tvmazeId: tvm ? tvm.id || null : null,
      tvImage: tvm && tvm.img ? tvm.img : null,
      genreIds: Array.isArray(s.tags) ? s.tags : [],
      overview: decodeEntities(s.synopsis || s.blurb),
      lang: s.contentLang || s.lang || "",
      country: [...new Set([...(Array.isArray(s.countries)?s.countries:[]),...(tvm && typeof tvm.c==='string'?[tvm.c]:[])])],
      originalLanguage: s.originalLanguage || (tvm && tvm.l) || "",
      audioMode: s.audioMode || "",
      audioModes:s.audioModes || [],
      audioLanguages:s.audioLanguages||[],
      collections:s.collections || [],
      episodeCount: s.episodeCount || episodes.length || (type === "movie" ? 1 : 0),
      firstEpisodeId: episodes[0] ? episodes[0].id : s.firstEpisodeId || s.id,
      sourceUrl: s.sourceUrl || (type === "tv" ? `${SOURCE}/series/${s.slug}/` : `${SOURCE}/${s.slug}/`),
      alt: alternate,
      universes: [...new Set([...UNI.detect(title), ...(alternate?UNI.detect(alternate):[]), ...(s._uni || [])])],
      stem: UNI.stem(title)
    };
  }

  // "The Trap – Season 1 Episode 1: The Monster" -> "The Monster"
  function episodeTitle(raw, show, isMovie) {
    if (isMovie) return show.title || raw || "";
    const t = String(raw || "");
    const m = t.match(/(?:season\s*\d+\s*)?episode\s*\d+\s*[:\-–—]\s*(.+)$/i);
    if (m && m[1].trim()) return m[1].trim();
    const stripped = t.replace(new RegExp("^" + (show.title || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[-–—:]\\s*", "i"), "").trim();
    return stripped || t;
  }
  function normalizeEpisode(e, i, show) {
    const isMovie = show.kind !== "series";
    const thumbs = e.thumbs || {};
    const slug = e.slug || String(e.id || "").replace(/^mf:[mse]:/, "");
    const sourceProvider=(e.offerings||[]).find(o=>o.id.startsWith('sp:'))?.provider || '';
    const sourceGroups=['animegg','megacartoons','myasiantv','yoturkish','wco'];
    return {
      id: e.id,
      offerings: e.offerings || [],
      showId: show.id,
      n: e.absoluteNumber || e.number || e.episode || (e.season===null?null:i + 1),
      season: e.season === null ? -(sourceGroups.indexOf(sourceProvider)+1) : e.season || 1,
      sourceProvider,
      title: decodeEntities(episodeTitle(e.title, show, isMovie)),
      overview: decodeEntities(e.synopsis || e.blurb),
      still: thumbs.custom || thumbs.default || e.poster?.custom || e.poster?.default || show.portrait || show.poster?.custom || show.poster?.default || posterFor(show.wpId) || null,
      date: "",
      runtime: null,
      sourceUrl: e.sourceUrl || (isMovie ? show.sourceUrl : `${SOURCE}/episodes/${slug}/`) || ""
    };
  }
  const movieEpisode = s => ({ id: s.id, slug: s.slug, title: s.title, season: 1, number: 1, sourceUrl: s.sourceUrl || `${SOURCE}/${s.slug}/` });

  /* ----- live source tier: the same requests the Flixer server makes ----- */
  const live = {
    hasServer: null,
    checking: null,
    years: null,
    async serverOk() {
      if(API_BASE)return true;
      if (this.hasServer != null) return this.hasServer;
      if (!this.checking) this.checking = getJson(`${API_BASE}/api/genres`, 5000)
        .then(() => (this.hasServer = true), () => {this.checking=null;return false;});
      return this.checking;
    },
    async yearTerms() {
      if (this.years) return this.years;
      const cached = store.get("years", null);
      if (cached && Date.now() - cached.t < 7 * 86400e3) { this.years = new Map(cached.map); return this.years; }
      const map = new Map();
      for (let page = 1; page <= 8; page++) {
        const { body } = await getJson(`${WP}/release-year?per_page=100&page=${page}&_fields=id,name`, 8000);
        if (!Array.isArray(body) || !body.length) break;
        body.forEach(r => { if (/^\d{4}$/.test(r.name)) map.set(r.id, r.name); });
        if (body.length < 100) break;
      }
      this.years = map;
      store.set("years", { t: Date.now(), map: [...map] });
      return map;
    },
    format(row, years, kind) {
      const isMovie = kind === "movie";
      const year = (row["release-year"] || []).map(id => years.get(id)).find(Boolean);
      const genres = (row.categories || []).map(id => GENRE_NAME.get(id)).filter(Boolean);
      const slug = row.slug;
      const synopsis = plain((row.content && row.content.rendered) || (row.excerpt && row.excerpt.rendered) || "");
      return {
        id: `mf:${isMovie ? "m" : "s"}:${slug}`,
        wpId: row.id, slug,
        kind: isMovie ? "film" : "series",
        title: plain((row.title && row.title.rendered) || row.title),
        synopsis,
        year: year ? Number(year) : null,
        tags: genres.map(g => g.toLowerCase().replace(/[^a-z0-9]+/g, "-")),
        publishedAt: row.date || row.date_gmt || null,
        modifiedAt: row.modified || null,
        sourceUrl: isMovie ? `${SOURCE}/${slug}/` : `${SOURCE}/series/${slug}/`
      };
    },
    async list(kind, { page = 1, perPage = 50, category, search, fields } = {}) {
      if (await this.serverOk()) {
        if (search) {
          this.searchRequests ||= new Map();
          if(!this.searchRequests.has(search))this.searchRequests.set(search,getJson(`${API_BASE}/api/search?q=${encodeURIComponent(search)}`).finally(()=>this.searchRequests.delete(search)));
          const {body} = await this.searchRequests.get(search);
          const items=(Array.isArray(body)?body:body.items || []).filter(s=>s.kind===(kind==='movie'?'film':'series'));
          return {items,total:items.length,totalPages:1};
        }
        const p = new URLSearchParams({ page: String(page), perPage: String(perPage) });
        if (category) p.set("category", category);
        if (search) p.set("q", search);
        const { body } = await getJson(`${API_BASE}/api/${kind === "movie" ? "movies" : "series"}?${p}`);
        return { items: body.items || [], total: body.total || 0, totalPages: body.totalPages || 1 };
      }
      const years = await this.yearTerms();
      const p = new URLSearchParams({ per_page: String(perPage), page: String(page), orderby: "modified", order: "desc", _fields: fields || "id,slug,title,date,date_gmt,modified,categories,release-year,excerpt" });
      const cat = category && GENRE_SLUG_ID.get(category);
      if (cat) p.set("categories", String(cat));
      if (search) p.set("search", search);
      const { body, headers } = await getJson(`${WP}/${kind === "movie" ? "posts" : "tvshows"}?${p}`);
      return { items: (Array.isArray(body) ? body : []).map(r => this.format(r, years, kind)), total: Number(headers.get("x-wp-total") || 0), totalPages: Number(headers.get("x-wp-totalpages") || 1) };
    },
    async details(id, sources = [],{fresh=false}={}) {
      if(/^sp:wco:s:[a-z0-9][a-z0-9-]{0,159}$/.test(id)&&window.Capacitor?.Plugins?.WcoSource)return window.FlixerWcoSource.details(id);
      const isSeries = id.startsWith("mf:s:");
      const slug = id.replace(/^mf:[mse]:/, "");
      if (await this.serverOk()) {
        const params = new URLSearchParams({id});
        if(fresh)params.set('fresh','1');
        sources.filter(Boolean).forEach(source => params.append('source', source));
        const { body } = await getJson(`${API_BASE}/api/title?${params}`);
        return body;
      }
      const years = await this.yearTerms();
      const { body } = await getJson(`${WP}/${isSeries ? "tvshows" : "posts"}?slug=${encodeURIComponent(slug)}&_fields=id,slug,title,date,date_gmt,modified,categories,release-year,content,excerpt`);
      const row = Array.isArray(body) ? body[0] : null;
      if (!row) throw new Error("Title not found on the source.");
      const item = this.format(row, years, isSeries ? "series" : "movie");
      if (isSeries) item.episodes = await this.episodes(slug).catch(() => []);
      return item;
    },
    async episodes(slug) {
      const res = await fetch(`${SOURCE}/series/${slug}/`);
      if (!res.ok) return [];
      const doc = await res.text();
      const out = [];
      const seen = new Set();
      const re = /"title":"((?:[^"\\]|\\.)*)","permalink":"((?:[^"\\]|\\.)*)","season":(\d+),"episode":(\d+)/g;
      let m;
      while ((m = re.exec(doc)) !== null) {
        const permalink = m[2].replace(/\\\//g, "/");
        const em = /\/episodes\/([^/]+)\/?$/.exec(permalink);
        const epSlug = em && em[1];
        if (!epSlug || seen.has(epSlug)) continue;
        seen.add(epSlug);
        let title = m[1];
        try { title = JSON.parse(`"${m[1]}"`); } catch { /* keep raw */ }
        const season = Number(m[3]), episode = Number(m[4]);
        out.push({ id: `mf:e:${epSlug}`, slug: epSlug, title: plain(title).replace(/^.*?\bS\d{1,3}\s*E\d{1,4}\b\s*[-–—:]?\s*/i, "").trim() || `Episode ${episode}`, season, number: episode, episode, sourceUrl: `${SOURCE}/episodes/${epSlug}/` });
      }
      return out;
    }
  };

  class FlixerApi {
    constructor() {
      this.isDemo = false;
      this._catalog = null;
      this._loading = null;
      this._byId = new Map();
      this._details = new Map();
      this._syncing = false;
      this._lastSync = 0;
      this._timer = null;
      this.liveEnabled = CFG.live !== false;
      this.settings = {};
      this.tvmaze = new window.FlixerTvMaze.TvMaze();
      this._guides = new Map();
    }
    today() { return new Date().toISOString().slice(0, 10); }
    setSettings(s) { this.settings = s || {}; }

    async _loadLiveIndex() {
      if(!this._liveIndexRequest)this._liveIndexRequest=this._readLiveIndex().finally(()=>{this._liveIndexRequest=null;});
      return this._liveIndexRequest;
    }
    async _readLiveIndex() {
      const {body:manifest}=await getJson(`${API_BASE}/api/catalogue?part=manifest`,12000);
      if(manifest.product!=='flixer'||!Array.isArray(manifest.indexParts)||!manifest.indexParts.length)throw Error('Invalid live catalogue manifest');
      const shows=[],previous=this._liveIndexParts||new Map(),next=new Map();
      this._liveIndexParts=previous;
      const load=async part=>{
        if(previous.has(part.sha256))return {body:previous.get(part.sha256)};
        const request=()=>getJson(`${API_BASE}/api/catalogue?${new URLSearchParams({part:part.key,hash:part.sha256})}`,20000);
        const response=await request().catch(async()=>{await new Promise(resolve=>setTimeout(resolve,200));return request();}),body=response.body;
        if(body.product!=='flixer'||body.generatedAt&&body.generatedAt!==manifest.generatedAt||!Array.isArray(body.shows))throw Error('Inconsistent live catalogue generation');
        previous.set(part.sha256,body);while(previous.size>512)previous.delete(previous.keys().next().value);return response;
      };
      for(let i=0;i<manifest.indexParts.length;i+=4){
        const batch=manifest.indexParts.slice(i,i+4);
        const parts=await Promise.all(batch.map(load));
        for(let n=0;n<parts.length;n++){const body=parts[n].body;if(body.product!=='flixer'||body.generatedAt&&body.generatedAt!==manifest.generatedAt||!Array.isArray(body.shows))throw Error('Inconsistent live catalogue generation');next.set(batch[n].sha256,body);shows.push(...body.shows);}
      }
      if(shows.length!==manifest.count)throw Error('Incomplete live catalogue index');
      this._liveIndexParts=next;
      return {body:{product:'flixer',generatedAt:manifest.generatedAt,shows}};
    }
    async _loadBundledIndex(){
      const {body}=await getJson('/data/index.json',30000);
      if(Array.isArray(body.shows))return {body};
      if(body.product!=='flixer'||!Number.isSafeInteger(body.count)||body.count<1||!Array.isArray(body.indexParts)||!body.indexParts.length||body.indexParts.length>512||new Set(body.indexParts).size!==body.indexParts.length||body.indexParts.some(name=>!/^index-\d{4}\.json$/.test(name)))throw Error('Invalid bundled catalogue');
      const shows=[];
      for(let offset=0;offset<body.indexParts.length;offset+=4){
        const parts=await Promise.all(body.indexParts.slice(offset,offset+4).map(name=>getJson('/data/'+name,30000)));
        for(const {body:part}of parts){if(part.product!=='flixer'||part.generatedAt!==(body.generatedAt||null)||!Array.isArray(part.shows))throw Error('Inconsistent bundled catalogue');shows.push(...part.shows);}
      }
      if(shows.length!==body.count||new Set(shows.map(row=>row.id)).size!==body.count)throw Error('Incomplete bundled catalogue');
      return {body:{...body,shows}};
    }
    /* ----- index ----- */
    catalog() {
      if (this._catalog) return Promise.resolve(this._catalog);
      if (!this._loading) {
        this._loading = (async () => {
          let { body: c } = await getJson(`${CFG.mobile ? "" : DATA_BASE}/data/bootstrap.json`).catch(() => getJson(`${DATA_BASE}/data/catalog.json`, 60000));
          const bundledAt=c.generatedAt||null,cachedHome=store.get('homeSnapshot',null);
          if(cachedHome?.product==='flixer'&&Array.isArray(cachedHome.shows)&&Date.parse(cachedHome.generatedAt)>Date.parse(c.generatedAt||0))c=cachedHome;
          if (c.product !== 'flixer') throw new Error('Flixer requires its own exported catalogue');
          const shows = Array.isArray(c.shows) ? c.shows : [];
          this._catalog = { shows, items: [], genres: { movie: [], tv: [] }, years: [1900, new Date().getFullYear()], generatedAt: c.generatedAt || null, tvmazeAt: c.tvmazeAt || null, lite: !!c.lite, tagLabels: new Map((c.tags || []).map(t => [t.id, t.labelEn || t.label || titleCase(t.id)])) };
          this._byId = new Map();
          this._bundleAt=bundledAt;this._fullIndexAt=bundledAt;
          this._rowRevisions=new Map();
          shows.forEach(s => {this._byId.set(s.id, s);for(const id of s.aliasIds||[])this._byId.set(id,s);this._rowRevisions.set(s.id,Date.parse(c.generatedAt)||0);});
          const delta = store.get("delta", []);
          if (Array.isArray(delta)) this._merge(delta,{snapshotAt:'1970-01-01',persist:false});
          this._recentIds=new Set(store.get('recentIds',[]).filter(id=>this._byId.has(id)));
          this._universeData = new Map(); this._serviceLogos = new Map();
          const notify=()=>{this._reindex();window.dispatchEvent(new CustomEvent("flixer:catalog",{detail:{updated:true}}));};
          const initialIndex=()=>CFG.mobile?this._loadBundledIndex().catch(()=>this._loadLiveIndex()):this._loadLiveIndex().catch(()=>getJson(`${DATA_BASE}/data/index.json`,60000));
          this._indexReady = new Promise(resolve=>setTimeout(resolve,750)).then(initialIndex).then(async({body})=>{
            if(body.product!=='flixer')throw new Error('Wrong product index');
            await this._mergeIndex(body.shows||[],body.generatedAt||this._bundleAt||'1970-01-01');if(Date.parse(body.generatedAt)>Date.parse(this._fullIndexAt||0))this._fullIndexAt=body.generatedAt;notify();
          }).catch(error=>console.warn('[flixer] full index unavailable:',error.message));
          this._metadataReady=Promise.allSettled([
            getJson(`${CFG.mobile ? "" : DATA_BASE}/data/universes.json`).then(({body})=>{
              this._universeData=new Map((body.universes || []).map(x=>[x.id,x])); this._universeDirty=true;
              this._universeData.forEach(x=>{const cached=store.get("uni:"+x.id,null);if(cached && Array.isArray(cached.members))this._mergeMembers(x,cached.members,cached.t);});
            }),
            getJson(`${CFG.mobile ? "" : DATA_BASE}/data/services.json`).then(({body})=>{this._serviceLogos=new Map((body.services || []).map(x=>[x.name,x.logo]));})
          ]).then(notify);
          this._reindex();
          this._startSync();
          return this._catalog;
        })().catch(e => { this._loading = null; throw e; });
      }
      return this._loading;
    }
    /* ----- Universe membership, recomputed on every reindex (so live additions join at once) ----- */
    _key(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(the|a|an)\s+/, "").replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
    _titleIndex() {
      if (this._titleIdx) return this._titleIdx;
      const m = new Map();
      this._catalog.items.forEach(i => { [i.title, i.alt].forEach(t => { const k = this._key(t); if (!k) return; const arr = m.get(k); if (!arr) m.set(k, [i]); else if (!arr.includes(i)) arr.push(i); }); });
      return (this._titleIdx = m);
    }
    _tokenIndex() {
      if (this._tokIdx) return this._tokIdx;
      const idx = new Map();
      this._catalog.items.forEach(i => { new Set(UNI.tokens(i.title + " " + (i.alt || ""))).forEach(t => { let s = idx.get(t); if (!s) idx.set(t, s = []); s.push(i); }); });
      return (this._tokIdx = idx);
    }
    // Match an external record { title, year, type } onto an index item: exact normalised title first,
    // then fuzzy (shared tokens, containment) with year and type checks.
    _matchMember(m) {
      const pickYear = list => (m.year && (list.find(i => +i.year === m.year) || list.find(i => Math.abs(+i.year - m.year) <= 1))) || (list.length === 1 || !m.year ? list[0] : null);
      const exactAll = this._titleIndex().get(this._key(m.title)) || [];
      const exact = exactAll.filter(i => !m.type || i.type === m.type);
      let hit = exact.length ? pickYear(exact) : (exactAll.length === 1 ? exactAll[0] : null);
      if (hit) return hit;
      const toks = [...new Set(UNI.tokens(m.title))];
      if (!toks.length) return null;
      const counts = new Map();
      toks.forEach(t => { const list = this._tokenIndex().get(t); if (list && list.length <= 400) list.forEach(i => counts.set(i, (counts.get(i) || 0) + 1)); });
      let best = null, bestScore = 0;
      counts.forEach((n, i) => {
        if (n < Math.ceil(toks.length / 2)) return;
        if (m.year && +i.year && Math.abs(+i.year - m.year) > 2) return;
        let s = Math.max(UNI.similarity(m.title, i.title), i.alt ? UNI.similarity(m.title, i.alt) : 0);
        if (m.type && i.type !== m.type) s -= 0.15;
        if (m.year && +i.year === m.year) s += 0.1;
        if (s > bestScore) { bestScore = s; best = i; }
      });
      if (bestScore >= 0.6) return best;
      // Head match: one title is the other's main title before a subtitle, same type, same year.
      if (m.year) {
        const head = t => this._key(String(t).split(/[:–—(]| - /)[0]);
        const mk = this._key(m.title), mh = head(m.title);
        const cands = (this._tokenIndex().get(toks[0]) || []).filter(i => +i.year === m.year && (!m.type || i.type === m.type));
        const h = cands.find(i => head(i.title) === mk || this._key(i.title) === mh || (i.alt && this._key(i.alt) === mk));
        if (h) return h;
      }
      return null;
    }
    _applyUniverses() {
      const c = this._catalog;
      this._titleIdx = null; this._tokIdx = null;
      const data = this._universeData || new Map();
      // Name-derived patterns for universes that only exist in the Wikidata data.
      const auto = [...data.values()].filter(u => !UNI.byId(u.id)).map(u => ({ id: u.id, patterns: UNI.autoPatterns(u.name, u.short) })).filter(u => u.patterns.length);
      const version=[...data.values()].map(u=>`${u.id}:${u.name}:${u.short}`).join('|');this._autoUniverseCache ||=new Map();
      if (auto.length) c.items.forEach(i => {let cached=this._autoUniverseCache.get(i.id);if(!cached||cached.title!==i.title||cached.alt!==i.alt||cached.version!==version){cached={title:i.title,alt:i.alt,version,ids:[...new Set([...UNI.detect(i.title,auto,false),...(i.alt?UNI.detect(i.alt,auto,false):[])])]};this._autoUniverseCache.set(i.id,cached);}if(cached.ids.some(id=>!i.universes.includes(id)))i.universes=[...new Set([...i.universes,...cached.ids])];});
      // Wikidata members matched onto the live index.
      const itemById = new Map(c.items.map(i => [i.id, i]));
      data.forEach(u => {
        let inFlixer = 0;
        u.members.forEach(m => {
          const hit = this._matchMember(m);
          m.id = hit ? hit.id : null;
          if (hit) { inFlixer += 1; const it = itemById.get(hit.id); if (it && !it.universes.includes(u.id)) it.universes.push(u.id); }
        });
        u.inFlixer = inFlixer;
      });
    }
    _mergeMembers(u, members, at) {
      const seen = new Set(u.members.map(m => m.q));
      members.forEach(m => { if (m.q && !seen.has(m.q)) { u.members.push(Object.assign({}, m, { id: null })); seen.add(m.q); } });
      u.members.sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")) || a.title.localeCompare(b.title));
      u.numbered = u.members.filter(m => m.ordinal != null).length >= 3;
      if (at) u.refreshedAt = at;
    }
    // Live refresh of a universe's members from Wikidata (same query as the build), once a day.
    async refreshUniverse(id) {
      const u = this._universeData && this._universeData.get(id);
      if (!u || !u.qids || !u.qids.length) return false;
      const cached = store.get("uni:" + id, null);
      if (cached && Date.now() - cached.t < 86400e3) return false;
      const FILM = ["Q11424", "Q24869", "Q202866", "Q506240", "Q226730", "Q20667187", "Q2431196"], TV = ["Q5398426", "Q581714", "Q63952888", "Q1259759", "Q15416", "Q117467246", "Q3464665"];
      const values = u.qids.map(q => "wd:" + q).join(" ");
      const query = u.mode === "company"
        ? `SELECT ?item ?itemLabel ?date ?start ?type WHERE { VALUES ?c { ${values} } ?item wdt:P272 ?c . ?item wdt:P31 ?type . FILTER(?type IN (${[...FILM, ...TV].map(t => "wd:" + t).join(",")})) OPTIONAL { ?item wdt:P577 ?date } OPTIONAL { ?item wdt:P580 ?start } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`
        : `SELECT ?item ?itemLabel ?date ?start ?ordinal ?type WHERE { VALUES ?u { ${values} } { ?item p:P179 ?st . ?st ps:P179 ?u . OPTIONAL { ?st pq:P1545 ?ordinal } } UNION { ?item wdt:P8345 ?u } UNION { ?item wdt:P1434 ?u } UNION { ?item wdt:P361 ?u } OPTIONAL { ?item wdt:P577 ?date } OPTIONAL { ?item wdt:P580 ?start } OPTIONAL { ?item wdt:P31 ?type } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
      const { body } = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, 8000);
      const map = new Map();
      ((body.results && body.results.bindings) || []).forEach(b => {
        const q = b.item.value.split("/").pop();
        const cur = map.get(q) || { q, title: null, dates: [], ordinal: null, types: new Set() };
        const label = b.itemLabel && b.itemLabel.value;
        if (label && label !== q) cur.title = label;
        if (b.date) cur.dates.push(b.date.value.slice(0, 10));
        if (b.start) cur.dates.push(b.start.value.slice(0, 10));
        if (b.ordinal && !Number.isNaN(+b.ordinal.value)) cur.ordinal = +b.ordinal.value;
        if (b.type) cur.types.add(b.type.value.split("/").pop());
        map.set(q, cur);
      });
      const members = [...map.values()].filter(m => m.title).map(m => {
        const type = [...m.types].some(t => TV.includes(t)) ? "tv" : [...m.types].some(t => FILM.includes(t)) ? "movie" : (m.types.size ? null : "movie");
        const date = m.dates.filter(x => /^\d{4}/.test(x)).sort()[0] || null;
        return { q: m.q, title: m.title, year: date ? +date.slice(0, 4) : null, date, type, ordinal: m.ordinal };
      }).filter(m => m.type);
      const before = u.members.length;
      this._mergeMembers(u, members, Date.now());
      store.set("uni:" + id, { t: Date.now(), members: members.map(m => ({ q: m.q, title: m.title, year: m.year, date: m.date, type: m.type, ordinal: m.ordinal })) });
      if (u.members.length !== before) this._applyUniverses(); else { u.members.forEach(m => { const hit = this._matchMember(m); m.id = hit ? hit.id : null; }); u.inFlixer = u.members.filter(m => m.id).length; }
      return u.members.length !== before;
    }

    /* ----- Universe pages ----- */
    async universeList() {
      const c = await this.catalog();
      return UNI.UNIVERSES.map(u => ({ id: u.id, name: u.name, short: u.short })).concat([...(this._universeData || new Map()).values()].filter(x => !UNI.byId(x.id)).map(x => ({ id: x.id, name: x.name, short: x.short })))
        .map(u => { const d = this._universeData && this._universeData.get(u.id); return { id: u.id, name: d ? d.name : u.name, short: d ? d.short : u.short, count: c.universeCounts.get(u.id) || 0, logo: d ? d.logo : null, isLogo: d ? d.isLogo : false, description: d ? d.description : "", home: d ? d.home : [], services: d ? d.services : [], total: d ? d.members.length : 0, inFlixer: d ? d.inFlixer : 0 }; })
        .filter(u => u.count || u.total)
        .sort((a, b) => b.count - a.count || b.total - a.total);
    }
    async universe(id) {
      const c = await this.catalog(); await this._indexReady;
      const base = UNI.byId(id) || { id, name: id, short: id };
      if (this.liveEnabled) { try { await this.refreshUniverse(id); } catch (e) { console.warn("[flixer] universe refresh skipped:", e.message); } }
      const d = this._universeData && this._universeData.get(id);
      if(this.liveEnabled && d && !this._resolvedUniverses?.has(id)) {
        this._resolvedUniverses ||= new Set(); this._resolvedUniverses.add(id);
        const missing=d.members.filter(m=>!m.id);
        // Resolve a small batch in the background; never delay opening the guide.
        (async()=>{ for(const member of missing.slice(0,20)) {
          try { const {body}=await getJson(`${API_BASE}/api/search?q=${encodeURIComponent(member.title)}`,15000);
            const rows=Array.isArray(body)?body:body.items || [];
            this._merge(rows.filter(row=>this._key(row.title)===this._key(member.title) && (!member.year || +row.year===+member.year) && (!member.type || (row.kind==='series'?'tv':'movie')===member.type)));
          } catch {} }
          this._reindex(); window.dispatchEvent(new CustomEvent("flixer:catalog",{detail:{updated:true}}));
        })();
      }
      const inIndex = c.items.filter(i => i.universes.includes(id));
      const seen = new Set();
      // Watch order: Wikidata members by release date (numbered where ordinals exist), then titles that
      // only the title patterns found, by year.
      // Several Wikidata items can resolve to one Flixer title (e.g. two "Pokémon" 1997 entries):
      // list each Flixer title once, at its first position, keeping the first ordinal.
      const members = (d ? d.members : []).map(m => { const item = m.id ? c.items.find(i => i.id === m.id) : null; if (item && seen.has(item.id)) return null; if (item) seen.add(item.id); return { q: m.q, title: item ? item.title : m.title, year: m.year || (item ? +item.year : null), date: m.date, type: m.type, ordinal: m.ordinal, item }; }).filter(Boolean);
      inIndex.filter(i => !seen.has(i.id)).sort((a, b) => (+a.year || 0) - (+b.year || 0)).forEach(i => members.push({ q: null, title: i.title, year: +i.year || null, date: i.date, type: i.type, ordinal: null, item: i }));
      // Services: TVmaze network / web channel of every series in this universe (in the index).
      const services = new Map();
      inIndex.forEach(i => { if (i.service) services.set(i.service, (services.get(i.service) || 0) + 1); });
      (d ? d.services : []).forEach(s => { if (!services.has(s.name)) services.set(s.name, s.count); });
      return { id, name: d ? d.name : base.name, short: d ? d.short : base.short, description: d ? d.description : "", logo: d ? d.logo : null, isLogo: d ? d.isLogo : false, wiki: d ? d.wiki : null, home: d ? d.home : [], services: [...services].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })), numbered: !!(d && d.numbered), members, inFlixer: members.filter(m => m.item).length, generatedAt: (d && d.refreshedAt) ? new Date(d.refreshedAt).toISOString() : c.universesAt, live: !!(d && d.refreshedAt) };
    }
    _reindex() {
      const c = this._catalog;
      this._normalized ||= new Map();
      this._dirtyItems ||= new Set();
      c.items = c.shows.map(show=>{
        if(!this._normalized.has(show.id) || this._dirtyItems.has(show.id)) {
          const previous=this._normalized.get(show.id),item=normalize(show);
          if(previous && this._universeDirty===false)item.universes=[...new Set([...item.universes,...previous.universes])];
          this._normalized.set(show.id,item);
        }
        return this._normalized.get(show.id);
      });
      this._dirtyItems.clear();
      const genresOf = type => {
        const counts = new Map();
        c.items.filter(i => i.type === type).forEach(i => i.genreIds.forEach(g => counts.set(g, (counts.get(g) || 0) + 1)));
        return [...counts].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, name: c.tagLabels.get(id) || SLUG_LABEL.get(id) || titleCase(id), count: n }));
      };
      c.genres = { movie: genresOf("movie"), tv: genresOf("tv") };
      let min = Infinity, max = new Date().getFullYear();
      c.items.forEach(i => { const y = +i.year; if (y) { if (y < min) min = y; if (y > max) max = y; } });
      c.years = [min === Infinity ? 1900 : min, max];
      if(this._universeDirty!==false){this._applyUniverses();this._universeDirty=false;}
      // Services (where series air / stream), universes and franchise stems.
      const svc = new Map();
      c.items.forEach(i => { if (i.service) svc.set(i.service, (svc.get(i.service) || 0) + 1); });
      c.services = [...svc].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      const uni = new Map();
      c.items.forEach(i => i.universes.forEach(u => uni.set(u, (uni.get(u) || 0) + 1)));
      c.universeCounts = uni;
      const stems = new Map();
      c.items.forEach(i => { if (i.stem && i.stem.length > 2) { const arr = stems.get(i.stem); if (arr) arr.push(i); else stems.set(i.stem, [i]); } });
      c.stems = stems;
    }
    async _mergeIndex(rows,snapshotAt){
      for(let offset=0;offset<rows.length;offset+=1000){
        this._merge(rows.slice(offset,offset+1000),{snapshotAt,persist:false});
        if(offset+1000<rows.length)await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    _merge(rows,{snapshotAt,persist=true}={}) {
      const c = this._catalog;
      let added = 0;
      const identity=r=>r.tmdbId?`${r.kind}:tmdb:${r.tmdbId}`:r.year?`${r.kind}:${this._key(r.title)}:${r.year}`:null;
      const keys=show=>new Set([identity(show),...(show.year?[show.title,...(show.altTitles||[])].map(title=>`${show.kind}:${this._key(title)}:${show.year}`):[])].filter(Boolean));
      const addIdentity=(show,prepared=keys(show))=>{for(const key of prepared){let set=this._identities.get(key);if(!set)this._identities.set(key,set=new Set());set.add(show);}};
      if(!this._identities){this._identities=new Map();c.shows.forEach(show=>addIdentity(show));}
      const uniqueIdentity=key=>{const set=this._identities.get(key);return set?.size===1?[...set][0]:null;};
      rows.forEach(r => {
        if (!r || !r.id) return;
        const candidates=[...new Set([...keys(r)].map(uniqueIdentity).filter(Boolean))];
        const candidate=uniqueIdentity(identity(r))||(candidates.length===1?candidates[0]:null);
        const cur = this._byId.get(r.id) || (candidate && !(candidate.tmdbId && r.tmdbId && +candidate.tmdbId!==+r.tmdbId) && candidate);
        if(cur) this._byId.set(r.id,cur);
        this._dirtyItems ||= new Set(); this._dirtyItems.add(cur ? cur.id : r.id);
        if (cur) {
          this._rowRevisions ||= new Map();
          const revision=Number(r._catalogRevision)||Date.parse(snapshotAt)||(snapshotAt?0:Date.now());
          const fresh=revision>=(this._rowRevisions.get(cur.id)||0),sameTitle=cur.id===r.id;
          const oldKeys=keys(cur);
          if(fresh)this._rowRevisions.set(cur.id,revision);
          if(sameTitle&&fresh&&r.access&&!(r.access==='catalogue-only'&&(cur.offerings||[]).some(o=>o.provider!=='dessinanime'&&o.availability!=='catalogue-only')))cur.access=r.access;
          if(cur.access==='catalogue-only'&&r.access!=='catalogue-only'&&r.episodes?.length)cur.access=r.access||'public';
          if(r.kindVerified && /^sp:myasiantv:/.test(cur.id))cur.kind=r.kind;
          if(fresh&&sameTitle&&(r.title && r.title!==cur.title || r.year && +r.year!==+cur.year))this._universeDirty=true;
          if (r.title && (!cur.title||fresh&&sameTitle)) cur.title = r.title;
          const synopsis=r.synopsis||r.blurb;if(synopsis&&(!cur.synopsis||synopsis.length>cur.synopsis.length))cur.synopsis=synopsis;
          if (r.tags && r.tags.length) cur.tags = [...new Set([...(cur.tags || []),...r.tags])];
          if (r.year && (!cur.year||fresh&&sameTitle)) cur.year = r.year;
          for (const key of ["publishedAt","latestAt","providerUpdatedAt"]) if(r[key]&&(!cur[key]||r[key]>cur[key]))cur[key]=r[key];
          for (const key of ["slug","latestEpisode","firstSeenAt","tmdbId","imdbId","firstEpisodeId","originalLanguage"]) if (r[key]&&(!cur[key]||fresh&&sameTitle)) cur[key] = r[key];
          for(const key of ['countries','audioModes','audioLanguages','subtitleLanguages','collections','altTitles'])if(r[key])cur[key]=[...new Set([...(cur[key]||[]),...r[key]])];
          if(r.title&&r.title!==cur.title)cur.altTitles=[...new Set([...(cur.altTitles||[]),r.title])];
          if (r.episodeCount) cur.episodeCount = Math.max(cur.episodeCount || 0,r.episodeCount);
          if (r.wpId&&(!cur.wpId||fresh&&sameTitle)) cur.wpId = r.wpId;
          if (r.tvm&&(!cur.tvm||fresh)) cur.tvm = r.tvm;
          if (r.offerings) cur.offerings = [...new Map([...(cur.offerings || []),...r.offerings].map(o=>[o.provider+":"+o.id,o])).values()];
          if (r.versions?.length && (!cur.versions?.length||fresh&&sameTitle)) cur.versions = r.versions;
          if (r.sourceUrl&&(!cur.sourceUrl||fresh&&sameTitle)) cur.sourceUrl = r.sourceUrl;
          if (r.poster&&Object.values(r.poster).some(Boolean)&&(!cur.poster||!Object.values(cur.poster).some(Boolean)||fresh&&sameTitle)) cur.poster = r.poster;
          if (r.portrait&&(!cur.portrait||fresh&&sameTitle))cur.portrait=r.portrait;
          if (Array.isArray(r.episodes)&&r.episodes.length) { const previous=cur.episodes||[],ordered=fresh&&sameTitle?[...r.episodes,...previous]:[...previous,...r.episodes];cur.episodes=coalesceEpisodes(ordered,new Set(previous.map(episode=>episode.id)));cur.episodeCount=cur.episodes.length; }
          const currentKeys=keys(cur);for(const key of oldKeys)if(!currentKeys.has(key)){this._identities.get(key)?.delete(cur);if(!this._identities.get(key)?.size)this._identities.delete(key);}addIdentity(cur,currentKeys);
        } else {
          this._universeDirty=true;
          this._rowRevisions ||= new Map();this._rowRevisions.set(r.id,Number(r._catalogRevision)||Date.parse(snapshotAt)||(snapshotAt?0:Date.now()));
          c.shows.push(r); this._byId.set(r.id, r);addIdentity(r); added += 1;
        }
        for(const id of [...(r.aliasIds||[]),...(r.offerings||[]).map(o=>o.id)])this._byId.set(id,cur||r);
      });
      if (persist && rows.length && rows.length < 500) this._persistDelta(rows.filter(r => r && r.id).map(r=>this._byId.get(r.id) || r));
      return added;
    }
    _persistDelta(rows) {
      const delta = store.get("delta", []);
      const incoming=new Map(rows.map(r=>[r.id, {id:r.id,kind:r.kind,title:r.title,altTitles:r.altTitles,year:r.year,tags:r.tags,slug:r.slug,wpId:r.wpId,publishedAt:r.publishedAt,latestAt:r.latestAt,latestEpisode:r.latestEpisode,firstEpisodeId:r.firstEpisodeId,providerUpdatedAt:r.providerUpdatedAt,tvm:r.tvm,offerings:r.offerings,versions:r.versions,sourceUrl:r.sourceUrl,poster:r.poster,portrait:r.portrait,tmdbId:r.tmdbId,documentary:r.documentary,originalLanguage:r.originalLanguage,countries:r.countries,audioModes:r.audioModes,collections:r.collections,access:r.access,audioLanguages:r.audioLanguages,subtitleLanguages:r.subtitleLanguages,_catalogRevision:this._rowRevisions?.get(r.id)||Date.now()}]));
      store.set("delta",[...incoming.values(),...delta.filter(r=>!incoming.has(r.id))].slice(0,DELTA_CAP));
    }

    /* ----- background sync: newest titles on the source, every few minutes ----- */
    _startSync() {
      if (!this.liveEnabled || this._timer) return;
      const tick = () => {if(window.location && /^#\/watch\//.test(window.location.hash))return;this.sync().catch(() => {});};
      setTimeout(tick, 1500);
      this._timer = setInterval(tick, SYNC_EVERY);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Date.now() - this._lastSync > SYNC_EVERY / 2) tick(); });
    }
    async sync() {
      if (this._syncing || !this._catalog) return 0;
      this._syncing = true;
      let added = 0;
      try {
        if(window.FlixerCatalogueSource?.enabled()){
          const before=this._catalog.shows.length;await this._refreshSnapshot();added=Math.max(0,this._catalog.shows.length-before);this._lastSync=Date.now();
          window.dispatchEvent(new CustomEvent('flixer:sync',{detail:{ok:true,added,at:this._lastSync}}));return added;
        }
        this._refreshSnapshot().catch(()=>{});
        const results = await Promise.allSettled(["film","series"].map(kind => getJson(`${API_BASE}/api/discover?kind=${kind}&latest=true&page=1`, 18000)));
        const recent = new Set(), groups=[]; let successful = false;
        results.forEach(result => { if(result.status === "fulfilled") {
          successful = true;
          const rows=result.value.body.items || [];
          added += this._merge(rows);
          const providers=[...new Set(rows.flatMap(row=>[...(row.offerings||[]).map(o=>o.provider),row.id.startsWith('sp:')?row.id.split(':')[1]:row.id.split(':')[0]]))];
          for(const provider of providers)groups.push(rows.filter(row=>(row.offerings||[]).some(o=>o.provider===provider)||row.id.startsWith(provider+':')||row.id.startsWith(`sp:${provider}:`)).map(row=>this._byId.get(row.id)?.id||row.id));
        }});
        if(!successful) throw new Error("Providers are temporarily unavailable");
        for(let index=0;groups.some(group=>index<group.length);index++) groups.forEach(group=>{if(group[index])recent.add(group[index]);});
        if(recent.size){for(const id of this._recentIds||[])recent.add(id);this._recentIds=new Set([...recent].slice(0,96));store.set('recentIds',[...this._recentIds]);}
        this._enrichServices([...recent]).catch(()=>{});
        this._reindex();
        this._lastSync = Date.now();
        window.dispatchEvent(new CustomEvent("flixer:catalog", { detail: { added, updated:true, total: this._catalog.shows.length } }));
        window.dispatchEvent(new CustomEvent("flixer:sync", { detail: { ok: true, added, at: this._lastSync } }));
      } catch (e) {
        window.dispatchEvent(new CustomEvent("flixer:sync", { detail: { ok: false, error: e.message } }));
        throw e;
      } finally { this._syncing = false; }
      return added;
    }
    async _refreshSnapshot(){
      if(!DATA_BASE||this._snapshotRequest||Date.now()-(this._lastSnapshotCheck||0)<SYNC_EVERY)return;
      this._lastSnapshotCheck=Date.now();
      this._snapshotRequest=(async()=>{
        const {body:status}=await getJson(`${API_BASE}/api/catalogue?part=manifest`,12000);
        if(status.product!=='flixer'||!status.generatedAt)return;
        if(Date.parse(status.generatedAt)>Date.parse(this._catalog.generatedAt||0)){
          const {body:home}=await getJson(`${API_BASE}/api/catalogue?${new URLSearchParams({part:"bootstrap",hash:status.bootstrap})}`,12000);
          if(home.product!=='flixer'||!Array.isArray(home.shows))throw new Error('Wrong product home feed');
          this._merge(home.shows,{snapshotAt:home.generatedAt||status.generatedAt,persist:false});this._catalog.generatedAt=home.generatedAt||status.generatedAt;
          store.set('homeSnapshot',home);this._reindex();window.dispatchEvent(new CustomEvent('flixer:catalog',{detail:{updated:true}}));
        }
        if(Date.parse(status.generatedAt)<=Date.parse(this._fullIndexAt||0))return;
        const {body}=await this._loadLiveIndex();
        if(body.product!=='flixer'||!Array.isArray(body.shows))throw new Error('Wrong product index');
        await this._mergeIndex(body.shows,body.generatedAt||status.generatedAt);this._fullIndexAt=body.generatedAt||status.generatedAt;this._reindex();
        window.dispatchEvent(new CustomEvent('flixer:catalog',{detail:{updated:true}}));
      })().catch(error=>{this._lastSnapshotCheck=0;throw error;}).finally(()=>{this._snapshotRequest=null;});
      return this._snapshotRequest;
    }

    async _enrichServices(ids) {
      for(const id of ids) {
        const raw=this._byId.get(id);
        if(!raw || raw.kind!=='series' || raw.tvm || raw._serviceTried) continue;
        raw._serviceTried=true;
        const item=normalize(raw), match=await this.tvmaze.show(item);
        if(!match || this._key(match.name)!==this._key(item.title) || (item.year && match.year && +item.year!==match.year)) continue;
        this._dirtyItems ||= new Set(); this._dirtyItems.add(raw.id);
        raw.tvm={id:match.id,w:match.weight,r:match.rating,svc:match.service,st:match.status,c:match.web?.country || match.network?.country};
        this._persistDelta([raw]); this._reindex();
        window.dispatchEvent(new CustomEvent("flixer:catalog",{detail:{updated:true}}));
      }
    }
    async all(type) { const c = await this.catalog(); return type && type!=="all" ? c.items.filter(i => i.type === type) : c.items; }
    async item(id) { const c = await this.catalog(); return c.items.find(i => i.id === id) || null; }
    async yearRange() { const c = await this.catalog(); return c.years; }
    async generatedAt() { const c = await this.catalog(); return c.generatedAt; }
    async stats() { const c = await this.catalog(); return { total: c.shows.length, films: c.items.filter(i => i.type === "movie").length, series: c.items.filter(i => i.type === "tv").length, rated: c.items.filter(i => i.rating).length, lastSync: this._lastSync, live: this.liveEnabled, tvmazeAt: c.tvmazeAt }; }
    ratingOf(id) { const s = this._byId.get(id); const r = s && s.tvm && s.tvm.r; return r ? { rating: r } : null; }

    /* ----- Home rails ----- */
    async trending() {
      const items=await this.all();
      return items.slice().sort(byUpdated).slice(0,24);
    }
    async nowPlaying() { return (await this.all("movie")).slice().sort(byAdded).slice(0, 14); }
    async onTheAir() { return (await this.all("tv")).slice().sort(byAdded).slice(0, 14); }
    async popular(type, n = 14) { return (await this.all(type)).filter(i => i.weight > 0).sort(byWeight).slice(0, n); }
    async topRated(type, n = 14) {
      const list = (await this.all(type)).slice();
      const rated = list.filter(i => i.rating > 0);
      return (rated.length ? rated.sort(byRating) : type === "tv" ? list.sort(byEpisodes) : list.sort(byYearDesc)).slice(0, n);
    }
    async universeRail(id, n = 14) { return (await this.all()).filter(i => i.universes.includes(id)).sort(byWeight).slice(0, n); }
    async topUniverses(n = 4) { const c = await this.catalog(); return [...c.universeCounts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, count]) => ({ id, count, ...UNI.byId(id) })); }
    async universes() { const c = await this.catalog(); return UNI.UNIVERSES.map(u => ({ id: u.id, name: u.name, short: u.short, count: c.universeCounts.get(u.id) || 0 })); }
    async serviceList(n = 40) {
      const c = await this.catalog();
      const logos = this._serviceLogos || new Map();
      return c.services.slice(0, n).map(s => ({ name: s.name, count: s.count, logo: logos.get(s.name) || null }));
    }
    async services(type) { const c = await this.catalog(); if (!type) return c.services; const m = new Map(); c.items.filter(i => i.type === type && i.service).forEach(i => m.set(i.service, (m.get(i.service) || 0) + 1)); return [...m].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })); }

    /* ----- Browse ----- */
    async discover(type, f, page = 1) {
      await this.catalog(); await this._indexReady;
      this._browseSessions ||= new Map();
      const key=JSON.stringify([type,f]);
      if(page===1 || !this._browseSessions.has(key)) this._browseSessions.set(key,{seen:new Set(),remotePage:0,totalPages:1,buffer:[]});
      const session=this._browseSessions.get(key);
      // Every scroll advances all upstream lists, even while cached titles remain.
      if(this.liveEnabled && session.remotePage < session.totalPages) {
        const genre=GENRES.find(g=>g[2]===(f.genres || [])[0]);
        const params=new URLSearchParams({kind:type==='tv'?'series':'film',page:String(session.remotePage+1)});
        if(f.sort==="updated") params.set("latest","true");
        if(f.collection) params.set("collection",f.collection);
        if(genre) params.set('genre',genre[2]);
        if(f.yearFrom && f.yearFrom===f.yearTo) params.set('year',f.yearFrom);
        const fetchPage=async()=>{
          const kinds=type==='all'?['film','series']:[params.get('kind')];
          const results=await Promise.allSettled(kinds.map(kind=>{const query=new URLSearchParams(params);query.set('kind',kind);return getJson(`${API_BASE}/api/discover?${query}`,18000);}));
          const successful=results.filter(result=>result.status==='fulfilled').map(result=>result.value.body);
          if(!successful.length)throw new Error('Discovery unavailable');
          return {body:{items:successful.flatMap(body=>body.items || []),totalPages:Math.max(...successful.map(body=>body.totalPages || 1))}};
        };
        session.pending ||= fetchPage().then(({body})=>{
          session.remotePage++; session.totalPages=body.totalPages || session.remotePage;
          this._merge(body.items || []); this._reindex();
          session.buffer.push(...(body.items || []).map(row=>this._byId.get(row.id)?.id || row.id));
        }).catch(()=>{}).finally(()=>{session.pending=null;});
      }
      const cachedList=await this.all(type);
      const filterList=source=>{
      let list = source;
      if (f.genres && f.genres.length) list = list.filter(i => f.genres.every(g => i.genreIds.includes(g)));
      if (f.yearFrom) list = list.filter(i => +i.year >= f.yearFrom);
      if (f.yearTo) list = list.filter(i => +i.year <= f.yearTo);
      if (f.services && f.services.length) { const set = new Set(f.services); list = list.filter(i => set.has(i.service)); }
      if (f.minRating) list = list.filter(i => i.rating >= f.minRating);
      if (f.collection) list = list.filter(i => this.inCollection(i, f.collection));
      if (f.universe) list = list.filter(i => i.universes.includes(f.universe));
      const sorters = { updated: byUpdated, added: byAdded, year: byYearDesc, oldest: byYearAsc, episodes: byEpisodes, title: byTitle, popularity: byWeight, rating: byRating };
      return list.slice().sort(sorters[f.sort] || byAdded);
      };
      let list=filterList(cachedList);
      // Cached pages render immediately while each provider advances in the background.
      // Wait for the network only when no matching saved titles remain.
      if(!list.some(i=>!session.seen.has(i.id))&&session.pending){await session.pending;list=filterList(await this.all(type));}
      const ranked=new Map(list.map(i=>[i.id,i]));
      const priority=session.buffer.map(id=>ranked.get(id)).filter(Boolean);
      if(f.sort==="updated") priority.sort(byUpdated);
      const available=[...priority,...list].filter(i=>!session.seen.has(i.id));
      const items=[];
      for(const item of available) { if(session.seen.has(item.id)) continue; session.seen.add(item.id); items.push(item); if(items.length===PER_PAGE) break; }
      session.buffer=session.buffer.filter(id=>!session.seen.has(id));
      const more=list.some(i=>!session.seen.has(i.id)) || session.remotePage < session.totalPages;
      return {items,page,totalPages:more?page+1:page,total:list.length};
    }
    async genres(type) { const c = await this.catalog(); return type==='all'?[...new Map([...c.genres.movie,...c.genres.tv].map(genre=>[genre.id,genre])).values()]:c.genres[type] || []; }
    inCollection(i, id) {
      const lang = String(i.originalLanguage || i.lang || "").toLowerCase();
      const countries = i.country.map(c => String(c).toUpperCase());
      const animation = i.genreIds.some(g => /^(97|animation|anime)$/i.test(String(g)));
      const japanese = countries.includes("JP") || ["ja", "japanese"].includes(lang);
      const anime = animation && (japanese || i.collections.includes('anime') || i.genreIds.includes('anime'));
      const french=i.collections.includes('french')||lang==='fr'||i.audioLanguages.includes('fr');
      if(id==='french')return french;
      if(id==='french-originals')return lang==='fr';
      if(id==='french-cartoons')return french&&animation;
      if(id==='french-series')return i.type==='tv'&&french;
      if(id==='canadian')return countries.includes('CA');
      if(id==='french-canadian')return countries.includes('CA')&&lang==='fr';
      if(id==='youtube-shows'||id==='one-pace')return i.collections.includes(id);
      if(id==='jdrama')return i.type==='tv'&&!animation&&(i.collections.includes(id)||countries.includes('JP')||['ja','japanese'].includes(lang));
      if(id==='cdrama')return i.type==='tv'&&!animation&&(i.collections.includes(id)||countries.some(c=>['CN','TW'].includes(c))||['zh','cmn','yue','chinese','mandarin','cantonese'].includes(lang));
      if(id==='french-entertainment')return french&&i.genreIds.some(tag=>['reality','talk','theatre','music'].includes(tag));
      if (id === "kdrama") return i.type === "tv" && (i.collections.includes('kdrama') || countries.includes("KR") || ["ko", "korean"].includes(lang)) && !animation;
      if (id === "arabic") return i.collections.includes('arabic') || lang==='ar' || countries.some(c=>['TN','EG','MA','DZ','LB','SY','SA','JO','IQ','KW','AE','QA','BH','OM','YE','PS','SD','LY'].includes(c));
      if (id === "egyptian") return i.collections.includes('egyptian') || countries.includes('EG');
      if (id === "tunisian") return i.collections.includes('tunisian') || countries.includes('TN');
      if (id === "plays") return i.collections.includes('plays') || i.genreIds.includes('theatre');
      if (id === "indian") return i.collections.includes('indian') || countries.includes("IN") || ["hi", "hindi", "ta", "tamil", "te", "telugu", "ml", "malayalam", "kn", "kannada", "bn", "bengali", "mr", "marathi", "pa", "punjabi"].includes(lang);
      if (id === "turkish") return countries.includes("TR") || ["tr", "turkish"].includes(lang);
      if (id === "anime") return anime;
      if (id === "anime-sub") return anime && (i.audioMode === "sub" || i.audioModes.includes('sub'));
      if (id === "anime-dub") return anime && (i.audioMode === "dub" || i.audioModes.includes('dub'));
      if (id === "cartoons") return animation && !anime;
      if (id === "classic-cartoons") return animation && !anime && +i.year > 0 && +i.year < 2000;
      return false;
    }
    async collections() {
      const items = await this.all();
      return [["jdrama","J-drama"],["cdrama","C-drama"],["canadian","Canadian movies & TV"],["french-canadian","French Canadian"],["french-series","French TV shows"],["youtube-shows","Official YouTube shows"],["one-pace","One Pace"],["french","French catalogue"],["french-originals","French originals"],["french-cartoons","French cartoons"],["french-entertainment","French entertainment"],["arabic","Arabic movies & TV"],["egyptian","Egyptian"],["tunisian","Tunisian movies & TV"],["plays","Plays & theatre"],["kdrama","K-drama"],["indian","Indian movies & TV"],["turkish","Turkish movies & TV"],["anime","Anime"],["anime-sub","Anime - confirmed sub"],["anime-dub","Anime - confirmed dub"],["cartoons","Cartoons"],["classic-cartoons","Classic cartoons"]]
        .map(([id,name]) => ({id,name,count:items.filter(i=>this.inCollection(i,id)).length}));
    }
    async countries() { return []; }
    async languages() { return []; }

    /* ----- Relations: same universe, same franchise, then similar ----- */
    async related(item, n = 16) {
      const c = await this.catalog();
      const seen = new Set([item.id]);
      const take = (list, k) => { const out = []; for (const i of list) { if (out.length >= k) break; if (!seen.has(i.id)) { seen.add(i.id); out.push(i); } } return out; };
      const universe = item.universes.length ? take(c.items.filter(i => i.universes.some(u => item.universes.includes(u))).sort(byWeight), n) : [];
      const franchise = item.stem && item.stem.length > 2 ? take((c.stems.get(item.stem) || []).slice().sort(byYearAsc), n) : [];
      const y = +item.year || 0;
      const similar = take(c.items.filter(i => i.type === item.type && i.genreIds.length && i.genreIds.filter(g => item.genreIds.includes(g)).length >= Math.min(2, item.genreIds.length) && (!y || Math.abs((+i.year || 0) - y) <= 3)).sort(byWeight), n);
      return { universe, universeName: item.universes.length ? (UNI.byId(item.universes[0]) || {}).name : "", franchise, similar };
    }

    /* ----- Details: index entry completed live (synopsis, episodes) + TVmaze guide ----- */
    async show(id) {
      await this.catalog();
      if (this._byId.has(id)) return this._byId.get(id);
      if(/^sp:wco:s:[a-z0-9][a-z0-9-]{0,159}$/.test(id)&&window.Capacitor?.Plugins?.WcoSource){
        const row=await window.FlixerWcoSource.details(id);this._merge([row]);this._reindex();
        if(row.synopsis&&row.episodes?.length&&normalize(row).poster)this._details.set(id,Date.now());
        return this._byId.get(id)||row;
      }
      try {
        const { body } = await savedTitle(id,8000);
        if(body.id!==id)throw new Error('Title identity mismatch');
        this._merge([body],{snapshotAt:this._catalog.generatedAt||this._bundleAt||'1970-01-01'}); this._reindex();
        return body;
      } catch { /* not in the bundle */ }
      const r = await live.details(id);
      this._merge([r]); this._reindex();
      return this._byId.get(id)||this._byId.get(r.id)||r;
    }
    async details(_type, id) {
      const raw = await this.show(id);
      const canonical=raw.id,cached=store.get('title:'+canonical,null),nativeWco=/^sp:wco:s:[a-z0-9][a-z0-9-]{0,159}$/.test(raw.id)&&window.Capacitor?.Plugins?.WcoSource;
      if(raw.kind==='series'&&Date.now()-(Number(this._details.get(canonical))||0)>120000)this._details.delete(canonical);
      if(!this._details.has(canonical)&&cached&&Date.now()-cached.t<(raw.kind==='series'?120000:6*3600e3)){this._merge([cached.show],{snapshotAt:new Date(cached.t).toISOString()});this._reindex();if((cached.show.synopsis||cached.show.blurb)&&normalize(cached.show).poster&&(cached.show.kind!=='series'||cached.show.episodes?.length))this._details.set(canonical,cached.t);}
      if(!this._details.has(canonical)){
        this._titleRequests ||= new Map();
        if(!this._titleRequests.has(canonical)){
          const refresh=(async()=>{
            if(!nativeWco)try{const {body}=await savedTitle(canonical,6000);if(body.id!==canonical)throw new Error('Title identity mismatch');this._merge([body],{snapshotAt:this._catalog.generatedAt||this._bundleAt||'1970-01-01'});this._reindex();window.dispatchEvent(new CustomEvent('flixer:title',{detail:{id:canonical}}));}catch{}
            const current=this._byId.get(canonical)||raw;
            if(this.liveEnabled&&(current.kind==='series'||!(current.synopsis||current.blurb)||!normalize(current).poster||Date.now()-Date.parse(this._catalog.generatedAt||0)>6*3600e3)){
              const fresh=await live.details(canonical,[current.sourceUrl,...(current.offerings||[]).map(o=>o.sourceUrl)],{fresh:current.kind==='series'});
              if(fresh)this._merge([fresh]);
            }
            this._reindex();const completed=this._byId.get(canonical)||raw;
            store.set('title:'+canonical,{t:Date.now(),show:completed});
            if(nativeWco||(completed.synopsis||completed.blurb)&&normalize(completed).poster&&(completed.kind!=='series'||completed.episodes?.length))this._details.set(canonical,Date.now());
            
          })().catch(e=>{if(nativeWco)this._details.set(canonical,Date.now());console.warn('[flixer] title metadata unavailable:',e.message);}).finally(()=>{this._titleRequests.delete(canonical);window.dispatchEvent(new CustomEvent('flixer:title',{detail:{id:canonical}}));});
          this._titleRequests.set(canonical,refresh);
        }
        const pending=this._titleRequests.get(canonical);
        await Promise.race([pending,new Promise(resolve=>setTimeout(resolve,180))]);
      }
      return this._build(this._byId.get(id) || raw);
    }
    async _build(raw, { guide = true } = {}) {
      const linked=(this._searchVersions?.get(raw.id)||[]).map(id=>this._byId.get(id)).filter(Boolean);
      if(linked.length)raw={...raw,versions:[...new Map([...(raw.versions||[]),...linked.map(row=>({...row,versions:[],uncertainMatch:true}))].map(row=>[row.id,row])).values()]};
      const item = normalize(raw);
      const c = await this.catalog();
      const labels = new Map(c.genres[item.type].map(g => [g.id, g.name]));
      // A series whose episode list is unavailable still gets one entry so it can be played from the
      // source page (the player resolves the servers from there).
      const list = raw.access==='catalogue-only'?[]:raw.kind === 'series' ? raw.episodes||[] : [movieEpisode(raw)];
      const episodes = list.map((e, i) => normalizeEpisode(e, i, raw));
      // TVmaze episode guide: titles, stills, air dates and summaries for the source's episodes.
      if (guide && raw.kind === "series" && item.tvmazeId && episodes.length) {
        const guide = this._guides.get(item.id) || null;
        if (!guide) {
          this._guideRequests ||= new Map();
          if(!this._guideRequests.has(item.id)) this._guideRequests.set(item.id,
            this._guide(item).catch(() => null).finally(() => this._guideRequests.delete(item.id)));
        }
        if (guide) episodes.forEach(e => { const g = e.season>0 && guide.get(e.season + ":" + e.n); if (g) { if (g.still) e.still = g.still; if (g.date) e.date = g.date; if (g.runtime) e.runtime = g.runtime; if (g.overview) e.overview = g.overview; if (g.title && /^episode \d+$/i.test(e.title)) e.title = g.title; } });
      }
      const seasonNums = [...new Set(episodes.map(e => e.season))].sort((a, b) => (a <= 0) - (b <= 0) || a - b); // numbered seasons first, source lists last
      const sourceNames={animegg:'AnimeGG',megacartoons:'MegaCartoons',myasiantv:'MyAsianTV',yoturkish:'YoTurkish',wco:'Watch Cartoon Online'};
      const seasons = seasonNums.map(n => ({ season_number: n, name: n<=0?`Source episodes - ${sourceNames[episodes.find(e=>e.season===n)?.sourceProvider]||'Original numbering'}`:"Season " + n, episode_count: episodes.filter(e => e.season === n).length }));
      return Object.assign(item, {
        tagline: "",
        genres: item.genreIds.map(g => ({ id: g, name: labels.get(g) || SLUG_LABEL.get(g) || titleCase(g) })),
        runtime: null,
        seasons, seasonCount: seasons.length, episodeCount: episodes.length,
        episodes, firstEpisodeId: episodes[0] ? episodes[0].id : item.id,
        cast: [], trailer: null, providers: null,
        similar: [],
        backdropLarge: item.backdrop, posterLarge: item.poster
      });
    }
    async _guide(item) {
      if (this._guides.has(item.id)) return this._guides.get(item.id);
      const cached = store.get("guide:" + item.id, null);
      let eps = cached && Date.now() - cached.t < 3 * 86400e3 ? cached.eps : null;
      if (!eps) { eps = await this.tvmaze.episodes(item.tvmazeId); store.set("guide:" + item.id, { t: Date.now(), eps: eps.map(e => ({ season: e.season, n: e.n, title: e.title, date: e.date, runtime: e.runtime, still: e.still, overview: (e.overview || "").slice(0, 240) })) }); }
      const map = new Map(eps.map(e => [e.season + ":" + e.n, e]));
      this._guides.set(item.id, map);
      return map;
    }
    async season(id, n) { const d = await this.details(null, id); return d.episodes.filter(e => e.season === n); }
    async episode(showId, epId) {
      // A known playable episode does not depend on synopsis or an optional TVmaze guide.
      const raw = await this.show(showId);
      if(raw.kind!=='series'&&(raw.aliasIds?.includes(epId)||raw.offerings?.some(o=>o.id===epId)))epId=raw.id;
      const aliasEpisode=raw.episodes?.find(e=>e.offerings?.some(o=>o.id===epId));if(aliasEpisode)epId=aliasEpisode.id;
      const known = raw.kind !== "series" ? raw.id === epId : (raw.episodes || []).some(e => e.id === epId);
      let show = known ? await this._build(raw, { guide: false }) : await this.details(null, showId);
      let index = show.episodes.findIndex(e => e.id === epId);
      if(index<0&&this._titleRequests?.has(raw.id)){
        await new Promise(resolve=>{
          let timer;const finish=()=>{clearTimeout(timer);window.removeEventListener?.('flixer:title',updated);resolve();};
          const updated=event=>{if(event.detail?.id!==raw.id)return;const current=this._byId.get(raw.id);if(current?.episodes?.some(e=>e.id===epId||e.offerings?.some(o=>o.id===epId)))finish();};
          timer=setTimeout(finish,6500);window.addEventListener?.('flixer:title',updated);this._titleRequests.get(raw.id)?.then(finish,finish);updated({detail:{id:raw.id}});
        });
        const current=this._byId.get(raw.id)||raw,alias=current.episodes?.find(e=>e.offerings?.some(o=>o.id===epId));if(alias)epId=alias.id;
        show=await this._build(current,{guide:false});index=show.episodes.findIndex(e=>e.id===epId);
      }
      if (index < 0) throw new Error("Episode not found.");
      const episode=show.episodes[index];
      const sequence=show.episodes.filter(e=>episode.season<=0?e.season===episode.season:e.season>0);
      const position=sequence.findIndex(e=>e.id===epId);
      return { show, episode, index:position, prev:sequence[position-1]||null, next:sequence[position+1]||null, total:sequence.length };
    }
    // TVmaze extras for a series: rating, where it airs or streams, status, cast, summary.
    async extras(item) {
      if (item.type !== "tv") return null;
      const s = await this.tvmaze.show(item);
      if (!s) return { matched: false };
      let cast = [];
      try { cast = await this.tvmaze.cast(s.id); } catch { /* optional */ }
      return Object.assign({ matched: true, cast }, s);
    }
    async posterFallback(id, failed = []) {
      const excluded=new Set(failed),raw=await this.show(id);
      const candidates=()=>[raw.portrait,...Object.values(raw.poster||{}),raw.tvm?.img,posterFor(raw.wpId),backdropFor(raw.wpId),...(raw.episodes||[]).slice(0,3).flatMap(e=>[e.poster?.custom,e.thumbs?.custom])].map(artwork).filter(url=>url&&!excluded.has(url));
      if(candidates().length)return candidates()[0];
      this._posterRequests ||= new Map();
      if(!this._posterRequests.has(raw.id)){
        this._posterWork ||= {active:0,waiting:[]};const work=this._posterWork;
        const request=(async()=>{if(work.active>=3)await new Promise(resolve=>work.waiting.push(resolve));else work.active++;
          try{
            const results=await Promise.allSettled([raw.kind==='series'?this.tvmaze.show(normalize(raw)):null,this.liveEnabled?live.details(raw.id,[raw.sourceUrl,...(raw.offerings||[]).map(o=>o.sourceUrl)]):null]);
            const detail=results[1].status==='fulfilled'?results[1].value:null;if(detail){this._merge([detail]);this._reindex();}
            const image=results[0].status==='fulfilled'?artwork(results[0].value?.image?.medium):null;
            return image;
          }finally{const next=work.waiting.shift();if(next)next();else work.active--;}
        })().catch(()=>null);this._posterRequests.set(raw.id,request);
      }
      const tvImage=await this._posterRequests.get(raw.id);
      return candidates()[0]||(tvImage&&!excluded.has(tvImage)?tvImage:null);
    }

    // Yearless source results share a search card only when their name/alias
    // identifies one edition. Keep their episode lists and routes independent.
    _groupSearchItems(ids) {
      const rows=[...new Map([...ids].map(id=>{const row=this._byId.get(id);return [row?.id,row];})).values()].filter(Boolean);
      const names=row=>new Set([row.title,...(row.altTitles||[])].map(value=>this._key(value)).filter(Boolean));
      const groups=[],byName=new Map();
      const index=group=>{for(const row of group.rows)for(const name of names(row)){const key=row.kind+':'+name;let set=byName.get(key);if(!set)byName.set(key,set=new Set());set.add(group);}};
      for(const row of [...rows].sort((a,b)=>!!b.year-!!a.year)){
        const candidates=[...new Set([...names(row)].flatMap(name=>[...(byName.get(row.kind+':'+name)||[])]))].filter(group=>group.rows.every(other=>!(other.year&&row.year&&+other.year!==+row.year)&&!(other.tmdbId&&row.tmdbId&&+other.tmdbId!==+row.tmdbId)&&!(other.imdbId&&row.imdbId&&other.imdbId!==row.imdbId)));
        const group=candidates.length===1?candidates[0]:{rows:[]};if(!group.rows.length)groups.push(group);group.rows.push(row);index(group);
      }
      this._searchVersions ||= new Map();
      const order=new Map(rows.map((row,i)=>[row.id,i]));
      return groups.sort((a,b)=>Math.min(...a.rows.map(row=>order.get(row.id)))-Math.min(...b.rows.map(row=>order.get(row.id)))).map(group=>{
        // Preserve source identities; opening a version must never redirect to
        // another edition or mix its episode numbering into that edition.
        for(const row of group.rows)this._searchVersions.set(row.id,group.rows.filter(other=>other!==row).map(other=>other.id));
        const root=group.rows[0],versions=[...new Map([...(root.versions||[]),...group.rows.slice(1).map(row=>({...row,versions:[],uncertainMatch:true}))].map(row=>[row.id,row])).values()];
        return normalize({...root,versions});
      });
    }
    /* ----- Search: index first, widened by the source's own search ----- */
    async search(q, { onLocal,signal } = {}) {
      // Same normalization as shared/search.js, kept local for the classic-script client.
      const norm = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/&amp;/g,'&').replace(/&/g,' and ').replace(/['’‘]/g,'').replace(/ـ/g,'').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      const terms = norm(q).split(/\s+/).filter(Boolean);
      if(!terms.length)return {items:[],totalPages:1};
      const hit = value => {const text=norm(value);return terms.every(term=>text.includes(term));};
      await this.catalog(); if(!API_BASE||!this.liveEnabled)await this._indexReady;
      const local = (await this.all()).filter(i => hit(i.title) || (i.alt && hit(i.alt)) || i.altTitles.some(hit)).sort(byWeight).slice(0, 60);
      const localItems=this._groupSearchItems(local.map(item=>item.id));
      if (onLocal) onLocal({ items:localItems, totalPages:1,pending:this.liveEnabled?1:0 });
      if (!this.liveEnabled) return { items: localItems, totalPages: 1 };
      if(API_BASE){
        this._searchProviders ||= getJson(`${API_BASE}/api/search?providers=1`,3000).then(({body})=>body.providers).catch(()=>null);
        const names=[...new Set([...(await this._searchProviders||['myflixer','fmovies','hdtoday','streamtunisie','kirmalk','ahwaktv','egydead','tuniflix','cinetimes','cimatn','animegg','megacartoons','toontales','myasiantv','multimovies','yoturkish','frenchstream','dessinanime']),...(window.Capacitor?.Plugins?.WcoSource?['wco']:[])])];
        if(signal?.aborted)return {items:local,totalPages:1};
        const ids=new Set(local.map(i=>i.id));let pending=names.length+1;
        const exact=local.find(item=>[item.title,...(item.altTitles||[])].some(value=>norm(value)===norm(q)));
        const aliases=[...new Set(exact?[exact.title,...(exact.altTitles||[])]:[])].filter(value=>value&&norm(value)!==norm(q)&&value.length<=120).slice(0,2);
        const result=()=>({items:this._groupSearchItems(ids),totalPages:1,pending});
        const saved=Promise.resolve(this._indexReady).then(async()=>{
          if(signal?.aborted)return;const rows=await this.all();if(signal?.aborted)return;
          rows.filter(i=>hit(i.title)||(i.alt&&hit(i.alt))||i.altTitles.some(hit)).sort(byWeight).slice(0,60).forEach(i=>ids.add(i.id));
        }).finally(()=>{pending--;if(!signal?.aborted&&onLocal)onLocal(result());});
        await Promise.allSettled([...names.map(async provider=>{try{
          const params=new URLSearchParams({q,provider});for(const alias of aliases)params.append('alias',alias);
          const {body}=provider==='wco'&&window.Capacitor?.Plugins?.WcoSource?{body:{items:await window.FlixerWcoSource.search(q,{aliases,signal})}}:await getJson(`${API_BASE}/api/search?${params}`,12000,signal);
          if(signal?.aborted)return;
          const rows=body.items||[];this._merge(rows);for(const row of rows)ids.add((this._byId.get(row.id)||row).id);
        }finally{pending--;if(!signal?.aborted&&onLocal)onLocal(result());}}),saved]);
        this._reindex();return result();
      }
      const liveHits = await Promise.race([
        Promise.all([live.list("movie", { page: 1, perPage: 20, search: q }), live.list("tv", { page: 1, perPage: 20, search: q })]).then(([m, s]) => [...m.items, ...s.items]).catch(() => []),
        new Promise(res => setTimeout(() => res([]), 3500))
      ]);
      if (liveHits.length && this._merge(liveHits)) this._reindex();
      const seen = new Set(local.map(i => i.id));
      const extra = liveHits.map(r => this._byId.get(r.id) || r).map(normalize).filter(i => !seen.has(i.id));
      return { items: [...local, ...extra], totalPages: 1 };
    }

    /* ----- Playback sources (unchanged contract) ----- */
    async stream(id, sourceUrl, show = {}, { signal,onSources,fresh=false } = {}) {
      const toAbsolute = url => !url ? null : (/^https?:\/\//.test(url) ? url : API_BASE + url);
        const normalizeServers=data=>{
        const servers = [];
        (Array.isArray(data.servers) ? data.servers : []).forEach((s, idx) => {
          if(s.requiresBrowserVerification || /^https:\/\/hdtoday\.sx\//i.test(s.embedUrl || ''))return;
          const streamUrl = toAbsolute(window.FlixerBrowser?.hasNativeVideo?.()?(s.rawStreamUrl || s.streamUrl):(s.streamUrl || s.rawStreamUrl));
          const youtubeId = s.type === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(s.videoId || '') ? s.videoId : null;
          const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0` : toAbsolute(s.embedUrl || s.rawEmbedUrl);
          if (streamUrl || embedUrl || s.type==='dessinanime'&&s.provider==='dessinanime'&&Number.isSafeInteger(s.playerId)&&s.playerId>0) servers.push({ ...s, sandbox:youtubeId?null:embedSandbox(s), id: s.id != null ? s.id : idx, name: s.name || "Player " + (idx + 1), type: s.type || (streamUrl ? "hls" : "embed"), streamUrl, embedUrl });
        });
        if (!servers.length && Array.isArray(data.streams)) data.streams.forEach((s, idx) => { const u = toAbsolute(s.proxyUri || s.uri); if (u) servers.push({ id: idx, name: s.quality || s.name || "Server " + (idx + 1), type: "hls", streamUrl: u }); });
        if (!servers.length && data.streamUrl) servers.push({ id: 0, name: "Player 1 (HLS)", type: "hls", streamUrl: toAbsolute(data.streamUrl) });
        if (!servers.length && data.embedUrl) servers.push({ id: 0, name: "Player 1", type: "embed", embedUrl: toAbsolute(data.embedUrl) });
        return servers;
        };
      const wco=/^sp:wco:e:[a-z0-9][a-z0-9-]{0,159}:([a-z0-9][a-z0-9-]{0,159})$/.exec(id);
      if(wco&&window.Capacitor?.Plugins?.WcoSource){
        if(signal?.aborted)throw new DOMException('Aborted','AbortError');
        if(fresh)window.FlixerWcoSource?.clearCache?.();
        const mode=/-english-(subbed|dubbed)$/.exec(wco[1]);
        const alternatives=show.episodes?.find(e=>e.id===id)?.offerings||[];
        if(onSources&&alternatives.some(o=>o.provider&&o.provider!=='wco')){
          const params=new URLSearchParams({id,transport:'direct'});if(show.id)params.set('showId',show.id);if(fresh)params.set('fresh','1');
          [show.sourceUrl,...(show.offerings||[]).map(o=>o.sourceUrl)].filter(Boolean).forEach(source=>params.append('source',source));
          getJson(`${API_BASE}/api/stream?${params}`,20000,signal).then(({body})=>{if(!signal?.aborted)onSources(normalizeServers(body).filter(s=>s.provider!=='wco'));}).catch(()=>{});
        }
        return {servers:[{id:'wco:public',provider:'wco',name:'Watch Cartoon Online',type:'wco',embedUrl:'https://www.wcostream.tv/'+wco[1],captureMedia:false,...(mode?{audioMode:mode[1]==='subbed'?'sub':'dub'}:{})}],via:'device'};
      }
      try {
        const params = new URLSearchParams({id});
        if(window.FlixerBrowser?.hasNativeVideo?.())params.set('transport','direct');
        if(fresh)params.set('fresh','1');
        if (show.id) params.set('showId',show.id);
        [show.sourceUrl, ...(show.offerings || []).map(o => o.sourceUrl)].filter(Boolean).forEach(source => params.append('source',source));
        const full=getJson(`${API_BASE}/api/stream?${params}`,20000,signal).then(({body})=>normalizeServers(body));
        let servers;
        if(onSources&&!/^sp:frenchstream:/.test(show.id||'')&&(show.tmdbId||show.offerings?.some(o=>o.provider==='fmovies')||/^fm:/.test(id))){
          const quickParams=new URLSearchParams(params);quickParams.set('mode','quick');
          const quick=getJson(`${API_BASE}/api/stream?${quickParams}`,5000,signal).then(({body})=>normalizeServers(body));
          full.then(choices=>{if(choices.length&&!(signal?.aborted))onSources(choices);}).catch(()=>{});
          servers=await Promise.race([full.catch(()=>quick),quick.then(choices=>choices.length?choices:full).catch(()=>full)]);
        }else servers=await full;
        if (servers.length) return { servers, via: "api" };
      } catch (e) {
        if (signal && signal.aborted) throw e;
        console.warn("[flixer] stream endpoint unavailable:", e.message);
      }
      if(API_BASE||!/^(mf:)/.test(id)||/^https:\/\/hdtoday\.sx\//i.test(sourceUrl || ''))return {servers:[],via:'unavailable'};
      const page = sourceUrl || `${SOURCE}/${String(id).replace(/^mf:[mse]:/, "")}/`;
      try {
        const ctrl = new AbortController();
        const abort = () => ctrl.abort();
        if (signal) { if (signal.aborted) abort(); else signal.addEventListener("abort", abort, {once:true}); }
        const timer = setTimeout(abort, 10000);
        let res, html;
        try { res = await fetch(page, {signal:ctrl.signal}); html = res.ok ? await res.text() : ""; }
        finally { clearTimeout(timer); if(signal)signal.removeEventListener("abort",abort); }
        if (res.ok) {
          const tabs = [];
          const reTab = /<button[^>]*class="[^"]*player-tab-btn[^"]*"[^>]*data-player-url="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
          let m;
          while ((m = reTab.exec(html)) !== null) {
            const url = m[1].trim().replace(/&#038;/g, "&");
            const name = m[2].replace(/<[^>]+>/g, "").trim() || "Player " + (tabs.length + 1);
            if (url && !tabs.some(t => t.url === url)) tabs.push({ id: tabs.length + 1, name, url });
          }
          if (tabs.length) return { servers: tabs.map(t => ({ id: "tab_" + t.id, name: t.name, type: "embed", embedUrl: t.url })), via: "page" };
        }
      } catch (e) {
        if (signal && signal.aborted) throw e;
        console.warn("[flixer] client-side source lookup failed:", e.message);
      }
      return { servers: page ? [{ id: "direct", name: "Source page", type: "embed", embedUrl: page }] : [], via: "direct" };
    }
  }

  window.Api = { FlixerApi, providersOf };
})();
