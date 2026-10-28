# Arabic source expansion and home responsiveness — 28 October 2026

Flixer 1.6.28 adds Aloula's public guest episodes and Tunisian films and series from Watania Replay. Existing Arabic adapters now revalidate rotating player links, and supported Android sources resolve on the phone alongside the backend. Dahsha is unchanged.

## Home and update ordering

The hero and twelve-item recent rail render before optional rankings, collections, universes, services or a slow saved resume lookup. Rankings select and cache a bounded set rather than sorting the entire catalogue separately for each rail. A regression fixture holds resume and metadata requests open and verifies that the hero and recent cards still render.

Recent cards distinguish actual episode changes, source publication dates and library additions. Metadata repairs and routine provider checks alone do not promote a title as a new release. The full recent catalogue remains accessible through See all.

Android API 35 testing at 360 CSS pixels found no document overflow. In one debug APK Movies/Home navigation, the current hero and recent section returned in approximately 1.1 seconds. This includes debugger overhead and is neither a cold-start benchmark nor a measured comparison with the previous APK. The signed APK was installed in place over 1.6.27; the saved Continue Watching row remained visible.

## New source integrations

- [Aloula](https://aloula.sba.sa/en): public programme listings, actual season IDs, paginated episode guides and source-provided HLS. Guest access is checked before resolving a player; subscription, regional restrictions and DRM are not bypassed. Audio-only programmes, trailers and foreign-parent episodes are excluded.
- Watania Replay: the official channel linked by [Tunisian Television](https://www.tunisiatv.tn/ar). The importer traverses episode and film searches separately, preserves source numbering, retains unknown seasons, and rejects promotional clips and compilations. Arabic titles retain advertised Latin aliases. Confirmed examples include the film Bab Benat and episodes of Doctor Love through its existing Tuniflix offering.

The [published refresh](https://github.com/FediMechergui/flixer/actions/runs/40606421127) traversed twelve pages per lane and added 402 source records, containing 246 collected episodes, across Aloula and Watania. After catalogue merging and the regular provider refresh, the live library increased from 104,901 to 105,289 titles. The backend serves generation `2026-10-28T00:09:01.471Z`; normal app requests return Aloula HLS and the Watania film's YouTube choice from this publication.

None of the three archive lanes has reached its end. These figures are not a claim that the entire archive has been imported or that every entry has passed a playback test. The scheduled single-writer importer persists each lane's cursor and continues during historical refreshes. Its coverage report is retained with subsequent workflow artifacts.

## Existing Arabic player fixes

Android resolves published source links directly for Tuniflix, EgyDead, Cima4u, AhwakTV, Kirmalk, StreamTunisie and Aloula. Fixed source identities and approved player hosts constrain those requests; no downloaded source JavaScript is evaluated. Source requests share a short cache. Cancelling one caller does not poison the shared cache.

An empty backend response now waits for a pending device lookup. Later backend/device choices extend the same server list without interrupting active playback. Successful embedded playback also remembers the working source preference.

EgyDead serves a separate `.mob-servers` list on Android. Adding that selector changed the same device lookup from zero to three own-source players. Its HG route subsequently played using Media3. Existing Arabic server snapshots are revalidated through the shared two-minute source-page cache; approved old links survive transient failures, but explicit refreshes and authoritative 404/410 removal do not silently return them.

## Playback evidence and remaining gaps

The [per-server emulator report](provider-playback-audit-2026-10-28.md) covers 13 own-source choices across nine samples, representing eight distinct titles and two episodes of one Aloula series. Six passed the advancing-content-clock criterion:

- Tuniflix: Needle on Uqload and Doctor Love on YouTube.
- EgyDead: Raheen on HG/Media3.
- Aloula: the first and last episodes of Alzafer on its HLS CDN.
- Watania Replay: Bab Benat on YouTube.

CimaTN's Dailymotion route was denied; its VK route did not produce an advancing clock during the sample. Two StreamTape routes and EgyDead's Morencius route failed. Mixdrop and the second Watania film remained unconfirmed. Catalogue access, a returned player link or HTTP 200 is not playback proof. These results do not establish playback for every programme, episode, country or device. Previous HDToday and WCO access limitations remain unresolved. The hosted refresh also retained cached records for blocked FMovies, DessinAnime and One Pace requests, Kirmalk's changed origin and Cima4u's partial response; a successful publication does not mean every upstream refresh succeeded.

The isolated playback sweep used the initial 1.6.28 debug APK; its exact digest is recorded per case. The final APK additionally contains the verified mobile-list selector and nonblocking resume-row change. Those final paths were checked in a second emulator and covered by automated regressions; native player code is the same.

## Validation and publication

All 276 Node tests pass, including source access/identity, sparse episode pagination, Arabic episode numbering, film/clip classification, device/backend source races, cancellation, freshness and home rendering. Android unit checks, release lint and both APK builds pass. The final home fixture also verifies a delayed Continue Watching lookup.

Catalogue refreshes publish data independently of the deployed backend. Latest discovery remains scheduled every fifteen minutes, with historical source traversal every two hours; GitHub queue and upload time can delay visibility. Videos transfer directly from their source/CDN to Android. Netlify serves the small API and metadata functions, rather than carrying video segments or being redeployed by catalogue polling.
