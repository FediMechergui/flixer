# Catalogue refresh

## Data updates without deployments

Scheduled refreshes publish catalogue data to the `catalogue-runtime` GitHub
release. They never call hosting deployment hooks. The Netlify API is deployed explicitly
with `npm run publish` when backend code changes; data updates do not rebuild it.

The deployed backend checks the small runtime manifest at most once per two
minutes per active instance. It downloads the runtime index only when the
manifest advances. Functions do not run an endless timer after returning a
response. The independent collector continues every 15 minutes while the app
is closed, with historical traversal every two hours.

Each publication uses immutable, SHA-256-addressed gzip files. All changed files
upload before the manifest advances. An invalid, incomplete or unavailable
update retains the last complete runtime. Title/episode-owner buckets are
downloaded on demand, with bounded parallelism, decompression and cache size.
Optional provider source/episode-owner packs preserve Arabic, French cartoon
and official YouTube adapter metadata without bundling a frozen server snapshot.
Older APKs can ignore these additional manifest fields.
The publisher reuses unchanged files, paces uploads, retains the preceding
manifest and retires unused older assets after a grace period.

Before uploading, the publisher reserves room below GitHub's 1,000-assets per
release limit. It protects files referenced by the current, previous and pending
catalogues, then retires only unreferenced generated assets at least 20 minutes
old when capacity is tight. Cleanup and uploads share a one-request-per-second
pace. If protected/recent files leave insufficient room, publication fails
without changing the live manifest. Other releases and APK files are untouched.

New APKs use `/api/catalogue` for bootstrap and version-pinned index parts below
2 MB. Unchanged parts are reused on the device when the next publication
arrives. The static bundle remains an offline fallback. Catalogue publication
does not change the APK or require a hosting build. Code changes still need an
explicit backend deployment and a new APK when native/client code changes.

Android also reads these immutable files directly through its existing native
HTTP transport. This keeps catalogue and saved-guide updates available while
backend hosting is blocked and removes those data transfers from the backend.
Compressed files are hash checked before bounded decompression. Search and
playback resolution still use the backend and device adapters as appropriate.
The bundled index opens browsing immediately; the complete live index merges
in the background and cannot replace newer cached home rows with older ones.
Mobile background sync checks the publication rather than launching provider
crawls on every phone. The scheduled collector supplies those updates.

Hosted Android builds also split their bundled offline index into local parts
of approximately 1 MB, loading at most four at once. The complete generation is
validated before it merges into the catalogue. This avoids holding a roughly
92 MB response and its decoded JSON string together in the mobile WebView.
Missing parts retain the existing catalogue and try the live publication;
older bundled index files remain readable.

```sh
gh workflow run refresh.yml --ref main -f latest_only=true
```

## Recently updated episodes

The home bootstrap, hosted latest catalogue and APK use content dates rather
than provider crawl/check times. `contentUpdatedAt` records newly observed
episode content; `latestAt` and `publishedAt` retain dates supplied by sources.
`firstSeenAt` labels a catalogue addition when no content date is available.
Refreshing a poster, checking a server or importing an older guide does not
make a show a new release. Distinct content times retain chronological order;
titles with an identical update timestamp rotate between provider lanes so
one bulk source response does not occupy the whole row.

Episode updates require actual source episode IDs or explicit coordinates.
Equivalent IDs already present in an episode's offerings, old season backfills,
and lower episode numbers do not advance its update date. Unknown-season
numbering is compared only within the same source title. Merging a delayed
provider preserves the current latest episode and its canonical ID. A failed
refresh retains the previous guide and update evidence.

An initial full guide is catalogue discovery. A validated source latest feed
can explicitly mark `episodeUpdateFeed: true` on a row containing its actual
`latestEpisode`; for an existing title without a guide or previous pointer,
that first observed feed episode may advance `contentUpdatedAt`. The marker is
consumed before persistence, so later detail or historical imports cannot
inherit it. Repeated feed observations do not advance the date. Carateen uses
this marker only for its public recent-episode feed, not catalogue or detail
responses; its server-generated `updated_at` values are not release dates.

Published compact indices retain `recentEpisode` only from an exact source ID,
an offering alias or an unambiguous explicit season/episode reference. The
summary carries the actual episode title, known season/number and contributing
providers without bundling its full guide. Missing coordinates remain unknown
rather than being filled with a guessed season or episode.

## Earlier memory repair

The workflow runs a current-release refresh every 15 minutes and resumes the
historical traversal every two hours. Provider access errors preserve cached
records; a partial upstream response does not mean the refresh process crashed.

The 21 October incident was a Node heap exhaustion after collection. The saved
snapshot contained approximately 697 MB of provider JSON and 408 MB of catalogue
JSON. The refresh unnecessarily reread these archives, constructed a complete
identity-match catalogue even with `--matches 0`, and serialized whole exports
into single strings. Exit 134 prevented deployment.

The refresh now reuses the collected provider cache, reads its base catalogue
once, skips disabled identity work, releases the original graphs before export,
and writes catalogue arrays a title at a time. Backend deployments use packed
titles and avoid creating thousands of discarded loose title files. Standalone
static exports retain their title files.

To request an immediate current-release refresh without the slower historical
audits:

```sh
gh workflow run refresh.yml --ref main -f latest_only=true
```

The default manual run retains the historical crawl and metadata audits. The
`full` input restarts a completed historical traversal. Scheduled refreshes keep
their existing cadence and upstream retry/backoff behavior, including cached
HDToday records while hosted access is denied.

Regression coverage includes disabled matching doing no catalogue work, merging
the supplied cache instead of stale disk data, and exporting more than 64 MB of
JSON under a 64 MB heap. All 191 Node tests pass. A replay of the actual saved
hosted snapshot merged 138,433 source records into 98,537 titles and exported
successfully under the same 4 GB heap limit, with no catalogue truncation or
increase in the runner's heap allowance.
