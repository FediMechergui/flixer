# Android provider playback audit — 28 October 2026

Completed audit. APKs 1.6.28; 13/13 returned server choices tested across 9 title samples; 6 advancing-video confirmations.

Device observation window: 28 Oct 2026, 01:07 to 28 Oct 2026, 01:13 WAT.

Every returned server for the provider/type/language sample matrix, using the production player; not every catalogue episode.

This checks the production player in an Android emulator. Each case has one server, so another source cannot silently satisfy its test. Playback requires the same visible content clock to advance by at least one second, reach three seconds and have a duration of at least two minutes. HTTP success, loaded frames and native “playing” signals alone are not confirmations. These are short playback samples, not full-film or every-episode validation.

The source provider identifies the catalogue sample. A returned alternative may belong to another player provider; source-server confirmations below exclude those alternatives. A timeout is unconfirmed, not evidence of permanent removal. Source restrictions and unavailable episode links remain explicit. Temporary media URLs, query tokens, source scripts and cookies are excluded.

| Provider | Samples | Returned choices | Own-source choices | Tested | Played | Played from own source |
|---|---:|---:|---:|---:|---:|---:|
| tuniflix | 3 | 4 | 4 | 4 | 2 | 2 |
| cimatn | 1 | 2 | 2 | 2 | 0 | 0 |
| egydead | 1 | 3 | 3 | 3 | 1 | 1 |
| aloula | 2 | 2 | 2 | 2 | 2 | 2 |
| youtubeoriginals | 2 | 2 | 2 | 2 | 1 | 1 |

## Outcomes

| Outcome | Choices |
|---|---:|
| player_error | 3 |
| playback_confirmed | 6 |
| no_advancing_video | 3 |
| access_denied | 1 |

## Lookup and guide gaps


## Per-server device results

| Case | Source / title | Server / host | APK | Result | Evidence |
|---:|---|---|---|---|---|
| 1 | tuniflix / الإبرة | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.28 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 2 | tuniflix / الإبرة | Tuniflix - uqload.vc / uqload.vc | 1.6.28 | playback_confirmed | 0.2 → 73.0 s / 6985.3 s (webview) |
| 3 | tuniflix / صيف حلق الوادي | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.28 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 4 | tuniflix / Doctor Love | Tuniflix - YouTube / www.youtube.com | 1.6.28 | playback_confirmed | 0.0 → 4.2 s / 1101.9 s (webview) |
| 5 | cimatn / Hbiba فيلم الرعب حبيبة كامل | CimaTN - vkvideo.ru / vkvideo.ru | 1.6.28 | no_advancing_video |  |
| 6 | cimatn / Hbiba فيلم الرعب حبيبة كامل | CimaTN - geo.dailymotion.com / geo.dailymotion.com | 1.6.28 | access_denied | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 7 | egydead / رهين | EgyDead - hgcloud.to / hgcloud.to | 1.6.28 | playback_confirmed | 1.5 → 4.1 s / 5212.6 s (media3) |
| 8 | egydead / رهين | EgyDead - morencius.com / morencius.com | 1.6.28 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 9 | egydead / رهين | EgyDead - mixdrop.top / mixdrop.top | 1.6.28 | no_advancing_video |  |
| 10 | aloula / الزافر | Aloula - HLS / clvod.itworkscdn.net | 1.6.28 | playback_confirmed | 1.3 → 4.6 s / 2880.0 s (media3) |
| 11 | aloula / الزافر | Aloula - HLS / clvod.itworkscdn.net | 1.6.28 | playback_confirmed | 0.7 → 3.7 s / 1789.8 s (media3) |
| 12 | youtubeoriginals / باب بنات | YouTube - Watania Replay / www.youtube.com | 1.6.28 | playback_confirmed | 0.0 → 3.5 s / 7985.4 s (webview) |
| 13 | youtubeoriginals / الحرقة | YouTube - Watania Replay / www.youtube.com | 1.6.28 | no_advancing_video |  |
