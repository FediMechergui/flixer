# GitHub-hosted DessinAnime collection

Flixer uses a standard `windows-latest` GitHub-hosted runner for the
`DessinAnime browser collection` workflow. Standard hosted compute is free for
this public repository. The runner is temporary; it does not retain a verified
browser session between jobs. No self-hosted runner is installed on the PC.

The browser job runs every two hours or on manual dispatch. It installs only
the source parser dependencies, loads a DessinAnime-only catalogue seed, and
reads up to 60 pages across four titles with normal Chrome. It stops when the
source asks for verification. The workflow summary distinguishes that outcome
from successful collection; a green job does not mean every page was accessible.

The ordinary catalogue refresh exports a compact seed from the provider snapshot
during historical or manually triggered runs. The browser job downloads that
seed from a completed, trusted `main` run; the reviewed six-title seed is the
fallback until a recent export is available. The initial full local export had
3,606 title records and was 3,942,358 bytes, without the full multi-provider
snapshot or an Android build.

The browser job uploads its source metadata as a GitHub Actions artifact. The
ordinary refresh downloads and validates it before merging it into the restored
provider cache. Only completed scheduled/manual runs of the designated workflow
on this repository's `main` branch are accepted. Malformed identities, foreign
player hosts, duplicate titles and oversized files are rejected. Empty or failed
discovery preserves published records. Artifact retention is one day, with high
compression; browser profiles, cookies and media files are not uploaded.

Netlify remains the APK's backend. The API address, request routing, video
transport and Netlify configuration are unchanged. Browser collection and
metadata publication do not trigger Netlify deployments or keep-alive requests.
The GitHub job is a catalogue worker, not an application API or video relay.
Existing hosting and storage quotas still apply.

Manual run:

```sh
gh workflow run dessin-browser.yml --repo FediMechergui/flixer --ref main
```

If DessinAnime still denies the hosted browser, the job records that limitation
and the app continues using verified mappings. A free runner does not guarantee
source access, and this workflow does not automate verification challenges.

## First hosted check, 2 November 2026

[Windows run 41433094993](https://github.com/FediMechergui/flixer/actions/runs/41433094993)
completed successfully. All 19 collector/handoff tests passed on the runner.
No completed catalogue-seed artifact was available yet, so it used the reviewed
six-title seed. Normal Chrome still encountered source verification and read
zero episode pages. The report was uploaded and the production import command
downloaded it through the trusted-workflow check; importing it returned
`items: 0, unchanged: true`. No mappings were replaced.

Netlify's existing health endpoint returned HTTP 200. No API, APK, Netlify
configuration or deployment was changed for this runner. The local regression
suite passed 309 of 310 tests in parallel; the existing large-export test hit
its 30-second subprocess timeout. Its isolated rerun passed all three memory
tests, with that export completing in 2.49 seconds. No timeout was relaxed.

References: [GitHub billing](https://docs.github.com/en/actions/concepts/billing-and-usage),
[Windows runner image](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md).
