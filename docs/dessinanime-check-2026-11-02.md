# DessinAnime source check — 2 November 2026

Follow-up: [browser discovery and refreshed episode mappings](dessinanime-browser-discovery-2026-11-02.md)
supersede the one-episode coverage limitation below. This report preserves the
earlier direct-HTTP and emulator results.

Scope: Flixer's current DessinAnime integration and the known cached Les Simpson
episode, using the existing 1.6.30 player. These checks do not certify playback
for every title, episode or language in the source catalogue.

| Check from this connection | Result |
| --- | --- |
| `dessinanime.gg` | DNS lookup failed with `ENOTFOUND` |
| `dessinanime.cc` homepage | HTTP 200 |
| `/api/catalogue?mediaType=TV&genreId=21` | HTTP 200, 36 records, expected catalogue schema |
| `/api/search?q=simpson` | HTTP 200, 11 records |
| Les Simpson title and sampled episode pages | HTTP 403 with browser-verification challenge |
| Bluey and sampled film pages | HTTP 403 with browser-verification challenge |
| `/api/stream?playerId=1106663` | HTTP 200, MP4 descriptor and 3 explicit quality choices |
| `/api/stream?playerId=144016` | HTTP 200, MP4 descriptor and 1 explicit quality choice |
| Both advertised relay video URLs | HTTP 206, `video/mp4`, valid byte ranges |
| Player 1106663 relay without a referrer | HTTP 206; a source referrer was not required in this check |
| Third cached player, `morencius.com` | HTTP 200 embed page, no observed origin move or challenge |
| Hosted Flixer stream endpoint | HTTP 200; retains both deferred DessinAnime players and its named embedded player, alongside separately labelled alternative providers |
| Existing DessinAnime regression tests | All 4 passed |

The two byte-range probes returned ranges `0–1023`, with advertised complete
file sizes 258,504,428 and 130,307,140 bytes. No complete film was downloaded.
HTTP success, valid MP4 bytes and an embed page are reachability evidence;
advancing video was not confirmed during this check.

## Coverage limitation

The local deployment snapshot contains 3,606 DessinAnime title records. Only one
title has a mapped episode with cached source player IDs; its source guide lists
799 episode coordinates. A guide coordinate alone does not identify a source
player. This is a count of the checked local snapshot, not a complete count of
the current upstream catalogue or of titles playable through other providers.

The source's public catalogue/search and stream endpoints are reachable while
its sampled title/episode HTML requires browser verification. That currently
blocks normal fresh discovery of episode-specific player IDs. No player IDs,
seasons, verification cookies or challenge tokens were invented or imported.

The source stream endpoint did not send an `Access-Control-Allow-Origin` header.
The app enables CapacitorHttp, which provides native HTTP transport; an ordinary
desktop cross-origin browser fetch has different constraints. The video relay
itself returned `Access-Control-Allow-Origin: *`.

## Arabic/Tunisian follow-up

The public source search returned no records for `باب الحارة`, `Dachra` or
`Samhani`. `Bab Al Hara` returned the unrelated film **Bab El Web** (2005), and
`Noura` returned the unrelated series **La Noiraude**. These results do not
establish the availability of the requested regional works, and were not merged
into their identities. A broader `Un divan à Tunis` query returned fuzzy partial
matches, which were not accepted as identity or playback evidence.

## Android verification limit

The intended source-specific APK test did not reach playback. The QA emulator
failed boot attempts, and Android subsequently logged `DeadSystemException` for
System UI and other system processes before Flixer could start. A debug-package
install attempt failed because the Android package service had died. These are
test-environment failures, not source-player failures. The owned emulator was
closed afterward. No player route was marked working or dead from these attempts.

No app implementation or catalogue data was changed in this investigation.
Temporary media queries, raw scripts and private probe files remain excluded
from this report.

Source: [DessinAnime](https://dessinanime.cc/).
