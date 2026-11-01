# Android provider playback audit — 31 October 2026

Partial device audit. APKs 1.6.29-audit; 42/84 returned server choices tested across 23 title samples; 14 advancing-video confirmations.

Device observation window: 31 Oct 2026, 18:19 to 1 Nov 2026, 01:19 WAT.

A selected 42-route device sample from 84 returned server choices across 23 title samples. Untested choices remain explicit. Original and final APK hashes are retained per attempt; movie/TV alternatives are counted separately from the catalogue owner.

This checks the production player in an Android emulator. Each case has one server, so another source cannot silently satisfy its test. Playback requires the same visible content clock to advance by at least one second, reach three seconds and have a duration of at least two minutes. HTTP success, loaded frames and native “playing” signals alone are not confirmations. These are short playback samples, not full-film or every-episode validation.

The source provider identifies the catalogue sample. A returned alternative may belong to another player provider; source-server confirmations below exclude those alternatives. A timeout is unconfirmed, not evidence of permanent removal. Source restrictions and unavailable episode links remain explicit. Temporary media URLs, query tokens, source scripts and cookies are excluded.

| Provider | Samples | Returned choices | Own-source choices | Tested | Played | Played from own source |
|---|---:|---:|---:|---:|---:|---:|
| tuniflix | 1 | 2 | 2 | 2 | 1 | 1 |
| cimatn | 1 | 2 | 2 | 2 | 0 | 0 |
| egydead | 1 | 0 | 0 | 0 | 0 | 0 |
| aloula | 1 | 1 | 1 | 1 | 1 | 1 |
| youtubeoriginals | 1 | 1 | 1 | 1 | 1 | 1 |
| fmovies | 2 | 12 | 6 | 12 | 4 | 0 |
| myflixer | 1 | 7 | 7 | 4 | 0 | 0 |
| cimafu | 1 | 22 | 22 | 4 | 2 | 2 |
| streamtunisie | 1 | 0 | 0 | 0 | 0 | 0 |
| ahwaktv | 1 | 3 | 3 | 1 | 0 | 0 |
| frenchstream | 1 | 5 | 5 | 1 | 1 | 1 |
| cinetimes | 1 | 1 | 1 | 1 | 1 | 1 |
| megacartoons | 1 | 1 | 1 | 1 | 1 | 1 |
| myasiantv | 1 | 1 | 1 | 1 | 0 | 0 |
| toontales | 1 | 1 | 1 | 1 | 1 | 1 |
| yoturkish | 1 | 2 | 2 | 1 | 0 | 0 |
| wco | 1 | 1 | 1 | 1 | 0 | 0 |
| multimovies | 1 | 6 | 6 | 1 | 1 | 1 |
| animegg | 1 | 1 | 1 | 1 | 0 | 0 |
| kirmalk | 1 | 0 | 0 | 0 | 0 | 0 |
| hdtoday | 1 | 12 | 12 | 3 | 0 | 0 |
| dessinanime | 1 | 3 | 3 | 3 | 0 | 0 |

## Outcomes

| Outcome | Choices |
|---|---:|
| player_error | 9 |
| playback_confirmed | 14 |
| no_advancing_video | 16 |
| access_denied | 2 |
| pending | 42 |
| verification_required | 1 |

## Lookup and guide gaps

- egydead / رهين: no_own_servers.
- streamtunisie / ستارتاب: no_own_servers.
- kirmalk / صفحة بيضا الموسم 1: resolution_error — Episode not found in this catalogue.

## Per-server device results

| Case | Source / title | Server / host | APK | Result | Evidence |
|---:|---|---|---|---|---|
| 1 | tuniflix / الإبرة | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.29-audit | player_error |  |
| 2 | tuniflix / الإبرة | Tuniflix - uqload.vc / uqload.vc | 1.6.29-audit | playback_confirmed | 0.6 → 3.8 s / 6985.3 s (webview) |
| 3 | cimatn / Hbiba فيلم الرعب حبيبة كامل | CimaTN - vkvideo.ru / vkvideo.ru | 1.6.29-audit | no_advancing_video |  |
| 4 | cimatn / Hbiba فيلم الرعب حبيبة كامل | CimaTN - geo.dailymotion.com / geo.dailymotion.com | 1.6.29-audit | access_denied | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 5 | aloula / الزافر | Aloula - HLS / clvod.itworkscdn.net | 1.6.29-audit | playback_confirmed | 1.1 → 3.1 s / 2880.0 s (media3) |
| 6 | youtubeoriginals / باب بنات | YouTube - Watania Replay / www.youtube.com | 1.6.29-audit | playback_confirmed | 0.0 → 3.1 s / 7985.4 s (webview) |
| 7 | fmovies / Dune: Part Two | FMovies · Embos / embos.top | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 8 | fmovies / Dune: Part Two | FMovies · Vidcore / vidcore.net | 1.6.29-audit | no_advancing_video |  |
| 9 | fmovies / Dune: Part Two | FMovies · VidAPI / vidapi.xyz | 1.6.29-audit | no_advancing_video |  |
| 10 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 1 / sv2.nontongo.stream | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 11 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 2 / balance.medmedia03.wiki | 1.6.29-audit | no_advancing_video |  |
| 12 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 3 / vidapi.xyz | 1.6.29-audit | pending |  |
| 13 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 4 / embedmaster.link | 1.6.29-audit | pending |  |
| 14 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 5 / vidfast.pro | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 15 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 6 / multiembed.mov | 1.6.29-audit | no_advancing_video |  |
| 16 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 7 / moviesapi.to | 1.6.29-audit | pending |  |
| 17 | cimafu / Tenzing | Cima4u - doodstream.com - Arabic sub / doodstream.com | 1.6.29-audit | pending |  |
| 18 | cimafu / Tenzing | Cima4u - doodstream.com - Arabic sub / doodstream.com | 1.6.29-audit | pending |  |
| 19 | cimafu / Tenzing | Cima4u - doodstream.com - Arabic sub / doodstream.com | 1.6.29-audit | pending |  |
| 20 | cimafu / Tenzing | Cima4u - bysetayico.com - Arabic sub / bysetayico.com | 1.6.29-audit | pending |  |
| 21 | cimafu / Tenzing | Cima4u - bysetayico.com - Arabic sub / bysetayico.com | 1.6.29-audit | pending |  |
| 22 | cimafu / Tenzing | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.29-audit | pending |  |
| 23 | cimafu / Tenzing | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.29-audit | pending |  |
| 24 | cimafu / Tenzing | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.29-audit | pending |  |
| 25 | cimafu / Tenzing | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.29-audit | pending |  |
| 26 | cimafu / Tenzing | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.29-audit | pending |  |
| 27 | cimafu / Tenzing | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.29-audit | pending |  |
| 28 | cimafu / Tenzing | Cima4u - cybervynx.com - Arabic sub / cybervynx.com | 1.6.29-audit | pending |  |
| 29 | cimafu / Tenzing | Cima4u - cybervynx.com - Arabic sub / cybervynx.com | 1.6.29-audit | pending |  |
| 30 | cimafu / Tenzing | Cima4u - 1vid.xyz - Arabic sub / 1vid.xyz | 1.6.29-audit | playback_confirmed | 1.1 → 4.3 s / 7533.7 s (webview) |
| 31 | cimafu / Tenzing | Cima4u - vidmoly.org - Arabic sub / vidmoly.org | 1.6.29-audit | no_advancing_video |  |
| 32 | cimafu / Tenzing | Cima4u - vidspeed.org - Arabic sub / vidspeed.org | 1.6.29-audit | no_advancing_video |  |
| 33 | cimafu / Tenzing | Cima4u - www.mp4upload.com - Arabic sub / www.mp4upload.com | 1.6.29-audit | pending |  |
| 34 | cimafu / Tenzing | Cima4u - bysesukior.com - Arabic sub / bysesukior.com | 1.6.29-audit | pending |  |
| 35 | cimafu / Tenzing | Cima4u - mixdrop.top - Arabic sub / mixdrop.top | 1.6.29-audit | pending |  |
| 36 | cimafu / Tenzing | Cima4u - hgcloud.to - Arabic sub / hgcloud.to | 1.6.29-audit | playback_confirmed | 1.9 → 3.9 s / 7533.7 s (media3) |
| 37 | cimafu / Tenzing | Cima4u - playmogo.com - Arabic sub / playmogo.com | 1.6.29-audit | pending |  |
| 38 | cimafu / Tenzing | Cima4u - voe.sx - Arabic sub / voe.sx | 1.6.29-audit | pending |  |
| 39 | ahwaktv / صقر وكناريا | AhwakTV - vkvideo.ru / vkvideo.ru | 1.6.29-audit | no_advancing_video |  |
| 40 | ahwaktv / صقر وكناريا | AhwakTV - www.ok.ru / www.ok.ru | 1.6.29-audit | pending |  |
| 41 | ahwaktv / صقر وكناريا | AhwakTV - uqload.vc / uqload.vc | 1.6.29-audit | pending |  |
| 42 | frenchstream / He's Watching You | French Stream · DEFAULT · vidzy / vidzy.cc | 1.6.29-audit | playback_confirmed | 0.1 → 4.1 s / 6151.1 s (media3) |
| 43 | frenchstream / He's Watching You | French Stream · DEFAULT · dood / trakx.lol | 1.6.29-audit | pending |  |
| 44 | frenchstream / He's Watching You | French Stream · VF · dood / trakx.lol | 1.6.29-audit | pending |  |
| 45 | frenchstream / He's Watching You | French Stream · DEFAULT · voe / trakx.lol | 1.6.29-audit | pending |  |
| 46 | frenchstream / He's Watching You | French Stream · VF · voe / trakx.lol | 1.6.29-audit | pending |  |
| 47 | cinetimes / La fille de Carthage (1924) - Cinetimes | Cinetimes - Wikimedia archive / upload.wikimedia.org | 1.6.29-audit | playback_confirmed | 1.7 → 3.7 s / 1108.2 s (media3) |
| 48 | megacartoons / Baby Looney Tunes | MegaCartoons / ww.megacartoons.net | 1.6.29-audit | playback_confirmed | 0.6 → 4.6 s / 601.4 s (media3) |
| 49 | myasiantv / You Should Be the One to Kiss Me | MyAsianTV - English sub / zumivids.com | 1.6.29-audit | verification_required | protected by reCAPTCHA This site is exceeding reCAPTCHA Enterprise free quota. |
| 50 | toontales / Rabbit Fire | ToonTales / ww.toontales.net | 1.6.29-audit | playback_confirmed | 1.4 → 3.4 s / 452.4 s (media3) |
| 51 | yoturkish / Sevdam Karadeniz | YoTurkish - Server 1 (English sub) / rufiiguta.com | 1.6.29-audit | no_advancing_video |  |
| 52 | yoturkish / Sevdam Karadeniz | YoTurkish - Server 2 (English sub) / engifuosi.com | 1.6.29-audit | pending |  |
| 53 | wco / With Vengeance Sincerely Your Broken Saintess | Watch Cartoon Online / www.wcostream.tv | 1.6.29-audit | no_advancing_video |  |
| 54 | multimovies / Street Fighter | MultiMovies - Cineverse / rozgarlelo.modiplay.xyz | 1.6.29-audit | playback_confirmed | 0.0 → 3.6 s / 6522.7 s (webview) |
| 55 | multimovies / Street Fighter | MultiMovies - GD mirror / streams.iqsmartgames.com | 1.6.29-audit | pending |  |
| 56 | multimovies / Street Fighter | MultiMovies - Vidrift / embed.vidrift.net | 1.6.29-audit | pending |  |
| 57 | multimovies / Street Fighter | MultiMovies - VIDOUT / vidout.pages.dev | 1.6.29-audit | pending |  |
| 58 | multimovies / Street Fighter | MultiMovies - Filmu / embed.filmu.in | 1.6.29-audit | pending |  |
| 59 | multimovies / Street Fighter | MultiMovies - VidBolt / vidbolt.xyz | 1.6.29-audit | pending |  |
| 60 | animegg / Hakata Tonkotsu Ramens | AnimeGG - Subbed / www.animegg.org | 1.6.29-audit | no_advancing_video |  |
| 61 | hdtoday / Dad, Make Me Marry | HDToday · vidsrc.mov / vidsrc.mov | 1.6.29-audit | no_advancing_video |  |
| 62 | hdtoday / Dad, Make Me Marry | HDToday · vidsrc.fyi / vidsrc.fyi | 1.6.29-audit | pending |  |
| 63 | hdtoday / Dad, Make Me Marry | HDToday · VIP / embed.vidsrc.si | 1.6.29-audit | pending |  |
| 64 | hdtoday / Dad, Make Me Marry | HDToday · vidfast / vidfast.pro | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 65 | hdtoday / Dad, Make Me Marry | HDToday · vidup / vidup.to | 1.6.29-audit | pending |  |
| 66 | hdtoday / Dad, Make Me Marry | HDToday · vidrock / vidrock.net | 1.6.29-audit | pending |  |
| 67 | hdtoday / Dad, Make Me Marry | HDToday · vidnest / vidnest.fun | 1.6.29-audit | pending |  |
| 68 | hdtoday / Dad, Make Me Marry | HDToday · vidlink / vidlink.pro | 1.6.29-audit | pending |  |
| 69 | hdtoday / Dad, Make Me Marry | HDToday - Vidlove / player.vidlove.cc | 1.6.29-audit | pending |  |
| 70 | hdtoday / Dad, Make Me Marry | HDToday · multiembed / multiembed.mov | 1.6.29-audit | no_advancing_video |  |
| 71 | hdtoday / Dad, Make Me Marry | HDToday · mappletv / mappletv.uk | 1.6.29-audit | pending |  |
| 72 | hdtoday / Dad, Make Me Marry | HDToday · moviesapi / moviesapi.to | 1.6.29-audit | pending |  |
| 73 | dessinanime / Les Simpson | DessinAnime - VF - Panda / dessinanime | 1.6.29-audit | no_advancing_video |  |
| 74 | dessinanime / Les Simpson | DessinAnime - VF - Panda / dessinanime | 1.6.29-audit | no_advancing_video |  |
| 75 | dessinanime / Les Simpson | DessinAnime - MULTI - Lecteur / morencius.com | 1.6.29-audit | no_advancing_video |  |
| 76 | fmovies / The Simpsons | FMovies · Embos / embos.top | 1.6.29-audit | access_denied | 451 |
| 77 | fmovies / The Simpsons | FMovies · Vidcore / vidcore.net | 1.6.29-audit | player_error |  |
| 78 | fmovies / The Simpsons | FMovies · VidAPI / vidapi.xyz | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 79 | fmovies / The Simpsons | VidSrc / vidsrc.mov | 1.6.29-audit | playback_confirmed | 0.0 → 4.3 s / 1395.0 s (webview) |
| 80 | fmovies / The Simpsons | VidFast / vidfast.pro | 1.6.29-audit | playback_confirmed | 0.0 → 3.9 s / 1395.0 s (webview) |
| 81 | fmovies / The Simpsons | VidLink / vidlink.pro | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 82 | fmovies / Dune: Part Two | VidSrc / vidsrc.mov | 1.6.29-audit | playback_confirmed | 0.1 → 3.1 s / 9947.1 s (webview) |
| 83 | fmovies / Dune: Part Two | VidFast / vidfast.pro | 1.6.29-audit | playback_confirmed | 0.0 → 3.7 s / 9948.0 s (webview) |
| 84 | fmovies / Dune: Part Two | VidLink / vidlink.pro | 1.6.29-audit | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
