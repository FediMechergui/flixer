# Catalogue refresh

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
