# Flixer

Flixer covers movies and TV shows across all genres, with its own interface, universes, streaming services, and filters.

- Android app backed by [hosted catalogue and API](https://flixer-mu.vercel.app)
- Repository: [FediMechergui/flixer](https://github.com/FediMechergui/flixer)
- Android downloads: [Releases](https://github.com/FediMechergui/flixer/releases)
- Playback diagnostics: [device verification, recovered alternatives and missing files](docs/playback-verification-2026-10-20.md); [original 89-route HTTP investigation](docs/playback-failures-2026-10-20.md).
- Dahsha is maintained in its [own repository](https://github.com/FediMechergui/dahsha).

## Run locally

Requires Node.js 22 or newer. Android builds additionally require Java 21 and the Android SDK.

```sh
npm run setup
npm run snapshot:restore
npm run export -- --cached
npm run dev
```

The repository defaults to **Flixer**. The default commands do not build or deploy Dahsha.

| Command | Purpose |
|---|---|
| `npm run dev` | Run Flixer locally |
| `npm run start` | Build and serve Flixer |
| `npm run build` | Build the static website |
| `npm run export -- --cached` | Export the restored catalogue |
| `npm run refresh:providers` | Incrementally refresh this app's providers |
| `npm run test` | Validate providers, catalogue policy, and media handling |
| `npm run publish` | Deploy this repository to its linked Vercel project |

## Project layout

- `client-terrarium/`: Flixer's frontend source.
- `server/src/`, `api/`, `shared/`: provider discovery, metadata matching, and playback.
- `client/public/data-flixer/`: generated catalogue; excluded from Git.
- `client/dist-flixer/`: generated website; excluded from Git.
- `mobile/`: Capacitor Android wrapper.

The repositories retain independent copies of the common provider infrastructure and compatibility tests. No build requires the other repository's working folder. Generated catalogues and old compiled frontend files are not source code.

## Android

```sh
npm ci --prefix mobile
npm run build:mobile -- --data-base https://flixer-mu.vercel.app
npm run sync --prefix mobile
```

Build `assembleRelease` from `mobile/android/`. The application ID is `app.flixer.stream`.
Release signing uses a private `mobile/keystore.properties` and keystore; neither belongs in Git. Keep the existing signing key when publishing updates.

## Hosting and refresh

Flixer's Android APK integrates Myflixer, FMovies, cached HDToday, WCO, AnimeGG,
MegaCartoons, ToonTales, MyAsianTV, MultiMovies, YoTurkish, Tuniflix, CimaTN,
StreamTunisie, Kirmalk, AhwakTV, EgyDead and Cinetimes. Search and catalogue discovery combine
providers; matching titles retain existing IDs and gain player choices. Uncertain
editions remain selectable rather than having their episode lists silently merged.

Regional collections cover Korean drama, Indian and Turkish media, anime, and
cartoons. Anime sub/dub filters use explicit version evidence. Sources with
absolute or unknown episode numbering appear under their own source episode list;
their numbers are not converted into invented seasons. Player choices remember
the selected provider/version where available.

Specialist history crawls are incremental and receive independent turns alongside
regional FMovies scans. Recently advertised episodes refresh independently of the
historical crawl. This does not guarantee every upstream title or server is
available. See [specialist source contracts](docs/specialist-sources.md).

`vercel.json` targets Flixer's own Vercel project and build output. Configure `STREAM_PROXY_SECRET` in Vercel for signed stream proxy URLs. Local development uses an ephemeral key.

This repo's refresh workflow updates only Flixer and stores its cache in this repository's `data-snapshot` release. Android CI builds only Flixer. Scheduled Vercel deployment uses `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` repository secrets. Android signing uses `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Without signing credentials CI produces an unsigned APK.

Alternatively, `VERCEL_DEPLOY_HOOK` triggers a source deployment after a successful
snapshot refresh. This project hook is configured for Flixer's `main` branch and
stored as a repository secret. That path does not need a general Vercel API token.

Read [Scraper behavior](docs/SCRAPERS.md) and [Provider integration](docs/FMOVIES.md) for parsing, matching, and playback details. Upstream streams and artwork may be unavailable; failed requests retain imported catalogue data.

HDToday challenges GitHub's runner. Hosted refreshes retain its cached titles
and retry ordinary access while other providers continue updating. Independent
metadata feeds and PC refresh tasks are disabled; see
[HDToday refresh setup](docs/hdtoday-refresh.md).
[Arabic provider contracts](docs/arabic-sources.md) records catalogue, episode,
player and metadata handling, together with sources that did not pass validation.
Collection counts show saved titles; they are not upstream library totals.

## French sources and update behaviour

French Stream supplies its public movie catalogue and season-specific episode/server data. VF and VOSTFR remain distinct player choices. Only episodes with actual source links are imported; announced episodes without links are excluded. French originals require original-language evidence; dubbed international titles remain in the broader French catalogue.

DessinAnime supplies anonymous catalogue/search APIs and `/api/stream?playerId=...` for direct video. Source pages map real seasons, episode numbers, language choices and player IDs; verified MP4/HLS resources play inside Flixer. Android resolves temporary video URLs directly from the public source API when playback starts, keeping datacentre API blocks out of that request. Episode pages currently return 403 to ordinary server requests, so previously mapped source player IDs are retained. Unmapped guide entries do not become fake playable episodes or open a nested browser. A normally loaded source HTML export can be imported with `node scripts/import-dessinanime-page.js SOURCE_ID SOURCE_HTML`; no verification cookies are imported. Independently verified alternate providers remain available on matching titles.

Search starts requests to all registered providers concurrently and displays completed results while slower sources respond. Known alternate titles widen those requests; cancelled searches cannot overwrite a newer query. Arabic diacritics and spelling variants, accents and ampersands are normalized for search without weakening identity checks for merging.

The GitHub refresh workflow schedules latest-release passes every 15 minutes and deeper historical traversal every two hours. Scheduled jobs can be delayed by GitHub; they are not an exact-time guarantee. It scans latest listings, resumes historical catalogue cursors and rotates a bounded episode-detail queue across providers. This is eventual coverage, not a promise that every series is rechecked every two hours. A title opened in the app refreshes its series details after a short cache interval. Failures retain existing episodes and catalogue records. Hosted HDToday failures retain cached data until ordinary access is permitted.


## Regional and official show sources

J-drama, C-drama, French series, Canadian and French Canadian collections use verified country/language metadata across existing providers. Japanese animation is excluded from J-drama. French Canadian requires both Canadian origin and French original language.

One Pace uses its official watch page and linked public Pixeldrain file lists. Each arc is a distinct series, separate from regular One Piece. Only actual numbered MP4 files that permit external playback become playable episodes; English sub/dub, quality and closed-caption variants stay separate server choices. Files restricted to the official One Pace embed, MKV-only entries, unavailable files and source quota errors are not converted into fake streams. Media downloads go directly to the source rather than through Vercel.

Official YouTube shows are curated from GLITCH, Noob & Olydri, Muse Asia, Ani-One Asia, GUNDAM CHANNEL INTL and YOUKU English. Only sufficiently long, explicitly numbered episodes are imported. Trailers, clips, members-only entries and episode-range compilations are excluded. These channels are official sources, not a claim that every show is exclusive to YouTube. Regional restrictions still apply. `node scripts/import-official-shows.js` seeds their current catalogue and One Pace arcs; normal provider refreshes then continue traversal and episode checks.

The Vercel backend serves requests on demand. Its request functions cannot run an indefinite background scraper. The independent GitHub workflow refreshes snapshots while the app continues using the latest successfully published catalogue. Latest-only passes preserve historical cursors and skip expensive metadata audits. Provider errors preserve existing titles and episodes. New provider domains require a reviewed adapter; the server does not automatically trust or execute unknown sources.

Further French/Canadian candidates are [TV5MONDEplus](https://www.tv5mondeplus.com/fr/series) and [TV5 Unis](https://www.tv5unis.ca/collections/un-film-par-jour). They are not advertised as integrated players: geographic availability and account requirements need validation before an adapter is enabled.


## In-app players and faster publication

Android playback starts inline inside the title page. Direct Media3 video and the isolated third-party WebView follow the picture's position when the page scrolls; the source selector and Close stay in the page. Fullscreen requires the player button. Back or Inline restores the picture without restarting it; fullscreen retains Close and Next controls outside system-bar insets. Remote pages never receive the Capacitor bridge. Popups and SSL exceptions are disabled. YouTube keeps its existing embedded player; its top-level embed route can reject playback with error 153. Restricted One Pace files remain official-source links. Removed videos, account requirements and geographic restrictions still apply.

Closing a native player updates only its own active playback attempt. Switching servers or closing the watch screen prevents an older native-player response from replacing the current view.

The source selector sits below the picture with 44 px touch controls. After all advertised servers fail, one bounded alternate-source lookup runs automatically; manual server choices and closing the player cancel its UI changes. Fonts are bundled locally with their licenses.

Vercel builds package full title records into 256 compressed hash buckets instead of uploading one file per title. `/data/shows/:id.json` keeps the existing APK URL contract through a cacheable saved-title endpoint, including uncertain editions and full source synopses. Known episode playback can load its verified parent record from the same packs without parsing the whole deployment catalogue. Bootstrap and catalogue indexes remain static. The deployment's legacy catalogue fallback contains index metadata; full details come from the saved-title endpoint. A refresh with a deployment hook skips the redundant local static build before triggering Vercel.


## Cima4u and Arabic coverage

Cima4u (`cimafu.live`) uses public category pagination, structured title/parent-series metadata and the watch page's explicit server list. Arabic originals and Arabic-subtitled international media keep separate language evidence. Imports retain actual sparse episodes, known season numbers, source posters and synopses. Advertisements, related-title cards and unsupported player hosts are excluded. Its ordinary source requests can time out; cached records survive and incomplete pages retain their retry cursor.

Ahwak canonical series pages (`view-serie.php?id=...`) retain their actual season tabs. Reviewed metadata includes Bab Al-Hara's 303 linked episodes across seasons 1?10 and 13, and the 1993 Al-Za'eem play separately from similarly named series. The play includes a public Sham Cinema YouTube alternative. Reviewed records are merged into the latest restored snapshot on deployment and refresh; they never replace the existing catalogue.

CimaTN's source-listed Wix MP4 choices now use the in-app video player. Additional observed iframe hosts are recognized, while source posts without a working watch configuration remain catalogue entries. Tuniflix 403 responses preserve cached data. Blocked providers retry with bounded backoff (up to an hour), including exclusion from episode checks during cooldown.

### Android direct media and embedded players

Android uses a separate Media3 surface for source-provided MP4, HLS and DASH URLs. The device requests video manifests, segments and files directly from the source CDN. `/api/stream?transport=direct` returns direct Myflixer media choices without generating segment-proxy URLs; older APKs retain their existing transport. Vercel still serves catalogue/search/title data and resolves source links. Source-provided request headers are limited to Referer and User-Agent in the native media client.

Approved HTML players open in an isolated Android WebView with Close and Next source controls, with no Capacitor bridge exposed to remote pages. Main-document HTTP errors and known missing-video messages advance to the next source. Official YouTube embeds retain their supported iframe integration. Native media reports position and duration back to Flixer; navigating away releases the player. Source sites' restrictions and expired/deleted files still apply.

Cima4u HG choices can resolve their published HLS configuration directly on the device. A bounded string-table decoder reads public configuration without executing downloaded JavaScript, checks advertised manifests, and keeps the original embedded source as a fallback. Source metadata and video requests go directly from Android to the source/CDN, avoiding Vercel segment traffic and datacentre-bound media URLs. The built-in decoder is bundled with the APK. French Stream premium-only slots are excluded from public player and episode choices.

For device verification, build a debuggable APK and open the debug-only `PlayerAuditActivity`. `node scripts/verify-native-player-routes.js --input PATH --output PATH --seconds 30` exercises its real WebView/Media3 players and saves each completed case atomically. Input cases identify the title, provider, type and current `retest.url`; temporary URLs and captured documents stay in ignored artifacts. Playback requires an advancing content-video clock; a loaded page is insufficient. Human-verification prompts remain manual, and interrupted test infrastructure must be retested separately from source failures. The audit activity and page are excluded from release builds.

Run `node scripts/audit-provider-matrix.js` for catalogue samples, then `node scripts/audit-player-routes.js` to probe every advertised route for each sampled title's first actual episode. Reports in `artifacts/` distinguish HTTP reachability, source errors and Android host support; HTTP 200 does not certify playback. Full catalogue import and universal playback are not guaranteed by those sample audits.

### Player advertising controls

Android filters known advertising and audience-tracking requests in both the isolated player and the main WebView, including service-worker requests. Rules are local; playback adds no filtering requests to Vercel. Popups remain blocked. A bundled cleanup script hides explicit ad containers while retaining video, subtitle and playback controls. Public MP4/HLS/DASH sources use native playback without loading the host's webpage.

When an embedded player exposes an already-playing, visible public media URL, Flixer can hand it to the native player at the current position. Short clips, hidden videos, blob URLs and encrypted media are excluded from that handoff. If native playback fails, the original player reopens once with handoff disabled. Source access gates and upstream blocks are skipped rather than presented as working video. Ads encoded into the video stream and new unrecognized ad networks are not guaranteed to be removed.

Latest refreshes are scheduled at minutes 02, 17, 32 and 47; historical traversal remains every two hours. GitHub scheduling and deployments can delay publication. App polling stays unchanged, and source crawls run outside app navigation. Snapshot restores retry transient failures and validate the complete archive before promoting any files. `node scripts/audit-provider-matrix.js` writes a read-only first-page/type/category sample report; successful server resolution or HTTP responses are not labelled as confirmed video playback.
