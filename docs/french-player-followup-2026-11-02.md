# French player follow-up — 2 November 2026

This follows [the source integration](french-expansion-2026-11-02.md).

## Changes

Frembed's free player uses `/api/films` or `/api/series` to obtain individual
language-labelled server records. Flixer now validates their title, season,
episode and server IDs, then inspects the source's redirect to a recognized host.
The app receives individual inline Voe, Dood and Uqload choices. The original
Frembed selector remains as a fallback for unsupported or changed hosts. No
premium endpoint, account or video proxy is used.

Source redirects are inspected without following their destinations on Netlify.
The initial request keeps DNS/address validation and pinning; destination hosts
and player paths are independently checked. Ordinary redirect handling elsewhere
is unchanged. Successful redirect results are cached for two minutes.

French titles with an existing verified TMDB identity can check Frembed's actual
availability at playback time, before the historical crawl reaches that title.
Series require existing season/episode coordinates. Quick playback responses do
not wait for this optional lookup. Missing API results do not create players.

DessinAnime.net currently advertises `lecteur1.xtremestream.xyz`. The previous
adapter omitted `.xyz`, rejecting an actual source host. The adapter now accepts
that host family and passes the source referrer and user agent to native HLS.

## Checked results

| Check | Result |
| --- | --- |
| GitHub refresh [41439712781](https://github.com/FediMechergui/flixer/actions/runs/41439712781) | Successful publication; 105,596 merged titles across all providers, not a French-only or playable-title count |
| New provider refresh errors | Neither Frembed nor DessinAnime.net was reported as failed |
| DessinAnime.cc hosted refresh | HTTP 403; cached data retained |
| Le Petit Prince, Frembed free server records | VF Voe and VF Dood routes exposed and validated |
| Avatar S1E1, Frembed free server records | VF Uqload route exposed and validated |
| Avatar's sampled Uqload host | HTTP 200 containing an explicit expired/deleted-file message; **missing video** |
| Le Petit Prince's sampled Voe host | Redirected to another Voe domain and returned HTTP 404 |
| Le Petit Prince's sampled Dood host | HTTP 403 browser-verification page |
| Scooby-Doo Halloween, DessinAnime.net Xtremestream | Master and 480p/720p variant playlists returned HTTP 200; the first two segments of each quality returned HTTP 404 |
| Ben 10, DessinAnime.net Emmmmbed host | Requests timed out; no playback confirmation |
| Backend regression suite | **323 passed**, including redirect safety and source identity tests |

These results demonstrate why catalogue entries, API availability, redirects and
valid HLS playlists must not be counted as successful playback. The existing
Android health observer already recognizes the exact Uqload deleted-file message
and requests failover; this backend update exposes the individual host to it.

## Android verification limit

The existing API 35 emulator repeatedly lost Android's system services before
the audit activity could run (`DeadSystemException`, broken activity service).
Increasing CPU/RAM did not make it usable. A fresh disposable API 35 device was
created; its default 12 GB partition exceeded available disk space, so only that
new device's data partition was reduced to 4 GB. It did not finish booting and
installing the app in this attempt. No new player was marked working or dead
from those emulator failures.

All test emulators were stopped. Automatic approval review blocked deletion of
the disposable device, reporting only “blocked by policy.” Its files remain in
`artifacts/french-native-2026-11-02/avd`, with its named Android AVD registration.
Other existing virtual devices were not deleted or reset.

Background refreshes remain on GitHub-hosted runners. Only backend code changes
require a deployment; no new APK is required for these server descriptors.

## Production publication

Code commit `11727d1` was pushed to `main` and published in Netlify deployment
[`6ae891b5f6990d6744c22f00`](https://app.netlify.com/projects/flixer-api-fedimechergui/deploys/6ae891b5f6990d6744c22f00).
The deployed health endpoint returned HTTP 200 with `ok: true`.

Fresh hosted stream checks returned HTTP 200 for all three sampled titles:

- Le Petit Prince: individual VF Voe and VF Dood choices plus the source selector
  and existing alternatives, in 5.2 seconds.
- Avatar S1E1: individual VF Uqload plus merged Myflixer, MultiMovies,
  French Stream, FMovies and existing alternatives, in 10.8 seconds.
- Scooby-Doo Halloween: native HLS descriptor plus its Xtremestream iframe,
  in 8.3 seconds.

These are single fresh-request observations, not latency benchmarks or playback
confirmations. The upstream failures listed above remain. No APK was rebuilt;
the existing app can consume these backend descriptors. Verification summaries
are in the ignored artifact `artifacts/french-expansion/hosted-followup.json`.
