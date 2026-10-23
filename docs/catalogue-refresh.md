# Catalogue refresh

## Data updates without deployments

Scheduled refreshes publish catalogue data to the `catalogue-runtime` GitHub
release. They never call Vercel deployment hooks or run `vercel deploy`.
Automatic deployments on Git pushes are disabled in `vercel.json`; deploy
application code explicitly when it changes.

The deployed backend checks the small runtime manifest at most once per two
minutes per active instance. It downloads the runtime index only when the
manifest advances. Functions do not run an endless timer after returning a
response. The independent collector continues every 15 minutes while the app
is closed, with historical traversal every two hours.

Each publication uses immutable, SHA-256-addressed gzip files. All changed files
upload before the manifest advances. An invalid, incomplete or unavailable
update retains the last complete runtime. Title/episode-owner buckets are
downloaded on demand, with bounded parallelism, decompression and cache size.
The publisher reuses unchanged files, paces uploads, retains the preceding
manifest and retires unused older assets after a grace period.

New APKs use `/api/catalogue` for bootstrap and version-pinned index parts below
2 MB. Unchanged parts are reused on the device when the next publication
arrives. The static bundle remains an offline fallback. Catalogue publication
does not change the APK or require a Vercel build. Code changes still need an
explicit backend deployment and a new APK when native/client code changes.

Android also reads these immutable files directly through its existing native
HTTP transport. This keeps catalogue and saved-guide updates available while
backend hosting is blocked and removes those data transfers from Vercel.
Compressed files are hash checked before bounded decompression. Search and
playback resolution still use the backend and device adapters as appropriate.
The bundled index opens browsing immediately; the complete live index merges
in the background and cannot replace newer cached home rows with older ones.
Mobile background sync checks the publication rather than launching provider
crawls on every phone. The scheduled collector supplies those updates.

```sh
gh workflow run refresh.yml --ref main -f latest_only=true
```

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
