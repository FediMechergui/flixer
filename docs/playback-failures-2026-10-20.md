# Playback investigation: 89 previously failed routes

Audit date: 2026-10-20T12:06:45.483Z. Original audit: 2026-10-20T11:39:51.146Z.

All 89 descriptors were re-resolved and retested. The original audit omitted URLs, so these are the same title/server/host descriptors with fresh provider URLs; exact equality with expired original URLs cannot be established. HTTP reachability is not proof of playback. Signed URLs, tokens and downloaded third-party HTML are excluded from this document.

## Original causes

66 cases were rejected before HTTP by the audit/backend public-address guard. DNS on this PC included the standard NAT64 prefix alongside public IPv4 results. The guard now validates the embedded IPv4 address, retaining private, loopback, metadata and reserved-address restrictions. This corrects a false negative in the audit; it does not prove that those 66 videos play. See [RFC 6052](https://www.rfc-editor.org/rfc/rfc6052), sections 2.1, 3.1 and 5.

The other original results were 20 HTTP 403 responses, one HTTP 504, one timeout and one HTTP 404.

## Retest results

| Result | Cases |
|---|---:|
| javascript-player-required | 49 |
| upstream-server-error | 1 |
| browser-verification-required | 12 |
| network-error | 1 |
| source-adblock-gate | 1 |
| network-timeout | 1 |
| source-route-changed | 1 |
| upstream-access-block | 19 |
| http-reachable-playback-unverified | 2 |
| missing-video | 2 |

The 49 JavaScript documents and two ranged MP4 responses require device playback validation. Twelve managed-verification responses are distinct from the 19 plain access denials. Raw mentions of Cloudflare analytics are not treated as access failures. Failed first-attempt fields no longer leak into successful retry results.

## Changes and evidence

- Accept public well-known NAT64 translations, with regression coverage for translated private addresses. Revalidation and DNS pinning remain in place.
- Permit the observed VidFast redirect to vidfast.vc and Myflixer redirect to sv4.nontongo.day. Myflixer's destination still returned 504 twice. Vidcore's redirect to vidcore.io was already supported. medmedia03's numbered destinations were already permitted by the restricted hostname rule.
- Let explicit cf-mitigated: challenge documents run ordinary JavaScript/cookie verification instead of immediately closing on 403. No challenge solving or cookie forgery is added. Verification is bounded to 30 seconds, and main-document loads to 60 seconds; verification redirects cannot extend the deadline. Completed ordinary pages clear the load deadline because cross-origin video clocks may be unavailable. Plain denials still advance to another source.
- Recognize visible Please disable AdBlock and This video not found messages, then advance to another source. A gate cannot be described as a repaired stream.
- Resolve Cinetimes' newly linked Commons File page through public imageinfo metadata, retaining exact file identity and upload.wikimedia.org restrictions. The live La fille de Carthage file resolved successfully.
- Native Media3 on API 35 played case 76 (601.393-second duration; advancing clock, position 1.655 seconds on close) and case 77 (452.416-second duration; advancing clock through 10.112 seconds on close). These are short playback samples, not complete film validation.
- A Byse sample (case 14) loaded its JavaScript application and title but did not produce confirmed playback during the emulator investigation. It remains unverified.

## Individual cases

Status below describes the HTTP retest, with device evidence stated separately. Every row remains unconfirmed for video playback unless explicitly identified above.

| Case | Provider / title | Original host | Retest | Handling / remaining issue |
|---:|---|---|---|---|
| 1 | fmovies / Come Home Love: Lo and Behold | vidcore.net | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 2 | fmovies / Come Home Love: Lo and Behold | vidfast.pro | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 3 | hdtoday / The Sins Beneath | vidfast.pro | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 4 | hdtoday / The Sins Beneath | vidup.to | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 5 | hdtoday / Phony | vidfast.pro | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 6 | myflixer / Tazza: The Song of Beelzebub | sv2.nontongo.stream | 504 upstream-server-error | Two GET attempts failed; fail over. Redirect approval does not repair upstream 504. |
| 7 | myflixer / Tazza: The Song of Beelzebub | balance.medmedia03.wiki | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 8 | myflixer / Tazza: The Song of Beelzebub | vidfast.pro | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 9 | myflixer / The Diplomat | balance.medmedia03.wiki | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 10 | myflixer / The Diplomat | vidfast.pro | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 11 | cimafu / Tenzing | doodstream.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 12 | cimafu / Tenzing | doodstream.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 13 | cimafu / Tenzing | doodstream.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 14 | cimafu / Tenzing | bysetayico.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 15 | cimafu / Tenzing | bysetayico.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 16 | cimafu / Tenzing | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 17 | cimafu / Tenzing | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 18 | cimafu / Tenzing | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 19 | cimafu / Tenzing | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 20 | cimafu / Tenzing | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 21 | cimafu / Tenzing | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 22 | cimafu / Tenzing | cybervynx.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 23 | cimafu / Tenzing | cybervynx.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 24 | cimafu / Tenzing | bysesukior.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 25 | cimafu / Tenzing | mixdrop.top | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 26 | cimafu / Tenzing | playmogo.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 27 | cimafu / Tenzing | voe.sx | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 28 | cimafu / المعلم | doodstream.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 29 | cimafu / المعلم | doodstream.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 30 | cimafu / المعلم | doodstream.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 31 | cimafu / المعلم | bysetayico.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 32 | cimafu / المعلم | bysetayico.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 33 | cimafu / المعلم | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 34 | cimafu / المعلم | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 35 | cimafu / المعلم | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 36 | cimafu / المعلم | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 37 | cimafu / المعلم | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 38 | cimafu / المعلم | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 39 | cimafu / المعلم | cybervynx.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 40 | cimafu / المعلم | cybervynx.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 41 | cimafu / المعلم | bysesukior.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 42 | cimafu / المعلم | mixdrop.top | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 43 | cimafu / المعلم | playmogo.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 44 | cimafu / المعلم | voe.sx | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 45 | ahwaktv / صقر وكناريا | vkvideo.ru | — network-error | Two requests exceeded redirect limit; browser cookies may behave differently. Playback unresolved. |
| 46 | ahwaktv / صقر وكناريا | www.ok.ru | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 47 | ahwaktv / صقر وكناريا | playmogo.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 48 | ahwaktv / خمسين خمسين | ok.ru | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 49 | ahwaktv / خمسين خمسين | playmogo.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 50 | egydead / سوتس 2022 كامل | morencius.com | 200 source-adblock-gate | Recognize visible advertising gate and try next source. No playback confirmation. |
| 51 | egydead / سوتس 2022 كامل | mixdrop.top | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 52 | egydead / سوتس 2022 كامل | playmogo.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 53 | tuniflix / الإبرة | watch.easyvidplayer.com | — network-timeout | Two timed requests failed (9s/15s); try next source. Upstream remains unresolved. |
| 54 | cinetimes / La fille de Carthage (1924) - Cinetimes | upload.wikimedia.org | — source-route-changed | Source changed to a Wikimedia file-page link; exact linked file now resolves through public imageinfo metadata. |
| 55 | frenchstream / He's Watching You | fsvid.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 56 | frenchstream / He's Watching You | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 57 | frenchstream / He's Watching You | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 58 | frenchstream / He's Watching You | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 59 | frenchstream / He's Watching You | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 60 | frenchstream / Dumas | fsvid.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 61 | frenchstream / Dumas | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 62 | frenchstream / Dumas | vidfast.pro | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 63 | dessinanime / ‎Des Minions et des Monstres | fsvid.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 64 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 65 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 66 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 67 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 68 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 69 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 70 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 71 | dessinanime / ‎Des Minions et des Monstres | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 72 | dessinanime / Rick et Morty | fsvid.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 73 | dessinanime / Rick et Morty | trakx.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 74 | dessinanime / Rick et Morty | fsvid.lol | 403 upstream-access-block | Fail over on main-document denial; upstream access remains unresolved. |
| 75 | dessinanime / Rick et Morty | vidfast.pro | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 76 | megacartoons / Baby Looney Tunes | ww.megacartoons.net | 206 http-reachable-playback-unverified | Use native Media3; no backend video proxy. Android playback confirmed by advancing video clock. |
| 77 | toontales / Rabbit Fire | ww.toontales.net | 206 http-reachable-playback-unverified | Use native Media3; no backend video proxy. Android playback confirmed by advancing video clock. |
| 78 | yoturkish / Sevdam Karadeniz | rufiiguta.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 79 | cimafu / حبت | bysetayico.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 80 | cimafu / حبت | bysetayico.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 81 | cimafu / حبت | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 82 | cimafu / حبت | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 83 | cimafu / حبت | mixdrop.ps | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 84 | cimafu / حبت | cybervynx.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 85 | cimafu / حبت | cybervynx.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |
| 86 | cimafu / حبت | vidmoly.org | 404 missing-video | Recognize deleted/missing video and try next source; file cannot be restored by the app. |
| 87 | cimafu / حبت | playmogo.com | 403 browser-verification-required | Allow ordinary browser verification for 30 seconds; keep Close/Next available. Host may still deny. |
| 88 | cimafu / حبت | voe.sx | 404 missing-video | Recognize deleted/missing video and try next source; file cannot be restored by the app. |
| 89 | cimafu / Shuiro No Kamen | bysetayico.com | 200 javascript-player-required | Use isolated WebView; permit verified redirects; main-document load deadline. Playback unverified. |

## Validation and rollout

153 Node tests pass, including public-address security, response classification, exact Commons identity and native host coverage. Android unit tests and debug/release compilation pass.

This report does not certify every provider, episode, subtitle or entire video as playable. Plain upstream denials, missing files, host timeouts and gateway errors remain external failures. Vercel reported a deployment rate limit after the prior successful release; backend source changes require a new successful deployment before they affect production. Native player fixes ship with the APK independently.
