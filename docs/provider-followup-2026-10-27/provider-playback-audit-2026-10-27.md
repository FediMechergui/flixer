# Android provider playback audit — 27 October 2026

Completed audit. APKs 1.6.26; 40/40 returned server choices tested across 10 title samples; 7 advancing-video confirmations.

Device observation window: 27 Oct 2026, 16:35 to 27 Oct 2026, 17:50 WAT.

Fresh 27 October Tunisian and Arabic title/episode lookups, every returned server choice for these six titles, plus four published WCO samples without observing publisher WebViews through DevTools. Alternatives are attributed to their actual provider. Not every catalogue title or episode.

This checks the production player in an Android emulator. Each case has one server, so another source cannot silently satisfy its test. Playback requires the same visible content clock to advance by at least one second, reach three seconds and have a duration of at least two minutes. HTTP success, loaded frames and native “playing” signals alone are not confirmations. These are short playback samples, not full-film or every-episode validation.

The source provider identifies the catalogue sample. A returned alternative may belong to another player provider; source-server confirmations below exclude those alternatives. A timeout is unconfirmed, not evidence of permanent removal. Source restrictions and unavailable episode links remain explicit. Temporary media URLs, query tokens, source scripts and cookies are excluded.

| Provider | Samples | Returned choices | Own-source choices | Tested | Played | Played from own source |
|---|---:|---:|---:|---:|---:|---:|
| wco | 4 | 4 | 4 | 4 | 0 | 0 |
| tuniflix | 3 | 4 | 4 | 4 | 2 | 2 |
| cimatn | 1 | 0 | 0 | 0 | 0 | 0 |
| egydead | 1 | 11 | 0 | 11 | 2 | 0 |
| cimafu | 1 | 21 | 21 | 21 | 3 | 3 |

## Outcomes

| Outcome | Choices |
|---|---:|
| no_advancing_video | 25 |
| player_error | 8 |
| playback_confirmed | 7 |

## Lookup and guide gaps

- cimatn / الرعب حبيبة Hbiba: no_servers — Arabic source HTTP 429.

## Per-server device results

| Case | Source / title | Server / host | APK | Result | Evidence |
|---:|---|---|---|---|---|
| 153 | wco / With Vengeance Sincerely Your Broken Saintess | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | no_advancing_video |  |
| 163 | wco / Gravity Falls | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | no_advancing_video |  |
| 164 | wco / Scooby-Doo, Where Are You! | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | no_advancing_video |  |
| 165 | wco / Haikyuu — English subbed | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | no_advancing_video |  |
| 1001 | tuniflix / صيف حلق الوادي | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 1002 | tuniflix / الإبرة | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.26 | no_advancing_video |  |
| 1003 | tuniflix / الإبرة | Tuniflix - uqload.vc / uqload.vc | 1.6.26 | playback_confirmed | 385.0 → 386.2 s / 6985.3 s (webview) (earlier playback confirmed on 1.6.26) |
| 1004 | tuniflix / Doctor Love | Tuniflix - YouTube / www.youtube.com | 1.6.26 | playback_confirmed | 2.3 → 10.3 s / 1101.9 s (webview) |
| 1005 | egydead / رهين | AhwakTV - hgcloud.to / hgcloud.to | 1.6.26 | playback_confirmed | 2.0 → 4.0 s / 5212.8 s (media3) |
| 1006 | egydead / رهين | French Stream · DEFAULT · vidzy / vidzy.cc | 1.6.26 | playback_confirmed | 0.0 → 3.4 s / 5212.8 s (webview) |
| 1007 | egydead / رهين | French Stream · VOSTFR · vidzy / vidzy.cc | 1.6.26 | no_advancing_video |  |
| 1008 | egydead / رهين | French Stream · VF · vidzy / vidzy.cc | 1.6.26 | no_advancing_video |  |
| 1009 | egydead / رهين | French Stream · DEFAULT · uqload / uqload.vc | 1.6.26 | no_advancing_video |  |
| 1010 | egydead / رهين | French Stream · VOSTFR · uqload / uqload.vc | 1.6.26 | no_advancing_video |  |
| 1011 | egydead / رهين | French Stream · DEFAULT · dood / kokoflix.lol | 1.6.26 | no_advancing_video |  |
| 1012 | egydead / رهين | French Stream · VOSTFR · dood / trakx.lol | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 1013 | egydead / رهين | French Stream · DEFAULT · voe / kokoflix.lol | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 1014 | egydead / رهين | French Stream · VOSTFR · voe / trakx.lol | 1.6.26 | no_advancing_video |  |
| 1015 | egydead / رهين | French Stream · DEFAULT · filmoon / kokoflix.lol | 1.6.26 | no_advancing_video |  |
| 1016 | cimafu / المعلم | Cima4u - doodstream.com - Arabic sub / doodstream.com | 1.6.26 | no_advancing_video |  |
| 1017 | cimafu / المعلم | Cima4u - doodstream.com - Arabic sub / doodstream.com | 1.6.26 | no_advancing_video |  |
| 1018 | cimafu / المعلم | Cima4u - doodstream.com - Arabic sub / doodstream.com | 1.6.26 | no_advancing_video |  |
| 1019 | cimafu / المعلم | Cima4u - bysetayico.com - Arabic sub / bysetayico.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 1020 | cimafu / المعلم | Cima4u - bysetayico.com - Arabic sub / bysetayico.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 1021 | cimafu / المعلم | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.26 | no_advancing_video |  |
| 1022 | cimafu / المعلم | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.26 | no_advancing_video |  |
| 1023 | cimafu / المعلم | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.26 | no_advancing_video |  |
| 1024 | cimafu / المعلم | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.26 | no_advancing_video |  |
| 1025 | cimafu / المعلم | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.26 | no_advancing_video |  |
| 1026 | cimafu / المعلم | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.26 | no_advancing_video |  |
| 1027 | cimafu / المعلم | Cima4u - cybervynx.com - Arabic sub / cybervynx.com | 1.6.26 | player_error | ERROR_CODE_IO_BAD_HTTP_STATUS |
| 1028 | cimafu / المعلم | Cima4u - cybervynx.com - Arabic sub / cybervynx.com | 1.6.26 | player_error | ERROR_CODE_IO_BAD_HTTP_STATUS |
| 1029 | cimafu / المعلم | Cima4u - 1vid.xyz - Arabic sub / 1vid.xyz | 1.6.26 | playback_confirmed | 0.0 → 3.8 s / 8100.0 s (webview) |
| 1030 | cimafu / المعلم | Cima4u - vidmoly.org - Arabic sub / vidmoly.org | 1.6.26 | playback_confirmed | 0.0 → 3.9 s / 8100.0 s (webview) |
| 1031 | cimafu / المعلم | Cima4u - vidspeed.org - Arabic sub / vidspeed.org | 1.6.26 | playback_confirmed | 1.2 → 4.8 s / 8100.0 s (webview) |
| 1032 | cimafu / المعلم | Cima4u - bysesukior.com - Arabic sub / bysesukior.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 1033 | cimafu / المعلم | Cima4u - mixdrop.top - Arabic sub / mixdrop.top | 1.6.26 | no_advancing_video |  |
| 1034 | cimafu / المعلم | Cima4u - hgcloud.to - Arabic sub / hgcloud.to | 1.6.26 | no_advancing_video |  |
| 1035 | cimafu / المعلم | Cima4u - playmogo.com - Arabic sub / playmogo.com | 1.6.26 | no_advancing_video |  |
| 1036 | cimafu / المعلم | Cima4u - voe.sx - Arabic sub / voe.sx | 1.6.26 | no_advancing_video |  |
