# Flixer inline-player follow-up - 3 November 2026

This continues the [1.6.31 repair audit](player-repair-2026-11-03.md). Install [Flixer 1.6.32](https://github.com/FediMechergui/flixer/releases/tag/flixer-v1.6.32) for the native player changes. The backend changes are already deployed.

## Changes

- HDToday: current publisher migration support, 44 source-derived film routes and 44 episode routes, bounded refreshes, and native player support. A successful empty server list stays empty on reopening. Routes remain unverified until playback starts.
- Ahwak and EgyDead: current title/episode redirects, correct player referrers and faster repeated resolution. Sampled HGCloud, Uqload and Morencius routes play inside the app.
- French players: uses the current DessinAnime.net source iframe instead of an obsolete generated playlist; adds free source-published Frembed/Netu choices with a genuine iframe context.
- Nested Streamtape playback now reports progress to the app, preventing the startup timer from closing a playing child video.
- Film listings containing only an identified trailer are reported as preview-only. Failure diagnostics distinguish HTTP, network, missing-video and debugger-restriction outcomes.

## Verification

Validation: **387 Node tests and 24 Android unit tests passed**. The follow-up emulator sweep tested **65/65 selected routes across 14 providers**, with **16 automatic advancing-clock confirmations**. Six ordinary-app follow-ups brought the distinct confirmed total to **18/65**. Retries do not increase coverage; the original automatic outcomes remain preserved.

| Automatic outcome | Selected routes |
| --- | ---: |
| no_advancing_video | 20 |
| playback_confirmed | 16 |
| missing_video | 3 |
| source_unavailable | 16 |
| debugger_restricted | 8 |
| preview_only | 1 |
| unverified_clock_attribution | 1 |

The [sanitized report](inline-followup-2026-11-03.json) contains every selected route and prior attempts. A loaded page, HTTP 200, a short placeholder, or a trailer does not establish full-content playback. Advancing clocks are short samples; they do not prove an entire programme plays to completion.

Previously verified routes from 1.6.31 are documented separately. Two manual HDToday Phony episode tests showed advancing video on VidFast and Vidcore; they are retained separately from this sweep. That exact title was absent from the hosted catalogue during its later API check, so these are player tests, not a hosted title-workflow claim.

Hosted checks returned 44 HDToday choices for a known Murdoch Mysteries episode and a film with a verified shared identity. Source templates indicate available choices, not verified copies. StreamTunisie Startup returned no full-film servers and an explicit trailer-only provider error.

## Ordinary-app follow-ups

Only the app bridge was inspected during these six retries; no player debugger was attached. Vidrift and DessinAnime.net Xtremestream showed advancing content clocks on the final APK. The other four samples did not establish playback.

| Source | Ordinary interaction | Result |
| --- | --- | --- |
| multimovies / embed.vidrift.net | Source autoplay | Confirmed: 0.127989 to 3.876387 seconds |
| cimafu / doodstream.com | Tapped the genuine triangle Play control | Unconfirmed; startup timed out |
| frenchstream / trakx.lol | Tapped the genuine triangle Play control | Unconfirmed; startup timed out |
| frembed / netu.frembed.bond | Closed the visible advertisement using its X control; Tapped the video surface once to expose ordinary playback controls | Unconfirmed; startup timed out |
| dessinanimenet / lecteur1.xtremestream.xyz | Tapped the genuine triangle Play control | Confirmed: 0.1 to 4.061505 seconds |
| animegg / www.animegg.org | Tapped the visible advertisement X control | Unconfirmed; startup timed out |

AnimeGG had an earlier untagged WebView clock followed by a Media3 handoff. The available evidence does not confirm the resulting native player, so it remains unverified. Netu displayed duration metadata without advancing video. Dood and Trakx reached promotional overlays; no promotion was opened.

## Remaining source limitations

This is sample coverage, not every catalogue title or episode. Some upstream files remain missing, restricted or fail to start. DessinAnime episode-page restrictions still limit new player discovery. See the attached report for exact outcomes.

Native WebView inspections can affect hosts that explicitly reject DevTools; uninspected ordinary-Play follow-ups are reported separately. No account, verification or premium restrictions were changed.

## Delivery

- Netlify deployment: 6ae9e35ac4ca429ad666c473.
- Release APK SHA-256: `e3895d1b00dc3e345b64e056d548ce7d3f8d3b4898a9d78182c0a3efa64e1219`.
- Signing certificate SHA-256: `dc2f6a10b7f82be57780b684ee77e4eedab0510fadb787850a2605402cb810c5`.
- Catalogue collection remains on GitHub-hosted runners; videos are not relayed through Netlify.
