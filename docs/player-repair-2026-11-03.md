# Flixer 1.6.31 player repair — 3 November 2026

For the later HDToday, Arabic and French fixes, see the [Flixer 1.6.32 follow-up](inline-followup-2026-11-03.md). The results below describe 1.6.31.

This release changes the Android player as well as the backend. **Installing
Flixer 1.6.31 (version code 10631) is required for the native player fixes.** A
backend refresh alone cannot update the native host policy or bundled player.
The earlier advice that no new APK was needed was incorrect: the preceding
backend update introduced player hosts that the old APK's native policy rejected.
This release supplies the missing native support as well as further player fixes.

Backend code `f0b74c6` is deployed in Netlify deployment
[`6ae9bef2a980aa7096647f07`](https://app.netlify.com/projects/flixer-api-fedimechergui/deploys/6ae9bef2a980aa7096647f07).
[Flixer 1.6.31](https://github.com/FediMechergui/flixer/releases/tag/flixer-v1.6.31)
is published with the signed APK and checksums. GitHub's APK asset digest matches
the locally verified file. Both native audit matrices are complete, and the test
emulator was stopped after the manual follow-up.

## What changed

- DessinAnime retains the exact source iframe alongside a known direct-player
  ID. If its direct API cannot resolve, the player can try that actual source
  frame instead of losing the episode's alternative.
- The resolver preserves both HLS and MP4 when the source explicitly returns
  them, along with source-provided quality choices. Source referrer and user-agent
  headers accompany direct playback. No player IDs or media URLs are invented.
- Android requests the public DessinAnime stream API through explicit native
  HTTP, with fixed-origin validation and bounded timeouts. This is transport
  hardening: **CORS was not established as the cause of the old APK's failures**.
  Version 1.6.30 already reached `DirectVideo` through Capacitor's existing fetch
  patch in a comparison test.
- Expanding a deferred source into several actual player choices now keeps
  failover attempt indices aligned and tries the first expanded choice. Resolver
  failures are retained as source errors instead of silently disappearing.
- The native player admits the actual newly observed French player routes:
  Frembed, Emmmmbed, Xtremestream and narrowly specified alternate host paths.
  Health and progress messages remain restricted to approved origins.
- Kirmalk follows its verified move from `.art` to `.blog`, retains saved source
  identities, and accepts its published HD-VK embed on the exact approved path.
  Unrelated hosts, credentials, ports and arbitrary paths remain rejected.
- An explicit HDToday refresh now bypasses its resolved-player cache and removes
  old redirects before a fresh attempt. A failed refresh cannot resurrect an old
  cached redirect on the next request. Documented TMDB routes still carry an
  unverified-availability label.
- Myflixer resolution errors are reported instead of becoming an unexplained
  empty server list. Uqload's HTTP 200 deleted-file message is correctly classified
  as missing media.

## Automated validation

- **340 Node tests passed** in the final full suite, including the public report
  exporter's three regression tests.
- **16 Android unit tests passed**, with zero failures, errors or skips across
  six suites: HLS initialization (6), player advertising policy (4), player HTTP
  policy (1), source-player policy (3), WCO HTTP policy (1), and the existing
  example unit test (1). Counts come from the Gradle XML results in
  `mobile/android/app/build/test-results/testDebugUnitTest`.
- The provider delivery audit script passed its syntax check; the changed files
  passed `git diff --check`.

## Native playback audit

All **six sampled DessinAnime.cc cases** now show an advancing Media3 content clock
in the production player inside the Android emulator using **1.6.31-audit**.
Les Simpson and Bluey succeeded on retest after an initial timeout and stall;
the earlier attempts remain recorded. An additional DessinAnime.net Ben 10 sample
also played through its Emmmmbed route, bringing the current confirmed total to
**seven distinct French cartoon samples**:

| Sample | Current result | Clock evidence |
| --- | --- | --- |
| Avatar: The Last Airbender S1E1 | Playback confirmed | 0.447 → 4.122 seconds; duration 1,419.668 seconds |
| Fullmetal Alchemist: Brotherhood S1E1 | Playback confirmed | 0.897 → 4.926 seconds; duration 1,467.632 seconds |
| Miraculous S0E1 | Playback confirmed | 1.128 → 3.130 seconds; duration 1,270.229 seconds |
| Sampled Avatar Aang film | Playback confirmed | 1.866 → 3.878 seconds; duration 6,009.904 seconds |
| Les Simpson S1E1 | Playback confirmed on retest | 0.113 → 3.271 seconds; duration 1,395.241 seconds |
| Bluey S1E4 | Playback confirmed on retest | 0.776 → 3.277 seconds; duration 433.237 seconds |
| Ben 10: Alien Force, DessinAnime.net | Playback confirmed in WebView | 0.108 → 4.086 seconds; duration 1,299.958 seconds |

These are short observed playback samples, not complete-film or every-episode
validation. HTTP 200 pages, HLS playlists, media bytes and a native `playing`
callback alone do not count as a playback confirmation.

The French matrix completed **14 routes with seven confirmations**. The remaining
sampled Frembed and Xtremestream choices did not show advancing playback. The
broader **12-case, ten-provider native matrix** completed with **eight
confirmations**: Aloula, MegaCartoons, ToonTales, Cinetimes, Tuniflix Uqload,
CimaTN YouTube, WCO and Kirmalk HD-VK. CimaTN Dailymotion denied access; its VK
route, FMovies Vidcore and the sampled HDToday VidSrc route did not show advancing
video in their observation windows.

Combined, **26 of 26 selected routes were tested, and 15 showed advancing
playback**. Retries remain in the history and do not increase route coverage.
The [sanitized JSON report](player-repair-2026-11-03.json) contains the individual
results. Inputs and private checkpoints are under
`artifacts/player-repair-2026-11-03/dessin` and
`artifacts/player-repair-2026-11-03/providers`.

A separate [manual follow-up](player-repair-manual-2026-11-03.json) confirmed the
same FMovies Vidcore route after pressing its ordinary triangular Play button.
Its visible, unpaused video advanced from 4,870.245 to 4,874.293 seconds; an earlier
seek is excluded from that evidence. The automatic test had missed the unlabeled
button and initially transparent video. This brings the distinct confirmed routes
to **16 of the 26 tested**, while preserving the original automatic report's 15.
The same ordinary-play check on HDToday still produced no video, so that route
remains unconfirmed. These follow-ups do not add new routes to the coverage count.

The early audit labelled every native progress event as Media3, including
WebView players. The sanitized report corrects that label when the recorded
attempt contains exactly one `openPlayer` (WebView) or `openMedia` (Media3) call.
Ben 10's confirmation belongs to WebView; the six DessinAnime.cc confirmations
belong to Media3. Private originals are preserved. New audit observations tag
the transport and invocation before comparing clocks, and ambiguous untagged
invocations are not counted as confirmations. Generate the sanitized JSON with
`node scripts/report-player-repair.js`; it excludes player URLs, headers and query
tokens.

The release APK is signed with the existing application's signing identity;
the signing-certificate SHA-256 matches the previous release:
`dc2f6a10b7f82be57780b684ee77e4eedab0510fadb787850a2605402cb810c5`.
The APK file SHA-256 is
`e913611d951d47606f34496b7e63d9f3f24188e1f58e95129c166b4e5c1fe9af`.

## Broader source coverage and remaining gaps

The separate [provider delivery audit](provider-delivery-2026-11-03.md) covered
all **25 catalogue providers**, **40 title samples** and **123 returned routes**.
It inspected every returned route for those representative samples. It did not
visit every catalogue entry or episode. Four initial routes delivered recognized
media bytes; most other successful HTTP responses were only JavaScript player
documents requiring device verification.

Known upstream limitations remain explicit:

- DessinAnime episode pages still return HTTP 403 in the tested server context,
  limiting discovery of unknown episode player IDs. Known cached IDs can resolve
  through the ordinary public stream API; this does not establish completeness.
- The sampled DessinAnime.net Xtremestream film returns valid playlists but
  missing media segments (HTTP 404). Emmmmbed timed out in earlier HTTP probes,
  although the Ben 10 native playback test now succeeds; that earlier timeout
  was not proof of a permanently unavailable host.
- The sampled Frembed Avatar Uqload file is deleted. Le Petit Prince's Voe route
  returns HTTP 404 and its Dood route requires browser verification.
- Ahwak's captured IDs exceeded the bounded upstream redirect limit. Some
  CimaTN and EgyDead entries currently contain no extracted episode players.
  Kirmalk's corrected source remains intermittently slow or unavailable.
- The sampled One Pace file records explicitly restrict embedding to
  `onepace.net`; those restrictions are respected.
- HDToday and FMovies server routes still require per-title playback validation.
  A known TMDB identity or a loaded player document does not prove a hosted copy
  is available.

Catalogue collection stays on GitHub-hosted runners. This work does not introduce
continuous Netlify redeployments or relay video through the application backend.
