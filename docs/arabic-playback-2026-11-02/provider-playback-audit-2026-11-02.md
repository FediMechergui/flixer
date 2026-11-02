# Android provider playback audit — 2 November 2026

Completed audit. APKs 1.6.29-audit; 12/12 returned server choices tested across 7 title samples; 4 advancing-video confirmations.

Device observation window: 2 Nov 2026, 09:10 to 2 Nov 2026, 09:23 WAT.

Every returned server for the provider/type/language sample matrix, using the production player; not every catalogue episode.

This checks the production player in an Android emulator. Each case has one server, so another source cannot silently satisfy its test. Playback requires the same visible content clock to advance by at least one second, reach three seconds and have a duration of at least two minutes. HTTP success, loaded frames and native “playing” signals alone are not confirmations. These are short playback samples, not full-film or every-episode validation.

The source provider identifies the catalogue sample. A returned alternative may belong to another player provider; source-server confirmations below exclude those alternatives. A timeout is unconfirmed, not evidence of permanent removal. Source restrictions and unavailable episode links remain explicit. Temporary media URLs, query tokens, source scripts and cookies are excluded.

| Provider | Samples | Returned choices | Own-source choices | Tested | Played | Played from own source |
|---|---:|---:|---:|---:|---:|---:|
| tuniflix | 3 | 6 | 6 | 6 | 3 | 3 |
| cimatn | 2 | 4 | 4 | 4 | 0 | 0 |
| youtubeoriginals | 1 | 1 | 1 | 1 | 1 | 1 |
| ahwaktv | 1 | 1 | 1 | 1 | 0 | 0 |

## Outcomes

| Outcome | Choices |
|---|---:|
| player_error | 7 |
| playback_confirmed | 4 |
| no_advancing_video | 1 |

## Lookup and guide gaps


## Per-server device results

| Case | Source / title | Server / host | APK | Result | Evidence |
|---:|---|---|---|---|---|
| 1 | tuniflix / بيت الحس | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 2 | tuniflix / بيت الحس | Tuniflix - uqload.vc / uqload.vc | 1.6.29-audit | playback_confirmed | 0.1 → 3.3 s / 6756.9 s (webview) |
| 3 | tuniflix / النافورة | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 4 | tuniflix / النافورة | Tuniflix - uqload.vc / uqload.vc | 1.6.29-audit | playback_confirmed | 0.2 → 3.5 s / 6191.6 s (webview) |
| 5 | tuniflix / الإبرة | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 6 | tuniflix / الإبرة | Tuniflix - uqload.vc / uqload.vc | 1.6.29-audit | playback_confirmed | 0.3 → 4.1 s / 6985.3 s (webview) |
| 7 | cimatn / ابرة The Needle | CimaTN - vkvideo.ru / vkvideo.ru | 1.6.29-audit | no_advancing_video |  |
| 8 | cimatn / ابرة The Needle | CimaTN - player.mediadelivery.net / player.mediadelivery.net | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 9 | cimatn / ابرة The Needle | CimaTN - app.videas.fr / app.videas.fr | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 10 | cimatn / دار العرس Dar El 3ers HDCAM | CimaTN - player.mediadelivery.net / player.mediadelivery.net | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 12 | youtubeoriginals / باب الحارة | YouTube - Aj Art Production / www.youtube.com | 1.6.29-audit | playback_confirmed | 0.0 → 4.0 s / 3060.5 s (webview) |
| 13 | ahwaktv / باب الحارة | AhwakTV - www.ok.ru / www.ok.ru | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
