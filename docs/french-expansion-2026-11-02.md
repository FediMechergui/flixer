# French animation sources — 2 November 2026

Flixer now has separate adapters for Frembed and DessinAnime.net, alongside the
existing DessinAnime.cc and French Stream adapters. This is backend work; it does
not change the existing APK's inline/fullscreen behaviour or Dahsha's scope.

## Integration

- Frembed's animation category pages provide French names, posters, premiere
  years, pagination and advertised episode coordinates. Latest refreshes select
  the source's `updated_at` ordering. Its documented public API confirms actual
  movie/episode availability before an inline embed is returned. Empty API results
  never create players. IDs match by media kind and TMDB ID; episode offerings
  merge by season and episode. TV API years are not used as premiere years because
  they can refer to later seasons.
- DessinAnime.net provides public animation listings, named episode guides,
  artwork and synopses. Episode pages expose `data-embed` values; the ordinary
  `/ajax/embed` endpoint returns the real host. Recognized Xtremestream frames
  support the same HLS mapping used by Cartoony, with a source referrer. Emmmmbed
  remains an inline host frame and may require user verification. Unknown/dead
  hosts are not converted into invented media links.
- Some `.net` search results have obsolete slug URLs. The adapter accepts a
  stable Cartoony source identity only when the source title and poster match
  uniquely. The 459-record identity seed is not a collection of video URLs.
- Both adapters participate in search, catalogue pagination and existing
  scheduled refreshes. Scan version 9 adds their traversal jobs to saved queues.
  Existing episode refreshes revisit series; upstream errors retain cached data.
  Requests are coalesced, cached for two minutes and bounded in time/size.

## What Cartoony actually does

Cartoony lists the 2015 **Le Petit Prince** under `dessinanime.cc` with TMDB
identity 309809. Its `.cc` adapter also calls `streamingIdentityPlayers`, offering
independently labelled FMovies alternatives for the same verified identity.
Therefore a successful playback from that card does not prove a `.cc` stream
was used. DessinAnime.net is a separate adapter, not an interchangeable domain.

Flixer's `.cc` fallback now checks Frembed's API for matching media kind, TMDB ID
and release year. The new alternative stays labelled Frembed. Existing verified
`.cc` player IDs and the GitHub-hosted browser collector remain in place.

## Validation and remaining limitations

- All 318 backend tests passed, including eight new integration regressions.
  A subsequent hosted-access correction passed 25 targeted tests, including a
  ninth regression for cached identity fallback when both source pages and
  source search return 403.
- Live API checks: Le Petit Prince (2015) returns Frembed in unified playback;
  Avatar has 61 episodes across three seasons; French title search returns the
  correct film; Frembed's updated animation listing includes episode markers.
- Live DessinAnime.net checks: Ben 10: Alien Force search maps to its actual
  source ID; details provide 46 episodes, a poster and a synopsis; S1E1 returns
  its actual Emmmmbed frame. A separate request to that host timed out after
  ten seconds, so the route is not counted as confirmed playback.
- These checks verify discovery and player routing, **not advancing APK video**.
  The direct HTTP `.cc` film page still returned a browser-verification 403.
  Automatic approval review blocked launching an isolated local Chrome for a
  further browser check, with no specific reason beyond “blocked by policy.”
- Frembed's free embeds can contain advertising; its advertised ad-free offer is
  paid. This integration does not purchase it or promise universally ad-free
  playback. Existing app popup/ad controls remain unchanged.
- No video proxy, Netlify keepalive, additional refresh deployment loop or
  self-hosted GitHub runner is introduced. Background collection remains on the
  existing GitHub-hosted workflow schedule.

The first production checks exposed a hosted-only `.cc` search denial. The
fallback was corrected to use an existing source snapshot before requesting
source search, while keeping independent identity/year verification mandatory.

Production deployment `6ae879721a1cc43fd5e2c0d1` includes that correction. Hosted
checks returned HTTP 200 for both provider searches, Avatar's 61-episode guide,
Ben 10's 46-episode guide and Avatar's stream endpoint. Le Petit Prince's `.cc`
title endpoint now returns one film episode, `access: public`, both source
offerings, and no provider errors; its stream endpoint includes Frembed. These
are API/discovery results, not a claim of completed video playback.

The existing APK consumes these provider descriptors without a rebuild. Normal
GitHub data refreshes update the saved catalogue without a Netlify deployment.

Sources: [Frembed API](https://frembed.uno/api-docs),
[animation updates](https://frembed.uno/tv-show?genre=animation&orderBy=updated_at&orderDirection=desc),
[DessinAnime.net](https://dessinanime.net/category/animation),
[DessinAnime.cc](https://dessinanime.cc/).
