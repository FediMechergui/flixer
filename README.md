# Flixer

Flixer covers movies and TV shows across all genres, with its own interface, universes, streaming services, and filters.

- Android app backed by [hosted catalogue and API](https://flixer-mu.vercel.app)
- Repository: [FediMechergui/flixer](https://github.com/FediMechergui/flixer)
- Android downloads: [Releases](https://github.com/FediMechergui/flixer/releases)
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

Flixer's Android APK integrates Myflixer, FMovies, cached HDToday, AnimeGG,
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

The GitHub refresh workflow schedules latest-release passes every 30 minutes and deeper historical traversal every two hours. Scheduled jobs can be delayed by GitHub; they are not an exact-time guarantee. It scans latest listings, resumes historical catalogue cursors and rotates a bounded episode-detail queue across providers. This is eventual coverage, not a promise that every series is rechecked every two hours. A title opened in the app refreshes its series details after a short cache interval. Failures retain existing episodes and catalogue records. Hosted HDToday failures retain cached data until ordinary access is permitted.


## Regional and official show sources

J-drama, C-drama, French series, Canadian and French Canadian collections use verified country/language metadata across existing providers. Japanese animation is excluded from J-drama. French Canadian requires both Canadian origin and French original language.

One Pace uses its official watch page and linked public Pixeldrain file lists. Each arc is a distinct series, separate from regular One Piece. Only actual numbered MP4 files that permit external playback become playable episodes; English sub/dub, quality and closed-caption variants stay separate server choices. Files restricted to the official One Pace embed, MKV-only entries, unavailable files and source quota errors are not converted into fake streams. Media downloads go directly to the source rather than through Vercel.

Official YouTube shows are curated from GLITCH, Noob & Olydri, Muse Asia, Ani-One Asia, GUNDAM CHANNEL INTL and YOUKU English. Only sufficiently long, explicitly numbered episodes are imported. Trailers, clips, members-only entries and episode-range compilations are excluded. These channels are official sources, not a claim that every show is exclusive to YouTube. Regional restrictions still apply. `node scripts/import-official-shows.js` seeds their current catalogue and One Pace arcs; normal provider refreshes then continue traversal and episode checks.

The Vercel backend serves requests on demand. Its request functions cannot run an indefinite background scraper. The independent GitHub workflow refreshes snapshots while the app continues using the latest successfully published catalogue. Latest-only passes preserve historical cursors and skip expensive metadata audits. Provider errors preserve existing titles and episodes. New provider domains require a reviewed adapter; the server does not automatically trust or execute unknown sources.

Further French/Canadian candidates are [TV5MONDEplus](https://www.tv5mondeplus.com/fr/series) and [TV5 Unis](https://www.tv5unis.ca/collections/un-film-par-jour). They are not advertised as integrated players: geographic availability and account requirements need validation before an adapter is enabled.
