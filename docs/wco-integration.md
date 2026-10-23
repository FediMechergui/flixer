# WCO public series integration

23 October verification: fresh emulator playback passed for Gravity Falls S1E1,
Scooby-Doo S1E1 and subtitled Haikyuu S1E1. The hidden resolver now observes
ordinary fetch configuration responses as well as XHR responses and does not
load poster images. Explicit source refresh clears resolver caches and updates
alternatives while preserving a playing stream. Fullscreen native controls
overlay the picture, hide after three seconds, and hide Android system bars;
Back restores inline playback and the previous system-bar state.

WCO cartoon/anime series now use device-side search, source metadata and native
MP4 playback. Dahsha's documentary catalogue is unaffected. The movie directory
is not imported by this adapter. Account-only releases are not granted access.

## What wco-dl establishes

Reviewed the public code in [wco-dl's Lifter.py](https://github.com/iiEpic/wco-dl/blob/master/Lifter.py),
[WCO_Stripper](https://github.com/kjgthecoder/WCO_Stripper) and
[WCO_wrapper](https://github.com/Cxspr/WCO_wrapper). No third-party code was
executed or copied into the application. WCO_Stripper reads a rendered video;
the wrapper contains older catalogue selectors. wco-dl's useful contract is:
episode page → publisher iframe → `getJSON` configuration → published
`enc`/`hd`/`fhd` qualities at the configuration's server `/getvid?evid=…`.
Its disabled TLS verification, outdated selectors, assumed season 1 and fixed
configuration origin are not carried over.

The current [WCO site](https://www.wcostream.tv/) publishes its configuration
under `https://embed.wcostream.com/inc/embed/getvidlink.php`. Direct probes
returned 403; the real publisher-frame request returned 200. Its sample media
returned 404 when fetched with a different User-Agent, and 206 video/mp4 when
the same honest `Flixer (Android)` identity was retained. Both
`neptun.wcostream.com`, the legacy anime `cdn.wcostream.com` and subbed-anime
`ndisk.wcostream.com` were observed in published configuration. On 21 October,
Gravity Falls published `lb.wcostream.com`; that exact load-balancer origin is
also supported after native playback verification. Other origins
are rejected. Individual redirect destinations stay within the source's normal
media delivery flow; the app does not invent a replacement media host.

## Runtime

`WcoSourcePlugin` creates a temporary isolated WebView in the real source context.
The remote page has no Capacitor bridge, file access, native HTTP interface or
app storage access. A narrowly scoped message listener observes the publisher's
normal successful configuration response. It does not manufacture tokens,
modify response data, disable TLS, remove playback timers or evaluate downloaded
JavaScript on the server. The publisher's ordinary Close button is used only
after its own countdown enables it. Resolution times out after 35 seconds;
cancellation, superseding a request and leaving the app destroy the WebView.
The publisher's `/inc/embed/full-capacity.html` terminal page reports a typed
capacity failure immediately instead of waiting for the 35-second watchdog.
The app preserves that reason while trying other matched sources, displays it
if all choices fail, and removes the resolving indicator. Timeouts have their
own message. Failed requests are not cached, so an explicit retry requests new
configuration. No capacity cookie, redirect or access restriction is changed.
Device requests prioritize playback, then selected-title details, then search.
A late background search receives a busy result while details/playback are
opening instead of destroying their source view. New requests of the same kind
still supersede old ones. This prevents a cached search hit from opening a
permanently empty episode guide when its live search completes later.

The resolver validates the published server and quality tokens, preserves the
User-Agent, and passes fresh HD/SD/FHD choices to the existing inline Media3
player. No publisher web player, promotion or nested navigator is displayed.
Ads and popups remain filtered. Successful source metadata is cached for two
minutes; failed resolutions are not cached. Explicit source refresh clears it.
Missing qualities are omitted rather than generated. Full-length playback is
not inferred merely from a configuration response.

Source search posts `catara` and `konuara=series` to `/search`. Native search runs
alongside the other providers even when the hosted provider list predates WCO.
Live providers start before the full saved index finishes; late index matches
are appended without discarding live results. Native WCO details skip hosted
snapshot requests, and empty/denied detail responses have a bounded retry window
instead of repeatedly reopening the source. Existing matched providers are
loaded alongside WCO without delaying its first playable choice.
Source series pages supply posters, synopsis, alternate names and real episode
links. Source IDs retain the parent series and exact episode slug. Sub/dub
versions remain distinct. Explicit numeric/ordinal seasons override everything;
the misleading `data-season=s1-0` group is not a season identity. WCO lists a
series' first season as plain `Episode N` entries and labels only later seasons,
so when a guide contains explicit later seasons and no explicit season 1, plain
entries whose slug is the series slug followed by `episode-N` become season 1
(Gravity Falls: 20 first-season episodes, 21 season-2 entries). A guide without
labelled later seasons stays a single source list. Shorts, OVAs, specials and
arc-labelled entries retain source numbering, with no invented episodes.

Backend discovery supports `/cartoon-list`, `/dubbed-anime-list` and
`/subbed-anime-list`, deduplicating modes for the same source series. Genuine
recent-release links use their actual `.ildate` parent breadcrumb, never a
guessed parent slug or an alphabetic directory relabelled as an update. These
requests can still be denied by the upstream site. Refresh errors preserve
previous cached data; native search/details do not depend on hosted access.
No claim is made that every archive entry or account-only title is playable.

## Verification

- 21 October, version 1.6.20: Gravity Falls S1E1 initially returned published
  SD configuration from `lb.wcostream.com`, which the older three-origin
  validator rejected. With that exact host supported, the native content clock
  advanced from 0.719 to 3.552 seconds, with duration 1,268.837 seconds.
  Fresh component checks also played Scooby-Doo S1E1 and subtitled Haikyuu S1E1.
  All three stayed inline; Close removed the native surface and left no source
  WebViews. These are short playback proofs, not full-episode completion tests.
- An emulator regression check started Gravity Falls details and background
  search together: search returned `WCO_BUSY`, while details completed normally
  with 48 source entries in about 3.7 seconds, rather than being superseded.
- In the full application, opening a cached Gravity Falls search result loaded
  the source guide and selected the real first episode. The first playback
  attempt timed out and displayed the timeout message without a stuck spinner.
  Refresh servers then played the episode (0.113 to 2.995 seconds; duration
  1,268.837 seconds). Close returned to the title page with all 48 source entries
  retained. Upstream response time remains variable; this is not an assurance
  that every initial attempt succeeds.
- 188 Node tests pass, including capacity handling, fresh retries, failover to
  other providers, cancelled requests and escaped failure messages. Android
  unit tests, release lint and signed debug/release builds pass; lint reports
  zero errors and 25 existing warnings.
- Android API 35 emulator: Scooby-Doo S1E1 SD, HD and FHD played natively; duration
  1,313.344 seconds. A sustained SD check advanced from 1.049 to 336.608 seconds
  and closed normally at 337.639 seconds, without a playback error.
- Device search returned 13 Scooby-Doo series, all with source posters. Device
  details returned 41 Scooby-Doo and 178 Haikyuu episode links, with source
  artwork and synopsis. These are source entries, not an assertion of unique
  canonical episode counts across language versions.
- A One Piece guide returned 2,440 source episode entries in about 2.3 seconds;
  its 1.03 MB page remained within the resolver's bounded metadata size.
- End-to-end Flixer component checks passed for the classic cartoon and
  Haikyuu's English dub. A clean app-data test then played Haikyuu S1E1 English
  subbed through the `ndisk` route, without inherited verification/account
  cookies. The native surface stayed inline and displayed no source web player.
- End-to-end fresh configuration, native playback and language-version tests
  are recorded in local `artifacts/wcodl-*-native-results.json`. Signed queries,
  captured HTML and raw configuration are intentionally excluded from Git.
- Signed 1.6.19 release on the API 35 emulator: typing "gravity falls" painted
  the saved-index matches first and appended the device WCO result about
  ten seconds later. The WCO entry showed Season 1 (20 episodes) as the default
  list, Season 2 (21 entries) and a 7-episode shorts source list. Starting
  S1E1 reached the publisher frame, whose announcement countdown was followed
  by "All servers are at full capacity, become a premium user or try again
  later"; the app reported no available player. That is the source's own
  capacity gate, so no stream was invented; Scooby-Doo S1E1 resolved HD
  configuration during the same session.
- `server/test/wco.test.js` covers origin/path validation, sparse guides,
  language versions, unknown seasons, premium exclusion, update identities,
  publisher-request observation, token validation and User-Agent consistency.

The integration follows existing conservative catalogue matching. A shared
episode number without reliable season evidence cannot merge distinct arcs or
audio versions into one episode.
