# Carateen

The Flixer provider uses the anonymous contracts published by
https://carateen.tv. The official APK download currently returns website HTML,
not an APK; no native package was installed or reverse engineered. The website
also publishes an installable PWA.

## Catalogue and updates

The public website supplies `/api/tvshows` and `/api/sp/tvshows`. The observed
snapshot on 4 November 2026 contained 779 source entries: 138 films and 641
series. These are source records, not unique merged titles or a claim that every
episode was tested. Provider IDs retain the TG/SP namespace and never become
TMDB IDs.

`/api/sp/recentEpisodes` supplies real episode entries. Source `updated_at`
changes when data is fetched, so it is deliberately excluded from release and
episode-update dates. Other guide changes are discovered by the existing
rotating episode refresh. An optional `carateen_backfill` input in the existing
GitHub workflow imports the two catalogue snapshots without resolving players
or walking every guide. Partial responses retain cached records and cursors.

Arabic display titles retain the source synopsis and artwork. Latin source
keywords are searchable but do not become identity aliases. The SP artwork CDN
requires requests without a Referer; artwork views use `no-referrer`.

## Episodes and playback

TG guides use `/api/episodes?id=…`; SP guides use `/api/sp/episodes?id=…`.
Episode membership is checked before resolution. SP source URLs use the public
episode slug, while its guest player request needs the internal episode ID.
The adapter translates that pair only from the matching source guide.

Season zero means unclassified in this source. Opening credits retain their
actual ID and unknown episode number. Film editions are separate player choices,
not an episode sequence. Japanese audio alone does not imply Arabic subtitles.

The ordinary website uses a public client identifier and a published metadata
envelope. The shared decoder reads that envelope with WebCrypto; no account
tokens or private application credentials are used. Player requests follow the
published anonymous branch. Actual sign-in or access denials remain failures.

Returned HLS URLs are validated against the observed media host and paths.
Media3 streams directly from that source inside the app; Netlify resolves
metadata and does not relay the video. Source links are resolved when playback
is requested instead of committing permanent guesses to the catalogue.

## Verification

The adapter was checked against the live 779-entry snapshot, actual recent
episodes, TG intro numbering, and SP film editions. Four representative TG/SP
episode/film routes delivered playlists and media bytes and subsequently
advanced in Android's inline Media3 player. The first cold TG attempt needed a
longer retry before meeting the playback-clock test. This is sample coverage,
not a guarantee about all 779 entries or future upstream availability.

Tests cover strict IDs/URLs, guest response decoding, incomplete data, episode
parent membership, language editions, keyword search, source access failures,
and importer cursor/cache preservation.
