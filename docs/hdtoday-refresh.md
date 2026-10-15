# HDToday refresh access

Checked 15 October 2026 using the same requests locally and on GitHub Actions.
All five tested routes (`/home`, `/movie`, `/tv`, `/new-episodes`, `/api/suggest`)
returned HTTP 403 with `cf-mitigated: challenge` on GitHub's Ubuntu runner,
using both native fetch and the DNS-pinned transport. Locally the catalogue
and search returned HTTP 200. This is an upstream host challenge, not a parser
error. No CAPTCHA, verification token, proxy rotation or challenge bypass is used.

The adapter now identifies this condition and pauses further requests for ten
minutes. Rate limiting has a separate cooldown. Existing catalogue records and
historical cursors remain intact.

## Independent metadata feed

An environment with ordinary access can run:

```powershell
node scripts/refresh-hdtoday.js --pages 12 --publish
gh workflow run refresh.yml --repo FediMechergui/flixer --ref main
```

The first command refreshes film, series and recent-episode listings, continues
the independent historical cursors, validates the result and publishes only
metadata as `hdtoday-feed.json` on the `provider-hdtoday` release. It does not
overwrite the main data snapshot or other providers. A failed scan never
publishes a partial replacement. `--publish` requires the repository owner's
existing GitHub CLI authentication.

The hosted workflow downloads this asset before merging providers. A valid
snapshot less than 36 hours old replaces direct HDToday crawling on that run.
Its own timestamp and record count appear in `providerSync.externalFeeds`;
the workflow timestamp does not pretend that the upstream was freshly crawled.
Expired/invalid feeds are rejected; cached titles remain available and direct
hosted access is retried and reported honestly.

`scripts/hdtoday-refresh-task.ps1` performs the two commands and writes a local
log in `artifacts`. It is prepared for Windows Task Scheduler but is **not
registered automatically**. If this PC supplies the feed, it must be online
periodically; otherwise the feed becomes stale after 36 hours. An always-on
environment with permitted upstream access can run the same Node command.
