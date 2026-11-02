# DessinAnime episode discovery, 2 November 2026

Operational update: [the independent GitHub-hosted browser runner](github-browser-runner.md)
now handles scheduled collection. The checks below document the initial mapping
and publication investigation.

Normal interactive Chrome, using a fresh isolated profile, loaded the source's
episode pages successfully on the local connection. Ordinary same-origin browser
requests then returned the actual server-rendered episode guides and player IDs.
Direct Node HTTP requests and the earlier headless session still received 403.
This is a browser collection path, not a change to the source's HTTP permissions.

The reviewed metadata is in `server/seeds/dessinanime-reviewed.json`. It contains
318 mapped episodes/films and 438 source player descriptors across six titles:

| Title | Mapped episodes/films | Source guide coordinates |
| --- | ---: | ---: |
| Les Simpson | 95 | 799 |
| Bluey | 92 | 150 |
| Avatar: The Last Airbender | 18 | 61 |
| Fullmetal Alchemist: Brotherhood | 21 | 64 |
| Miraculous | 91 | 159 |
| Avatar Aang film | 1 | 1 |

The guide total is not a playable-episode count. Player IDs were taken only from
pages whose title, season and episode matched the source identity. No guessed
player IDs or fabricated episode numbers are used. Cookies and browser account
state stay inside the isolated browser and are not published. Transient media
URLs are resolved when playing through Flixer's existing DessinAnime adapter.

## Collection and updates

`node scripts/collect-dessinanime-browser.js --launch --pages 60 --titles 4 --latest --write-cache`
launches normal Chrome/Chromium with a separate profile. On Linux, run it inside
`xvfb-run -a`. On a PC an already opened isolated browser can be selected with
`--port 9237` instead of `--launch`. `--ids` accepts exact source title IDs;
`--out` sets the resumable metadata checkpoint. The browser must be able to load
the source normally. A verification response stops collection and preserves data;
this did recur during a later local request after the successful collection.

The two-hour historical refresh attempts 60 browser pages across four titles.
It rotates previously unchecked titles and keeps one unfinished series moving
through its source guide. Latest mode checks the latest two stale mapped episodes
of each selected series before discovering unmapped coordinates. This is bounded
background work, not a full rescan of every title each run. A GitHub runner may
still be denied even when the local browser works; source failures never erase
previous mappings or prevent unrelated providers from refreshing.

The refresh imports the reviewed seed, merges browser discoveries into the
restored provider snapshot, and publishes catalogue data through the existing
runtime publication. No app redeployment is required for each data update.
Flixer 1.6.30 already understands the deferred player descriptors. Source-only
listings can no longer downgrade a mapped title and erase its episodes on a
later merge. Newer empty-player checks prevent an old seed from resurrecting
removed players.

The checkpoint is imported in a separate workflow step as well, so a browser
step timeout can retain pages completed before the timeout. A new browser first
loads the ordinary homepage before navigating to its selected title. Empty
reports exit before loading or rewriting the large provider cache.

## Verification

All 307 server regression tests passed. The new tests cover exact source identity binding, sparse episode
numbering, page limits, interrupted collection, resumed accumulation, retained
players, authoritative empty player lists, and validation before importing.

One newly discovered direct player per title was checked through
`/api/stream?playerId=...`. All six returned HTTP 200 stream descriptors. Five
MP4 relays returned HTTP 206 byte ranges and the Brotherhood HLS manifest
returned HTTP 200. In ordinary desktop Chrome, Les Simpson S1E2 player 1106666
advanced to 1.72 seconds (960×720), and Bluey S1E4 player 133294 advanced to
5.78 seconds (1280×720), during separate 12-second checks. Neither reported a
media error, although Simpson was buffering at the final sample. These short
checks do not establish sustained playback or successful Android playback.
The sanitized [desktop video results](dessinanime-evidence-2026-11-02/desktop-video.json)
and [six source API/media probes](dessinanime-evidence-2026-11-02/media-probes.json)
contain no transient media URLs.

## Hosted publication

[Refresh 41426018999](https://github.com/FediMechergui/flixer/actions/runs/41426018999)
completed successfully, publishing catalogue version `2026-11-02T10:13:05.690Z`.
Backend deploy `6ae860b45a4484834d1c6cb2` serves the corresponding code changes
on Netlify. No Vercel deployment or new APK was used for this data update.

The production API returned HTTP 200 title records and episode stream responses
for all six sampled titles, retaining all 318 source episode/film mappings.
Samples were Les Simpson S1E2, Bluey S1E4, Avatar S1E1, Brotherhood S1E1,
Miraculous special S0E1, and the Aang film. Each stream response contained its
actual deferred DessinAnime player ID(s). Source identity survived merging into the existing
Myflixer titles for Simpson, Bluey and Brotherhood. The six stream endpoint
requests took 449–669 ms; separate title retrieval took 805–2740 ms. These are
individual request measurements, not a general latency benchmark.

[Hosted results](dessinanime-evidence-2026-11-02/hosted-results.json) record each
episode ID, source player IDs, counts and timings. API resolution alone does not
prove playback of every player.

The first GitHub runner browser attempt still required verification and collected
zero pages. The reviewed mappings were retained and published successfully.
Local browser discovery is confirmed; fresh discovery on GitHub is still blocked.
The homepage-first retry in
[scheduled run 41427923643](https://github.com/FediMechergui/flixer/actions/runs/41427923643)
also stopped for verification with zero collected pages. Its metadata import
retained the published mappings. The rest of that scheduled historical refresh
continues independently. The source-specific collector can resume locally when
ordinary browser access is available; no automated verification solving is used.

Source: [DessinAnime](https://dessinanime.cc/).
