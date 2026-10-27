# Android provider playback audit — 24 October 2026

Completed audit. APKs 1.6.26; 78/78 returned server choices tested across 35 title samples; 21 advancing-video confirmations.

Device observation window: 24 Oct 2026, 18:54 to 24 Oct 2026, 19:21 WAT.

Follow-up using two Android 15 emulators: one previously advertised own-source route for each provider/host family, plus all four WCO cartoon/anime samples. Direct media is refreshed at test time; embeds use descriptors from the original sample matrix. Lookup statuses are retained from that matrix; four separate fresh One Pace lookups still returned zero episode links. This is not every episode or a repeat of all 336 routes.

This checks the production player in an Android emulator. Each case has one server, so another source cannot silently satisfy its test. Playback requires the same visible content clock to advance by at least one second, reach three seconds and have a duration of at least two minutes. HTTP success, loaded frames and native “playing” signals alone are not confirmations. These are short playback samples, not full-film or every-episode validation.

The source provider identifies the catalogue sample. A returned alternative may belong to another player provider; source-server confirmations below exclude those alternatives. A timeout is unconfirmed, not evidence of permanent removal. Source restrictions and unavailable episode links remain explicit. Temporary media URLs, query tokens, source scripts and cookies are excluded.

| Provider | Samples | Returned choices | Own-source choices | Tested | Played | Played from own source |
|---|---:|---:|---:|---:|---:|---:|
| myflixer | 2 | 8 | 8 | 8 | 1 | 1 |
| fmovies | 1 | 3 | 3 | 3 | 0 | 0 |
| hdtoday | 1 | 12 | 12 | 12 | 1 | 1 |
| cimafu | 1 | 13 | 13 | 13 | 2 | 2 |
| streamtunisie | 1 | 1 | 1 | 1 | 0 | 0 |
| kirmalk | 2 | 2 | 2 | 2 | 0 | 0 |
| ahwaktv | 2 | 6 | 6 | 6 | 0 | 0 |
| egydead | 2 | 4 | 4 | 4 | 1 | 1 |
| tuniflix | 3 | 3 | 3 | 3 | 1 | 1 |
| cinetimes | 1 | 1 | 1 | 1 | 1 | 1 |
| cimatn | 1 | 3 | 3 | 3 | 1 | 1 |
| frenchstream | 2 | 3 | 3 | 3 | 0 | 0 |
| dessinanime | 1 | 2 | 2 | 2 | 2 | 2 |
| onepace | 4 | 0 | 0 | 0 | 0 | 0 |
| youtubeoriginals | 1 | 1 | 1 | 1 | 1 | 1 |
| wco | 4 | 4 | 4 | 4 | 4 | 4 |
| animegg | 1 | 1 | 1 | 1 | 0 | 0 |
| megacartoons | 1 | 1 | 1 | 1 | 1 | 1 |
| toontales | 1 | 1 | 1 | 1 | 1 | 1 |
| myasiantv | 1 | 1 | 1 | 1 | 1 | 1 |
| multimovies | 1 | 6 | 6 | 6 | 3 | 3 |
| yoturkish | 1 | 2 | 2 | 2 | 0 | 0 |

## Outcomes

| Outcome | Choices |
|---|---:|
| no_advancing_video | 33 |
| player_error | 21 |
| playback_confirmed | 21 |
| verification_required | 1 |
| missing_video | 1 |
| access_denied | 1 |

11 additional choices have an earlier playback confirmation and a different latest outcome; see per-route evidence.

## Lookup and guide gaps

- cimatn / Arriére el goddem أريار القدام 2: resolution_error — Episode not found in this catalogue.
- onepace / One Pace: Punk Hazard: no_episode_links — One Pace source HTTP 403.
- onepace / One Pace: Thriller Bark: no_episode_links — One Pace source HTTP 403.
- onepace / One Pace: The Adventures of Buggy's Crew: no_episode_links — One Pace source HTTP 403.
- onepace / One Pace: Whole Cake Island: no_episode_links — One Pace source HTTP 403.

## Per-server device results

| Case | Source / title | Server / host | APK | Result | Evidence |
|---:|---|---|---|---|---|
| 1 | fmovies / Come Home Love: Lo and Behold | FMovies · Embos / embos.top | 1.6.26 | no_advancing_video |  |
| 2 | fmovies / Come Home Love: Lo and Behold | FMovies · Vidcore / vidcore.net | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 3 | fmovies / Come Home Love: Lo and Behold | FMovies · VidAPI / vidapi.xyz | 1.6.26 | no_advancing_video |  |
| 7 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 1 / sv2.nontongo.stream | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 8 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 2 / balance.medmedia03.wiki | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 9 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 3 / vidapi.xyz | 1.6.26 | no_advancing_video |  |
| 10 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 4 / embedmaster.link | 1.6.26 | no_advancing_video |  |
| 11 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 5 / vidfast.pro | 1.6.26 | no_advancing_video |  |
| 12 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 6 / multiembed.mov | 1.6.26 | no_advancing_video |  |
| 13 | myflixer / Tazza: The Song of Beelzebub | Myflixer · Player 7 / moviesapi.to | 1.6.26 | no_advancing_video |  |
| 14 | cimafu / Tenzing | Cima4u - doodstream.com - Arabic sub / doodstream.com | 1.6.26 | no_advancing_video |  |
| 17 | cimafu / Tenzing | Cima4u - bysetayico.com - Arabic sub / bysetayico.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 19 | cimafu / Tenzing | Cima4u - mixdrop.ps - Arabic sub / mixdrop.ps | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 25 | cimafu / Tenzing | Cima4u - cybervynx.com - Arabic sub / cybervynx.com | 1.6.26 | playback_confirmed | 2.0 → 4.0 s / 7533.7 s (media3) (earlier playback confirmed on 1.6.24) |
| 27 | cimafu / Tenzing | Cima4u - 1vid.xyz - Arabic sub / 1vid.xyz | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.24) |
| 28 | cimafu / Tenzing | Cima4u - vidmoly.org - Arabic sub / vidmoly.org | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.25) |
| 29 | cimafu / Tenzing | Cima4u - vidspeed.org - Arabic sub / vidspeed.org | 1.6.26 | no_advancing_video |  |
| 30 | cimafu / Tenzing | Cima4u - www.mp4upload.com - Arabic sub / www.mp4upload.com | 1.6.26 | no_advancing_video |  |
| 31 | cimafu / Tenzing | Cima4u - bysesukior.com - Arabic sub / bysesukior.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 32 | cimafu / Tenzing | Cima4u - mixdrop.top - Arabic sub / mixdrop.top | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 33 | cimafu / Tenzing | Cima4u - hgcloud.to - Arabic sub / hgcloud.to | 1.6.26 | playback_confirmed | 1.4 → 3.4 s / 7533.7 s (media3) (earlier playback confirmed on 1.6.25) |
| 34 | cimafu / Tenzing | Cima4u - playmogo.com - Arabic sub / playmogo.com | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.25) |
| 35 | cimafu / Tenzing | Cima4u - voe.sx - Arabic sub / voe.sx | 1.6.26 | no_advancing_video |  |
| 36 | streamtunisie / ستارتاب | StreamTunisie - YouTube / www.youtube.com | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.23) |
| 37 | myflixer / The Diplomat | Myflixer · Soap2Cloud (HLS) / snowy-morning.soapsoap123.workers.dev | 1.6.26 | playback_confirmed | 0.6 → 3.3 s / 2648.9 s (media3) (earlier playback confirmed on 1.6.25) |
| 90 | ahwaktv / صقر وكناريا | AhwakTV - vkvideo.ru / vkvideo.ru | 1.6.26 | no_advancing_video |  |
| 91 | ahwaktv / صقر وكناريا | AhwakTV - www.ok.ru / www.ok.ru | 1.6.26 | no_advancing_video |  |
| 92 | ahwaktv / صقر وكناريا | AhwakTV - uqload.vc / uqload.vc | 1.6.26 | verification_required | CONFIRM YOU ARE NOT A ROBOT Click the button I'm not a robot |
| 93 | ahwaktv / صقر وكناريا | AhwakTV - hgcloud.to / hgcloud.to | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.24) |
| 94 | ahwaktv / صقر وكناريا | AhwakTV - playmogo.com / playmogo.com | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.22) |
| 95 | ahwaktv / خمسين خمسين | AhwakTV - ok.ru / ok.ru | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 98 | tuniflix / الإبرة | Tuniflix - watch.easyvidplayer.com / watch.easyvidplayer.com | 1.6.26 | no_advancing_video |  |
| 99 | tuniflix / Doctor Love | Tuniflix - YouTube / www.youtube.com | 1.6.26 | playback_confirmed | 0.0 → 3.9 s / 1101.9 s (webview) (earlier playback confirmed on 1.6.23) |
| 100 | cinetimes / La fille de Carthage (1924) - Cinetimes | Cinetimes - Wikimedia archive / upload.wikimedia.org | 1.6.26 | playback_confirmed | 0.4 → 4.4 s / 1108.2 s (media3) (earlier playback confirmed on 1.6.22) |
| 101 | frenchstream / He's Watching You | French Stream · DEFAULT · vidzy / vidzy.cc | 1.6.26 | no_advancing_video |  |
| 102 | frenchstream / He's Watching You | French Stream · DEFAULT · dood / trakx.lol | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.22) |
| 107 | frenchstream / Dumas | French Stream · VF · uqload / uqload.vc | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.25) |
| 112 | youtubeoriginals / Knights Of Guinevere | YouTube - GLITCH / www.youtube.com | 1.6.26 | playback_confirmed | 0.0 → 3.5 s / 1587.5 s (webview) (earlier playback confirmed on 1.6.23) |
| 113 | megacartoons / Baby Looney Tunes | MegaCartoons / ww.megacartoons.net | 1.6.26 | playback_confirmed | 0.6 → 4.6 s / 601.4 s (media3) (earlier playback confirmed on 1.6.22) |
| 114 | myasiantv / You Should Be the One to Kiss Me | MyAsianTV - English sub / zumivids.com | 1.6.26 | playback_confirmed | 0.0 → 3.1 s / 1441.5 s (webview) (earlier playback confirmed on 1.6.25) |
| 115 | toontales / Rabbit Fire | ToonTales / ww.toontales.net | 1.6.26 | playback_confirmed | 1.1 → 3.1 s / 452.4 s (media3) (earlier playback confirmed on 1.6.22) |
| 117 | yoturkish / Sevdam Karadeniz | YoTurkish - Server 1 (English sub) / rufiiguta.com | 1.6.26 | no_advancing_video |  |
| 118 | yoturkish / Sevdam Karadeniz | YoTurkish - Server 2 (English sub) / engifuosi.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 119 | multimovies / Street Fighter | MultiMovies - Cineverse / rozgarlelo.modiplay.xyz | 1.6.26 | playback_confirmed | 0.0 → 4.1 s / 6522.7 s (webview) (earlier playback confirmed on 1.6.22) |
| 120 | multimovies / Street Fighter | MultiMovies - GD mirror / streams.iqsmartgames.com | 1.6.26 | playback_confirmed | 0.4 → 3.0 s / 6522.7 s (webview) (earlier playback confirmed on 1.6.22) |
| 121 | multimovies / Street Fighter | MultiMovies - Vidrift / embed.vidrift.net | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers (earlier playback confirmed on 1.6.22) |
| 122 | multimovies / Street Fighter | MultiMovies - VIDOUT / vidout.pages.dev | 1.6.26 | playback_confirmed | 3.2 → 5.1 s / 6522.7 s (webview) (earlier playback confirmed on 1.6.22) |
| 123 | multimovies / Street Fighter | MultiMovies - Filmu / embed.filmu.in | 1.6.26 | no_advancing_video |  |
| 124 | multimovies / Street Fighter | MultiMovies - VidBolt / vidbolt.xyz | 1.6.26 | missing_video | 404 Page not found |
| 153 | wco / With Vengeance Sincerely Your Broken Saintess | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | playback_confirmed | 0.0 → 8.1 s / 780.1 s (media3) (earlier playback confirmed on 1.6.25) |
| 161 | animegg / Hakata Tonkotsu Ramens | AnimeGG - Subbed / www.animegg.org | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 163 | wco / Gravity Falls | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | playback_confirmed | 1.3 → 11.4 s / 1268.8 s (media3) (earlier playback confirmed on 1.6.22) |
| 164 | wco / Scooby-Doo, Where Are You! | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | playback_confirmed | 1.8 → 7.2 s / 1313.3 s (media3) (earlier playback confirmed on 1.6.22) |
| 165 | wco / Haikyuu — English subbed | Watch Cartoon Online / www.wcostream.tv | 1.6.26 | playback_confirmed | 1.1 → 9.3 s / 1467.1 s (media3) (earlier playback confirmed on 1.6.22) |
| 198 | kirmalk / صفحة بيضا الموسم 1 | Kirmalk - www.ok.ru / www.ok.ru | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 252 | hdtoday / Dad, Make Me Marry | HDToday · vidsrc.mov / vidsrc.mov | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 253 | hdtoday / Dad, Make Me Marry | HDToday · vidsrc.fyi / vidsrc.fyi | 1.6.26 | no_advancing_video |  |
| 254 | hdtoday / Dad, Make Me Marry | HDToday · VIP / embed.vidsrc.si | 1.6.26 | playback_confirmed | 0.0 → 6.1 s / 5702.5 s (webview) (earlier playback confirmed on 1.6.22) |
| 255 | hdtoday / Dad, Make Me Marry | HDToday · vidfast / vidfast.pro | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 256 | hdtoday / Dad, Make Me Marry | HDToday · vidup / vidup.to | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 257 | hdtoday / Dad, Make Me Marry | HDToday · vidrock / vidrock.net | 1.6.26 | no_advancing_video | 404 (earlier playback confirmed on 1.6.23) |
| 258 | hdtoday / Dad, Make Me Marry | HDToday · vidnest / vidnest.fun | 1.6.26 | no_advancing_video |  |
| 259 | hdtoday / Dad, Make Me Marry | HDToday · vidlink / vidlink.pro | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 260 | hdtoday / Dad, Make Me Marry | HDToday - Vidlove / player.vidlove.cc | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 261 | hdtoday / Dad, Make Me Marry | HDToday · multiembed / multiembed.mov | 1.6.26 | no_advancing_video |  |
| 262 | hdtoday / Dad, Make Me Marry | HDToday · mappletv / mappletv.uk | 1.6.26 | no_advancing_video |  |
| 263 | hdtoday / Dad, Make Me Marry | HDToday · moviesapi / moviesapi.to | 1.6.26 | no_advancing_video |  (earlier playback confirmed on 1.6.24) |
| 303 | kirmalk / الضيف | Kirmalk - s1.hdup400.com / s1.hdup400.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 321 | dessinanime / Les Simpson | DessinAnime - VF - Panda / dessinanime | 1.6.26 | playback_confirmed | 1.3 → 3.4 s / 1395.2 s (media3) (earlier playback confirmed on 1.6.25) |
| 323 | dessinanime / Les Simpson | DessinAnime - MULTI - Lecteur / morencius.com | 1.6.26 | playback_confirmed | 5.0 → 18.3 s / 1394.9 s (webview) (earlier playback confirmed on 1.6.25) |
| 327 | tuniflix / صيف حلق الوادي | Tuniflix - watch.strp2p.site / watch.strp2p.site | 1.6.26 | no_advancing_video |  |
| 328 | egydead / المهايطية | EgyDead - q7v3k8m2p1.top / q7v3k8m2p1.top | 1.6.26 | no_advancing_video |  |
| 329 | egydead / رهين | EgyDead - hgcloud.to / hgcloud.to | 1.6.26 | playback_confirmed | 1.1 → 3.3 s / 5212.6 s (media3) (earlier playback confirmed on 1.6.25) |
| 330 | egydead / رهين | EgyDead - morencius.com / morencius.com | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 331 | egydead / رهين | EgyDead - mixdrop.top / mixdrop.top | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 332 | cimatn / Arriére el goddem أريار القدام 2 | CimaTN - YouTube / www.youtube.com | 1.6.26 | playback_confirmed | 0.0 → 6.5 s / 2255.4 s (webview) (earlier playback confirmed on 1.6.23) |
| 333 | cimatn / Arriére el goddem أريار القدام 2 | CimaTN - geo.dailymotion.com / geo.dailymotion.com | 1.6.26 | access_denied | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
| 334 | cimatn / Arriére el goddem أريار القدام 2 | CimaTN - vkvideo.ru / vkvideo.ru | 1.6.26 | player_error | No player is available right now Try a fresh server list or choose another source. You can close this player at any time. Refresh servers |
