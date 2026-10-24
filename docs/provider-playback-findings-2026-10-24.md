# Android playback investigation — 24 October 2026

See the [per-server results](provider-playback-audit-2026-10-24.md), [player controls](provider-player-controls-2026-10-24.json) and [HLS compatibility controls](provider-hls-controls-2026-10-24.json).

The matrix covers 22 catalogue providers and 68 sample titles. Each returned player is exercised separately in the production Android player. A successful alternative does not certify the original catalogue source. This is a sample of films, series, languages and player routes, rather than every episode in the catalogue.

All 336 returned choices received a device outcome. The latest attempts confirmed playback on 93 choices; one additional choice has an earlier confirmation and a different latest outcome. Kirmalk, AnimeGG and YoTurkish had no own-source confirmation in these samples. One Pace returned no eligible in-app episode routes. The detailed report distinguishes player errors, unconfirmed advancement, removals, verification, country and embedding restrictions.

The signed 1.6.25 release also passed installation, cold activity launch, Movies browsing and returning to a populated Home/Recently updated screen. See the [release smoke record](release-smoke-2026-10-24.json). This visual check does not establish an exact catalogue-loading time or prove every cache transition.

## Fixes supported by the investigation

| Problem | Change | Verification |
|---|---|---|
| Cold title lookups could lose a provider alias | Published owner indexes include unambiguous title aliases; cold lookups follow their canonical title | Regression test without loading the full catalogue; refreshed runtime index |
| EgyDead returned no players after its watch flow changed | Follow the title's published same-origin `/watch/` link, retaining the older inline/POST flow | Live server resolution and advancing playback on a recovered HG route |
| CimaTN returned 404 from an obsolete watch blog | Read its current same-origin watch feed, including all pages | Recovered 15 episodes and three distinct players for the sampled series; its YouTube route played |
| Valid CimaTN configurations were discarded | Quote numeric object keys outside strings/comments before JSON5 parsing; never execute source code | Compact download-map regression tests and live episode resolution |
| CimaTN film watch slugs were partial | Accept a unique published suffix match, preferring an exact match and rejecting ambiguity | Film player discovery plus ambiguity/origin regression tests |
| Accessible Myflixer HLS media failed inside Media3 | Omit a redundant TS initialization map only after verifying media packets in the map and program tables in the first segment; handle the observed leading image header | Previously failing routes played; six Java policy tests; official fMP4 control and resume at 60 seconds |
| Explicit error pages stayed open | Recognize observed missing/expired/unavailable and embedding-block pages and advance to another choice | Script regression tests and shorter device failures on the sampled removed pages |
| Netlify's legacy bootstrap URL returned 404 | Dispatch `/data/bootstrap.json` directly to the bootstrap catalogue handler | Regression test plus deployed HTTP 200 and matching 600-title generation on both bootstrap URLs |

The HLS workaround preserves legitimate initialization sections, encrypted playlists, byte-range layouts, discontinuities and changing maps. Probes are small device-to-source requests; media remains off the application backend. HLS distinguishes TS program-table initialization from fragmented-MP4 initialization, and initialization sections should not contain media samples. [RFC 8216, sections 3.1–3.3](https://www.rfc-editor.org/rfc/rfc8216#section-3.1).

The fragmented-MP4 control uses Apple's published developer example. It and a recovered Myflixer stream resumed at 60 seconds both produced advancing clocks on the updated Android player. [Apple streaming examples](https://developer.apple.com/streaming/examples/).

All three returned DessinAnime player choices for the sampled Les Simpson episode produced advancing playback inside the app. The provider's public player API resolves its relay media on the device.

## Gaps remain explicit

- Some CimaTN film posts do not have a matching published watch page. A visible post alone does not establish playable availability.
- Removed VK files, Dailymotion denials or missing video IDs, verification gates, country restrictions and publisher embedding blocks are distinct from app failures. They are not marked working because a frame loads.
- One Pace returned no eligible episode routes in the sampled hosted lookups. Local inspection also found files whose embed-domain metadata restricts playback to the publisher's site. These are not exposed as unrestricted in-app files.
- A timeout means playback was unconfirmed within the observation window. Earlier successful playback is retained separately if a later attempt fails.
- Android System UI and first-use fullscreen prompts interrupted initial control checks. Those interruptions were cleared before the passing control run; the audit guards against a system dialog covering subsequent interactions.

The audit uses a debug-only entry point to isolate the real production player from catalogue loading. This entry point is excluded from release APKs. Per-route APK versions and available debug APK fingerprints distinguish baseline attempts from retests. Private checkpoints contain temporary source URLs; the published reports omit them.

## Audit corrections

Raw YouTube descriptors are normalized through the same conversion as the client; earlier incomplete-descriptor attempts are excluded. A counter that failed to accept clocks starting at zero was corrected, and saved observations were evaluated again against the advancing-clock rule. Standard small Play controls, including role-based buttons, are actionable independently of the minimum video size. Paused-source cases are retested with that correction; advertising, verification and premium prompts are excluded from automated interaction. The MyAsianTV samples played after ordinary Play taps. These interaction changes correct the test harness and do not require a different application APK.
