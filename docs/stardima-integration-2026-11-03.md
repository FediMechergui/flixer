# StarDima integration — 3 November 2026

Flixer integrates the anonymous, free catalogue published by [StarDima](https://www.stardima.com/mosalsalat). Android reads the public source directly using its existing native HTTP transport. Search, browse pagination, title descriptions, posters, season guides and published player choices use the same provider identities as the backend adapter.

## What APK inspection established

The official [application website](https://stardima.app/) supplies `stardima.apk` and its WiPlayer companion. Both were downloaded and inspected statically; neither was installed or executed. The StarDima APK is package `com.stardima`, version 1.0.8, with a verified signature and SHA-256 `7e8f9fc8acf2d1eaf6c2bbb3686c391feb0c2a9bcd2751f0f95ddac0edb9a35e`.

The app uses Retrofit/OkHttp for catalogue requests and Media3 for native playback. Embedded links can be delegated to WiPlayer. Its `/api/series`, `/api/movies`, `/api/video/{id}`, `/api/episodes/{seasonId}`, `/api/episodes/{id}/servers` and search interfaces require app authentication. Ordinary unauthenticated catalogue requests returned HTTP 401, “API key required.” Inspection did not establish a separate unrestricted media catalogue. Flixer does not use the app's authentication material or encrypted VIP responses.

The integration instead follows routes the website publishes to anonymous visitors:

| Purpose | Public source route |
| --- | --- |
| Series | `/mosalsalat?premium=free&page=N` |
| Films | `/aflam?premium=free&page=N` |
| Search | `/search?premium=free&page=N&query=…` |
| Title | `/tvshow/{slug}` or `/movie/{slug}` |
| Season entries | `/series/season/{id}?X-Requested-With=XMLHttpRequest` |
| Selected episode access/player | `/series/episode/{id}` |
| Recent episodes | `/newrelases` (the source's spelling) |
| Public player inventory | `https://v2.hyperwatching.com/watch/{publishedHash}` |
| Published server choice | `/embed/{publishedHash}/server/{publishedServerId}/url` on the same Hyperwatching origin |

The adapter checks title and episode identity, excludes exclusive entries, and requires affirmative guest access before resolving an episode. Hyperwatching must explicitly identify the player and server as non-VIP, with a completed iframe entry. Only published server IDs are requested. Source pages are parsed as documents; their scripts are not evaluated by the catalogue adapter.

## Catalogue and updates

StarDima is not assumed to be animation-only. Generic film/series lists and the source's anime, cartoon, classic-cartoon and sub/dub filters remain distinct. Public Arabic and Latin title aliases are retained. Source season and episode numbers are preserved, including gaps; no fabricated episode links or inferred numbering are introduced.

Android starts its StarDima search independently of the hosted provider registry. Browsing advances a separate device cursor, and discovered rows merge into the existing persistent catalogue. Small latest-page checks run in the background while the app is active; playback does not trigger catalogue refreshes. An observation date means “Added,” not an invented release date. Request budgets, cache coalescing and an origin cooldown limit repeated failures.

The GitHub collector also has a resumable free-catalogue backfill with checkpointed cursors. It uses the existing runtime-data publication, not repeated Netlify deployments. It does not move collection to the user's PC.

## Hosting limitation

The deployed Netlify adapter registered successfully, but StarDima returned HTTP 403 from that environment. [GitHub refresh run 41653283659](https://github.com/FediMechergui/flixer/actions/runs/41653283659) completed successfully overall; its StarDima backfill imported **zero records**, stopped after its first denied request and retained the cursor. Other catalogue updates were published normally. A successful workflow is not proof that the StarDima backfill succeeded.

Ordinary requests from the Android emulator returned HTTP 200 for the catalogue, title and selected-episode metadata. This is why Android has a direct source adapter. Device access may still differ by network; a denial retains saved data and enters cooldown. Full hosted StarDima coverage remains unavailable until the source permits that environment.

## Playback scope

Public choices resolve to Uqload, HGCloud, Mixdrop, LuluStream and Savefiles where the source advertises them. They enter Flixer's existing inline player, with fullscreen only on request. A Lulu helper can read the public player configuration and validate its HLS manifest; failure keeps the isolated inline WebView fallback. A returned URL or HTTP 200 is not counted as playback.

The Android audit covers current and legacy films and episodes, with all 19 returned choices for those four samples:

| Host | Sampled routes | Result |
| --- | ---: | --- |
| Uqload | 4 | Four advancing inline WebView clocks |
| LuluStream | 3 | Three routes played in WebView in at least one attempt; direct Media3 attempts failed with HTTP errors |
| HGCloud | 4 | Two current routes played through Media3; two legacy routes showed no advancing clock |
| Mixdrop | 4 | Source reported unavailable |
| Savefiles | 4 | No advancing clock observed |

Nine unique routes have playback proof in at least one attempt. Eight **latest** attempts have independently attributable playback proof; the latest Lulu episode retest has ambiguous clock attribution after a native-to-WebView fallback, while its earlier single-WebView attempt is confirmed. HTTP 200 responses from Lulu manifests did not establish successful native playback.

The [sanitized route report](stardima-evidence-2026-11-03/android-routes.json) preserves these distinctions and the exact tested APK hash. The source marked the sampled Kaiju entry as season 4, episode 1; those numbers were retained. Actual spoken language was not independently verified. This sample does not certify every StarDima title or every upstream server.

## Android integration checks

On the integration build, actual Arabic search surfaced StarDima results in 798 ms while other providers continued independently. Opening the sampled title painted saved metadata in 184 ms; the live four-episode guide arrived in 2,225 ms with its poster and Latin/Arabic aliases. The selected episode returned five source choices in 3,418 ms. Selecting Streamhg played through Media3 inline: the clock advanced from 0.399 to 26.559 seconds of the source's 224.057-second clip. This was a short playback check, not a complete-episode viewing.

Closing playback and returning home removed the player overlay, retained StarDima cards and preserved the same S4E1 Continue Watching entry and position. Latin search displayed a matching title under “Various providers.” The separate native-source checks passed for both catalogue kinds, Arabic/Latin search, current and legacy guides, film and episode servers, and latest entries. The legacy guide contained 151 published episodes across source seasons 1–4. These are sampled results, not an exhaustive import.

The device checks exposed three integration defects, now covered by regressions:

- A late guide refreshed the list but left the title header's episode count stale. The header, facts and list now update together.
- After a cold start, a saved Continue Watching position could lose its card until the full catalogue loaded. One validated local title-cache read now supplies that card immediately and reopening it reuses the saved guide. Canonical aliases do not produce duplicate resume cards.
- A fresh Latin search could discard a genuine source result whose display title was Arabic. Exact source-returned result IDs now remain visible through canonical merges, without adding the query as a fabricated alias or fetching a whole guide during search.

**451 Node tests and 25 Android unit tests pass.** Source and UI evidence retain their respective build hashes rather than presenting every earlier route test as a final-build test. The signed-build Uqload check displayed changing movie frames inline, but also source promotional overlays. Ad-free embedded playback is not claimed.

The final audit build (`a3a0677942734e7a8a6666f733befcea8bc8cb3e336c7194bfbc1f4e268e6f22`) passed the cold-start resume check: S4E1 and its 12% position remained visible after the title merged into a canonical FMovies identity. A fresh “Blazing Teens” search displayed the Arabic source title, StarDima badge and poster before opening its guide.

Release 1.6.33 uses version code `10633` and the existing signing certificate. Its APK SHA-256 is `381574eb8a65d79c2b7d4f39727975ce6a203e5f380eed7b05eb1bc6de8d4ced`. The [release page](https://github.com/FediMechergui/flixer/releases/tag/flixer-v1.6.33) contains the APK and checksum file.

The exact signed APK passed a separate visible UI smoke: Latin search found the Arabic source entry, the poster/synopsis and four-episode guide rendered, and the selected S4E1 played inline through a Lulu fallback with changing cartoon scenes. This is visual playback evidence, not an instrumented signed-build clock or proof of HG success. Back exited normally; a force-stop and cold relaunch retained the same S4E1 at 42% watched. The final activity launches measured 1.095 and 1.514 seconds in this emulator run. The [final device report](stardima-evidence-2026-11-03/android-final.json) distinguishes these observations from earlier instrumented checks.
