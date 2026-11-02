# DessinAnime episode discovery, 2 November 2026

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
loads the ordinary homepage before navigating to its selected title.

## Verification

All 306 server regression tests passed. The new tests cover exact source identity binding, sparse episode
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
Browser-runner and hosted API results are recorded below after publication.

Source: [DessinAnime](https://dessinanime.cc/).
