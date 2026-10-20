# Device playback verification — 20 October 2026

The original 89 title/server/host descriptors were resolved to fresh source URLs. The first audit did not retain its URLs, so this cannot establish equality with expired original links. HTTP 200, a loaded iframe and a player-shaped page are not counted as playback. Temporary media URLs, query strings, downloaded source scripts and cookies are excluded from this report.

## Scope and evidence

- 89/89 descriptors have saved Android attempts. Attempts use API 35 WebView or Media3 and record the APK version per row (1.6.17: 17; 1.6.18: 72).
- 10 original descriptors have at least one confirmed playback sample, including 6 recovered HG choices across three source titles. A content clock must advance by at least one second, reach three seconds and belong to a video longer than two minutes. These are short playback samples, not complete-film or all-episode validation.
- 18 route descriptors have explicit missing-file evidence; this is not a count of unique titles or uploads. 5 French slots are paid-only and are no longer offered as public players.
- An earlier positive sample is retained when a later short retry does not reproduce it; the individual row explicitly notes that variability.
- Most attempts allow 20 seconds; managed-verification cases allow at least 35 seconds. Longer earlier attempts are retained. A timeout or no advancing clock remains unconfirmed; it does not establish a permanent deletion.

## Shipped fixes

Validation: 168 Node tests passed, Android unit tests and release lint/build passed, all six final HG device samples played, and both native surface types passed the inline/fullscreen navigation checks.

Native video and isolated HTML players start inline at the title page's actual picture bounds. Scroll and resize update the native surface. Fullscreen is explicit; Back or Inline restores its original bounds without recreating the player. Close, source switching and navigation release the old surface, and cancelled pending opens cannot reopen it. Fullscreen controls respect system-bar/cutout insets. YouTube retains its existing embedded integration.

Both the Media3 and isolated-WebView layout checks observed an inline surface at 65,645 of size 951×535, fullscreen at 0,0 of size 1080×2400, the same inline bounds after Back, and y=488 after scrolling. The direct video's clock advanced through all steps; both surface types passed fullscreen, Back, scrolling, inset-safe Close and surface removal. HTML playback evidence is recorded separately from these layout checks. The debug-only audit activity is excluded from the release APK.

Cima4u's Cyber/HG player publishes alternate HLS links. Its default browser branch stalled, while a published alternative played. The APK now decodes only the public string table and links object, without executing downloaded JavaScript, and checks manifests on the device before handing them to Media3. All six sampled choices played, including Tenzing and the sampled المعلم and حبت episode offerings. Exact source video IDs and language evidence are retained. The original embedded source remains available when resolution fails. No account, challenge solving, fabricated media ID or authorization header is used.

Metadata checks return the first verified manifest without waiting for a denied secondary mirror. Native requests allow four-second connection/read phases with a 6.5-second overall request limit. Metadata checks have short deadlines and a five-minute success cache; failed checks cache for 15 seconds. Video segments go directly between the device and source CDN. This APK path does not require a new Vercel deployment. Backend changes are separately subject to hosting availability.

Observed legitimate HG/VOE redirect destinations are permitted by the isolated player. Late known content-lookup errors and missing-video messages now trigger source failover instead of leaving an opaque loading page. Public French title pages also exposed premium-only slots that their own frontend hides; both server parsing and the APK reject those stale slots. Premium-only episode entries are excluded during source refresh.

## Confirmed missing routes

- **Tenzing**: 16 (mixdrop.ps), 17 (mixdrop.ps), 18 (mixdrop.ps), 19 (mixdrop.ps), 20 (mixdrop.ps), 21 (mixdrop.ps), 25 (mixdrop.top).
- **المعلم** — مسلسل المعلم اومور الحلقة 4 الرابعة مترجمة: 33 (mixdrop.ps), 34 (mixdrop.ps), 35 (mixdrop.ps), 36 (mixdrop.ps), 37 (mixdrop.ps), 38 (mixdrop.ps).
- **حبت** — مسلسل حبتين الحلقة 1 الاولي: 81 (mixdrop.ps), 82 (mixdrop.ps), 83 (mixdrop.ps), 86 (vidmoly.org), 88 (voe.sx).

These messages apply to specific host files. Tenzing and the two sampled series have playable HG alternatives; their missing Mixdrop routes do not mean the entire title is unavailable. The source catalogue label حبت is retained as supplied; its sampled linked episode is labelled حبتين by the source.

## Remaining restrictions

Byse samples reached an explicit human-verification Play prompt. Dood/Trakx, Playmogo and other hosts variously returned denials, browser verification, unavailable documents or no advancing video. These are not reported as repaired. Plain 403 responses still advance to alternatives; ordinary managed browser verification has a bounded opportunity to complete. Tuniflix Needle playback was not confirmed; three exact-title CimaTN alternatives also failed (blank VK player, MediaDelivery denial and Videas 404). No unrelated replacement film is substituted.

The Windows emulator itself crashed during earlier attempts. Those interruptions are test infrastructure, not upstream failures. Checkpoints survive process/PC interruption; source results require a completed attempt. The final table retains the tested APK version and reports unconfirmed cases explicitly.

## All 89 descriptors

| Case | Provider / title | Original host | APK | Result |
|---:|---|---|---|---|
| 1 | fmovies / Come Home Love: Lo and Behold | vidcore.net | 1.6.18 | No advancing content video confirmed in 20-second attempt; native player reported failure. |
| 2 | fmovies / Come Home Love: Lo and Behold | vidfast.pro | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 3 | hdtoday / The Sins Beneath | vidfast.pro | 1.6.17 | Provider content lookup unavailable; explicit error now advances to another source. |
| 4 | hdtoday / The Sins Beneath | vidup.to | 1.6.18 | Upstream document/server error; playback unconfirmed. |
| 5 | hdtoday / Phony | vidfast.pro | 1.6.17 | Provider content lookup unavailable; explicit error now advances to another source. |
| 6 | myflixer / Tazza: The Song of Beelzebub | sv2.nontongo.stream | 1.6.17 | Upstream document/server error; playback unconfirmed. |
| 7 | myflixer / Tazza: The Song of Beelzebub | balance.medmedia03.wiki | 1.6.18 | No advancing content video confirmed in 20-second attempt; native player reported failure. |
| 8 | myflixer / Tazza: The Song of Beelzebub | vidfast.pro | 1.6.17 | Provider content lookup unavailable; explicit error now advances to another source. |
| 9 | myflixer / The Diplomat | balance.medmedia03.wiki | 1.6.17 | No advancing content video confirmed in 20-second attempt. |
| 10 | myflixer / The Diplomat | vidfast.pro | 1.6.18 | Earlier playback confirmed (0.0 → 4.0 s / 2610.6 s duration); latest 45-second retry did not reproduce it. |
| 11 | cimafu / Tenzing | doodstream.com | 1.6.17 | No advancing content video confirmed in 20-second attempt. |
| 12 | cimafu / Tenzing | doodstream.com | 1.6.17 | No advancing content video confirmed in 20-second attempt. |
| 13 | cimafu / Tenzing | doodstream.com | 1.6.17 | No advancing content video confirmed in 20-second attempt. |
| 14 | cimafu / Tenzing | bysetayico.com | 1.6.17 | Human/browser verification remains; no advancing content video. |
| 15 | cimafu / Tenzing | bysetayico.com | 1.6.18 | Human/browser verification remains; no advancing content video. |
| 16 | cimafu / Tenzing | mixdrop.ps | 1.6.17 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 17 | cimafu / Tenzing | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 18 | cimafu / Tenzing | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 19 | cimafu / Tenzing | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 20 | cimafu / Tenzing | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 21 | cimafu / Tenzing | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 22 | cimafu / Tenzing | cybervynx.com | 1.6.18 | Recovered by device-resolved public HLS (0.8 → 13.4 s / 7533.7 s duration); original embed unconfirmed in its test window. |
| 23 | cimafu / Tenzing | cybervynx.com | 1.6.18 | Recovered by device-resolved public HLS (1.8 → 19.3 s / 7533.7 s duration); original embed unconfirmed in its test window. |
| 24 | cimafu / Tenzing | bysesukior.com | 1.6.18 | Human/browser verification remains; no advancing content video. |
| 25 | cimafu / Tenzing | mixdrop.top | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 26 | cimafu / Tenzing | playmogo.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 27 | cimafu / Tenzing | voe.sx | 1.6.18 | Player document returned HTTP 403; playback unconfirmed. |
| 28 | cimafu / المعلم | doodstream.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 29 | cimafu / المعلم | doodstream.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 30 | cimafu / المعلم | doodstream.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 31 | cimafu / المعلم | bysetayico.com | 1.6.18 | Human/browser verification remains; no advancing content video. |
| 32 | cimafu / المعلم | bysetayico.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 33 | cimafu / المعلم | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 34 | cimafu / المعلم | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 35 | cimafu / المعلم | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 36 | cimafu / المعلم | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 37 | cimafu / المعلم | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 38 | cimafu / المعلم | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 39 | cimafu / المعلم | cybervynx.com | 1.6.18 | Recovered by device-resolved public HLS (1.1 → 17.2 s / 8539.1 s duration); original embed unconfirmed in its test window. |
| 40 | cimafu / المعلم | cybervynx.com | 1.6.18 | Recovered by device-resolved public HLS (1.9 → 17.6 s / 8539.1 s duration); original embed unconfirmed in its test window. |
| 41 | cimafu / المعلم | bysesukior.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 42 | cimafu / المعلم | mixdrop.top | 1.6.18 | No advancing content video confirmed in 20-second attempt; native player reported failure. |
| 43 | cimafu / المعلم | playmogo.com | 1.6.18 | No advancing content video confirmed in 35-second attempt. |
| 44 | cimafu / المعلم | voe.sx | 1.6.18 | Player document returned HTTP 403; playback unconfirmed. |
| 45 | ahwaktv / صقر وكناريا | vkvideo.ru | 1.6.17 | No advancing content video confirmed in 20-second attempt. |
| 46 | ahwaktv / صقر وكناريا | www.ok.ru | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 47 | ahwaktv / صقر وكناريا | playmogo.com | 1.6.18 | No advancing content video confirmed in 35-second attempt. |
| 48 | ahwaktv / خمسين خمسين | ok.ru | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 49 | ahwaktv / خمسين خمسين | playmogo.com | 1.6.18 | No advancing content video confirmed in 35-second attempt. |
| 50 | egydead / سوتس 2022 كامل | morencius.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 51 | egydead / سوتس 2022 كامل | mixdrop.top | 1.6.18 | No advancing content video confirmed in 20-second attempt; native player reported failure. |
| 52 | egydead / سوتس 2022 كامل | playmogo.com | 1.6.18 | No advancing content video confirmed in 35-second attempt. |
| 53 | tuniflix / الإبرة | watch.easyvidplayer.com | 1.6.17 | No advancing content video confirmed in 20-second attempt. |
| 54 | cinetimes / La fille de Carthage (1924) - Cinetimes | upload.wikimedia.org | 1.6.18 | Playback confirmed: 0.6 → 12.7 s / 1108.2 s duration. |
| 55 | frenchstream / He's Watching You | fsvid.lol | 1.6.17 | Paid-only slot; excluded from public server lists and premium-only episodes. No access bypass. |
| 56 | frenchstream / He's Watching You | trakx.lol | 1.6.17 | No advancing content video confirmed in 20-second attempt. |
| 57 | frenchstream / He's Watching You | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 58 | frenchstream / He's Watching You | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 59 | frenchstream / He's Watching You | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 60 | frenchstream / Dumas | fsvid.lol | 1.6.18 | Paid-only slot; excluded from public server lists and premium-only episodes. No access bypass. |
| 61 | frenchstream / Dumas | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 62 | frenchstream / Dumas | vidfast.pro | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 63 | dessinanime / ‎Des Minions et des Monstres | fsvid.lol | 1.6.18 | Paid-only slot; excluded from public server lists and premium-only episodes. No access bypass. |
| 64 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 65 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 66 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 67 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt; native player reported failure. |
| 68 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 69 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 70 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 71 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 72 | dessinanime / Rick et Morty | fsvid.lol | 1.6.18 | Paid-only slot; excluded from public server lists and premium-only episodes. No access bypass. |
| 73 | dessinanime / Rick et Morty | trakx.lol | 1.6.18 | No advancing content video confirmed in 20-second attempt; native player reported failure. |
| 74 | dessinanime / Rick et Morty | fsvid.lol | 1.6.18 | Paid-only slot; excluded from public server lists and premium-only episodes. No access bypass. |
| 75 | dessinanime / Rick et Morty | vidfast.pro | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 76 | megacartoons / Baby Looney Tunes | ww.megacartoons.net | 1.6.17 | Playback confirmed: 0.2 → 24.3 s / 601.4 s duration. |
| 77 | toontales / Rabbit Fire | ww.toontales.net | 1.6.18 | Playback confirmed: 1.0 → 17.0 s / 452.4 s duration. |
| 78 | yoturkish / Sevdam Karadeniz | rufiiguta.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 79 | cimafu / حبت | bysetayico.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 80 | cimafu / حبت | bysetayico.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |
| 81 | cimafu / حبت | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 82 | cimafu / حبت | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 83 | cimafu / حبت | mixdrop.ps | 1.6.18 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 84 | cimafu / حبت | cybervynx.com | 1.6.18 | Recovered by device-resolved public HLS (1.6 → 19.2 s / 3187.2 s duration); original embed unconfirmed in its test window. |
| 85 | cimafu / حبت | cybervynx.com | 1.6.18 | Recovered by device-resolved public HLS (0.8 → 20.9 s / 3187.2 s duration); original embed unconfirmed in its test window. |
| 86 | cimafu / حبت | vidmoly.org | 1.6.17 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 87 | cimafu / حبت | playmogo.com | 1.6.18 | No advancing content video confirmed in 35-second attempt. |
| 88 | cimafu / حبت | voe.sx | 1.6.17 | Missing file: explicit host message or HTTP 404 on file route. Other providers may still have this title. |
| 89 | cimafu / Shuiro No Kamen | bysetayico.com | 1.6.18 | No advancing content video confirmed in 20-second attempt. |

## Additional public French choices

These exact source-provided Vidzy choices are alternatives to the excluded premium slots, and were tested separately.

- He's Watching You: no advancing content video confirmed in its 40-second test window.
- Dumas: playback confirmed, 1.8 → 3.8 s / 2611.0 s duration.
- ‎Des Minions et des Monstres: playback confirmed, 1.7 → 3.9 s / 5615.7 s duration.
- Rick et Morty: playback confirmed, 1.7 → 4.3 s / 1284.0 s duration.
