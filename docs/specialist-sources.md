# Specialist catalogue research

Checked 15 October 2026. FMHY is a discovery directory, not a streaming API:
https://fmhy.net/video and https://fmhy.net/non-english.

## Working regional discovery

Flixer forwards collection filters to `/api/discover`. FMovies supports country
filters on `/movies` and `/tv-series`: KR (Korean), IN (Indian), TR (Turkish),
and JP with genre 16 (Japanese animation). Actual selected filter options are
checked before assigning country metadata. Imported titles retain the existing
conservative matching and playback resolution paths.

Live first-page checks returned 20 titles each: Korean series (42 pages), Indian
films (116 pages), Japanese animation series (95 pages), Turkish series (10 pages).
These are upstream pagination counts, not counts of imported or playable titles.
Some page-first query strings incorrectly returned empty results; requests now
put regional filters first. Provider pagination and contents can change.

Original language and country do not establish player subtitle or dub availability.
Sub/dub collections require explicit audioMode evidence. Classic cartoons are
animation titles dated before 2000. Unknown origin is not proof of western origin.

## Integrated specialist adapters

The adapters live in `server/src/specialist-providers.js` and feed unified search,
discovery, title hydration, playback, and the scheduled provider refresh. Source
IDs reconstruct fixed origins and validated paths. No caller URL can authorize a
different origin. Player markup is parsed as data; upstream scripts are never
executed by the server. Browser research used a disposable local Edge context.

| Provider | Catalogue and episode contract | Playback |
| --- | --- | --- |
| AnimeGG | `/popular-series?sortBy=createdAt&sortDirection=DESC&limit=25&start=N`; live pagination advertised 11,320 source entries, 453 pages. `/search/auto/?q=…` is public JSON. POST `/index/recentReleases` supplies actual recent episode/version records. `/series/{slug}` lists real episode links and sub/dub badges. | Episode page `#videos` exposes media IDs and version labels; `/embed/{mediaId}` keeps short-lived video URLs in the provider's own context. Browser check reached video readyState 4. Dragon Ball Z exposed 291 episodes. |
| MegaCartoons | Series menu links `/video-serie/{slug}/`; title archive `page/N/` and `maxPages` establish pagination. Courage the Cowardly Dog exposed 71 titled entries. | Read the public JW Player `file` field, restricted to `ww.megacartoons.net`. A sampled MP4 returned HTTP 206 and video/mp4. |
| ToonTales | The home grid is random. `sitemap_index.xml` lists `video-sitemap*.xml`, providing stable short-film URLs and artwork; paginated locally in batches of 24. | `/short/{slug}/` exposes a public JW Player MP4 on `ww.toontales.net`. A sampled MP4 returned HTTP 206 and video/mp4. |
| MyAsianTV | `/drama/` and `/movies-list/` supply paginated source containers. `/series/{slug}/` supplies country/year metadata and actual episode links. The source also uses `/series/` for films; explicit Full Movie labels establish film classification. | Episode `iframe#b[title=video]` points to an approved `zumivids.com/embed/*.html` player. Advertisement frames are excluded. |
| MultiMovies | FMHY's `multimovies.wtf` links to `multimovies.garden`. `/movies`, `/series`, `/episodes`, and `/genre/{slug}?page=N` are public listings. `/api/search?q=…&limit=30` supplies JSON results. Explicit Indian categories include Bollywood, South Indian and Punjabi. | Title/episode pages embed JSON `watchItem` and `watchConfig.initialServers`. Season switching uses `?season=N`; the explicit `seasonEpisodeNumbers` list supplies entries beyond visible cards, without generating missing numbers. Six approved embed hosts are currently supported. Internal titleId is never treated as a TMDB ID. |
| YoTurkish | `www1.yoturkish.com/series/` and `/episodes/` provide series and recent-episode listings. Title `#episodes` links retain absolute numbering across seasons. Kurulus Osman exposed 194 entries and explicit Turkey/year metadata. | Public `data-s1`…`data-s5` player markup uses base64, reversed bytes, a shift of five and an eight-byte public client XOR constant. The adapter validates decoded iframe hosts and never evaluates the obfuscated script. Four player choices were verified against the browser-loaded page. |

The native app permits explicit Source links to these six fixed catalogue origins,
while retaining its existing protection against player advertisements navigating
the main WebView. Normal source/player access is used; no account, premium access,
CAPTCHA, or DRM is bypassed. Changes to formats fail closed and cached imported
records remain available.

## Other candidates and limitations

| Source | Evidence | Integration status |
| --- | --- | --- |
| WCO (`www.wcostream.tv`) | Public cartoon/anime series directories, search and real episode guides; movies are not imported by this adapter. | Android search/details and published MP4 configuration resolve on the device; SD/HD/FHD native playback verified on a classic-cartoon sample. Hosted catalogue requests can return 403. See [current integration and verification](wco-integration.md). |
| KissKH (`kisskh.ovh`) | Public Angular bundle sets baseUrl `/api/`. Verified GET `/api/DramaList/LastUpdate?ispc=true` and `/api/DramaList/Search?q=love&type=0` returned JSON records. | Research only. Bundle also references `/api/DramaList/Drama/{id}?isq={bool}` and `/api/DramaList/Episode/{id}.png?err=…&ts=…&time=…&kkey=…`. Episode request depends on generated key; details and playback not verified. Never fabricate its request key or infer streams from catalogue presence. |
| Miruro (`www.miruro.com`) | Homepage accessible; FMHY describes sub/dub anime support. | No verified episode/player contract yet. |
| YoTurkish (`www.yoturkish.com`) | Redirects to the verified `www1.yoturkish.com` catalogue. | Integrated above; individual third-party servers can still be unavailable. |
| Einthusan (`einthusan.tv`) | FMHY lists South Asian films, noting VPN/region limitations. | External link only; no verified playback contract. |

KissKH, Miruro and Einthusan remain research candidates or external links. WCO now has the native integration described above.
They are not counted as integrated catalogue entries. A future adapter
must retain source episode IDs and real numbering, explicit audio/subtitle variants,
latest-update pagination, and uncertain editions without silently merging them.
Anime absolute numbering must not be converted to invented seasons. Keep provider
failures distinct from valid empty pages and retain previously imported records.

## Latency changes

Known client episodes bypass optional title/TVmaze refresh. Known server episodes
also bypass repeated title enrichment; unknown entries still resolve before play.
Search paints local matches before broader provider search. Player requests can
be cancelled when closing, HLS startup is bounded, and failover visits remaining
servers once, including earlier alternatives. Embed timeout hints never interrupt
a cross-origin player whose actual playback state cannot be observed.
