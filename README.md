# Flixer

Flixer covers movies and TV shows across all genres, with its own interface, universes, streaming services, and filters.

- Website: [Flixer](https://flixer-mu.vercel.app)
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

Flixer integrates Myflixer, FMovies, HDToday, AnimeGG, MegaCartoons, ToonTales,
MyAsianTV, MultiMovies, and YoTurkish. Search and catalogue discovery combine
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

HDToday challenges GitHub's runner. The hosted refresh can import a validated
metadata feed produced by an environment with ordinary access; see
[HDToday refresh setup](docs/hdtoday-refresh.md). The feed has its own timestamp,
expires after 36 hours, and never replaces the other providers' snapshot.
[Arabic source research](docs/arabic-sources.md) records candidates and remaining
playback/coverage checks; these candidates are not advertised as integrated.
