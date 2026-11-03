# DessinAnime delivery investigation — 3 November 2026

Six sampled DessinAnime.cc player IDs returned actual video bytes today. This
establishes source delivery for those samples, not playback of every title or
successful Android playback. The separate device audit is needed for that.

## Source transport and fallback handling

The source's ordinary `GET /api/stream?playerId=...` returned HTTP 200 without an
`Access-Control-Allow-Origin` header for requests carrying either
`Origin: https://localhost` or `Origin: capacitor://localhost`. An ordinary browser
fetch cannot read that response. Flixer already enables Capacitor's fetch patch,
and the 1.6.30 baseline reached `DirectVideo.open` before the audit connection
timed out. Therefore missing CORS headers are not proof that the installed APK's
metadata request failed. The update makes native HTTP transport, response checks
and source headers explicit. No account or verification token was used.

The response supplies an expiring MP4 or HLS URL on
`https://relay.dessinanime.cc/api/stream-relay/`, optional quality choices and,
for the sampled Brotherhood episode, an explicit MP4 fallback alongside HLS.
The source's own public player script falls back to the exact source iframe
when its direct player fails. Flixer now preserves that original iframe in the
deferred descriptor instead of discarding it. It also preserves source referrer,
user agent, language labels and the API's explicit media fallback.

## Sampled delivery

All six source metadata requests returned HTTP 200. Requests used the source
referrer `https://dessinanime.cc/` and user agent `Mozilla/5.0`; video requests
read only a 4,096-byte range.

| Source title | Episode | Player ID | Media evidence |
| --- | --- | --- | --- |
| Les Simpson | S1E1 | 1106663 | HTTP 206, MP4 `ftyp` header, 4,096 bytes |
| Bluey | S1E4 | 133294 | HTTP 206, MP4 `ftyp` header, 4,096 bytes |
| Avatar: Le Dernier Maître de l'air | S1E1 | 1511590 | HTTP 206, MP4 `ftyp` header, 4,096 bytes |
| Fullmetal Alchemist: Brotherhood | S1E1 | 2271469 | HLS master and variant HTTP 200; first segment HTTP 206, MPEG-TS bytes; explicit MP4 fallback also HTTP 206 with `ftyp` |
| Miraculous | S0E1 | 2227614 | HTTP 206, MP4 `ftyp` header, 4,096 bytes |
| Avatar Aang film | Film | 2245757 | HTTP 206, MP4 `ftyp` header, 4,096 bytes |

Coordinates above come from the reviewed source metadata. In particular,
player 1106663 belongs to the current seed's Simpson S1E1; an older probe labelled
it S1E3. No player IDs were guessed or enumerated for this investigation.

Sanitized results are in the ignored artifact
`artifacts/dessin-2026-11-03/cc-media-verified.json`. Private API responses retain
expiring URLs only under the ignored artifact directory. The native audit matrix
is `artifacts/player-repair-2026-11-03/dessin/resolved.private.json`.

## Discovery and verification limits

The sampled episode HTML still returns HTTP 403. The current site's public
`EpisodeList` code receives its seasons in server-rendered data and navigates to
ordinary `/tv/{slug}/{season}/{episode}` pages. No separate public episode-guide
or player-ID discovery API was found in the homepage and episode JavaScript.
The 318 previously mapped episodes/films remain the verified discovery set;
the larger source guide must not be advertised as 318-plus playable mappings.

Cartoony's DessinAnime.cc adapter also uses source frames when readable and then
TMDB identity alternatives. It does not contain a special method for reading
these blocked episode pages. DessinAnime.net is a distinct source whose public
`/ajax/embed` responses expose Emmmmbed and Xtremestream hosts. Its returned
iframe or HLS descriptor alone does not prove video delivery.

The final source routing regression subset passed 18 tests, including two
new checks for preserving the real iframe and MP4 fallback without accepting
foreign relay destinations.

Sources inspected: [DessinAnime.cc](https://dessinanime.cc/) and
[DessinAnime.net](https://dessinanime.net/), plus the local Cartoony adapters.
