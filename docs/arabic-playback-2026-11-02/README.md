# Tunisian films and Arabic-series playback — 2 November 2026

Flixer now resolves CimaTN's separate publisher feeds, current EgyDead and
Kirmalk origins, and AhwakTV's actual inline episode iframe. Playback stays
inside the app; source pages never receive the Capacitor bridge.

## Verified scope

| Check | Result |
| --- | --- |
| Tuniflix Tunisian films | All 3 advertised pages: 113 entries, 113 with supported descriptors |
| CimaTN Tunisian films | Complete film feed: 70 entries, 54 with supported descriptors |
| Combined source entries | 183, including duplicates across sources; 167 with descriptors, 16 without |
| Android player sample | 14 distinct routes across 7 title samples; 6 advancing-video confirmations |
| Confirmed Tunisian films | Tuniflix/Uqload: In a Whisper / بيت الحس, El Naffoura / النافورة, The Needle / الإبرة |
| Confirmed Arabic episodes | Bab El Hara S1E1, S1E2 and S2E23, Aj Art Production's YouTube uploads |
| Reviewed Bab El Hara alternatives | 85 producer-upload links matched to 42 existing episode slots |
| Regression tests | 295 passed |

Descriptors establish that the source advertises a supported link. They do not
certify playback for an entire film or catalogue. Android tests used the existing
production player in the 1.6.29 audit APK with freshly resolved descriptors, then
the 1.6.30 audit APK for S1E1 and S2E23. The device-side Ahwak parser also resolved
the actual iframe in 2.48 seconds on 1.6.30. Origin handling has fixture tests.
Initial emulator
Bluetooth crash dialogs were excluded from source results; affected attempts
were repeated after closing the system dialog.

See [device results](provider-playback-audit-2026-11-02.md),
[device proof data](provider-playback-audit-2026-11-02.json), and
[every audited film](tunisian-film-coverage.json). Private embed URLs, signed
media queries and raw scripts are excluded from these reports.

## Fixes and updates

- CimaTN film watch pages use several publisher blogs and both page and post
  feeds. The adapter follows the feed declared in the title's watch script;
  unrelated Blogger subscription links cannot override it. Multiline slug
  literals, `WATCH_PAGE_SLUG`, literal own-domain watch buttons, and complete
  feed pagination are supported.
- Only reviewed publisher origins are accepted. Exact slugs take precedence;
  ambiguous matches stay unresolved. Removed watch feeds produce per-title
  errors instead of discarding an entire catalogue page. Each listing reuses
  watch-feed requests, including failures.
- English-first film titles are preserved. Explicitly differently titled film
  cross-promotions are excluded when a page provides its own named option.
  Approved embedded players receive their source referrer.
- Saved EgyDead and Kirmalk identities remain stable while requests use the
  verified destinations `a1.egydead.media` and `kirmalk.art`. Unrelated redirects
  remain rejected. Hosted and device parsers also support AhwakTV's actual
  `.brooks_player` iframe, excluding unrelated frames.
- Aj Art Production is now a scheduled official Arabic-series source. Actual
  episode coordinates are retained; clips and restricted entries are excluded.
  Latin Bab El Hara aliases resolve Arabic channel search. An explicit numeric
  season suffix maps to the same show; unspecified seasons remain unknown.
- Reviewed producer offerings attach to existing AhwakTV episode identities,
  retaining their original routes. Catalogue refreshes import them and continue
  channel backfill. Latest updates still publish data separately from application
  deployment. No polling redeployments were introduced.

Producer reference: [Bab El Hara S1E1](https://www.youtube.com/watch?v=Cadfhi55dRg).
Its public metadata identifies Aj Art Production and permits the standard
YouTube embed. That does not certify every channel video in every region.

## Remaining upstream failures

Sampled Strp2p, VK, Videas, MediaDelivery and OK.ru routes did not show advancing
content clocks. MediaDelivery moved past its initial denial with source context
but still stalled, including a failed Bunny CDN DNS lookup. These remain failed
or unconfirmed samples; timeouts do not establish permanently dead hosts.
Tuniflix's independently advertised Uqload choices played for all three films.
AhwakTV's Bab El Hara OK.ru route failed; the named producer alternative played.

StreamTunisie returned HTTP 525 in the origin check; stored records are retained.
CimaTN's `cimatunisaaa.blogspot.com` feed returned 404. Fractus's advertised Rumble
link returned 410, so it was not added as a functioning player.

Sixteen CimaTN entries lack approved descriptors. This does not establish that
the same films are absent from other sources. Samhani, El Ziara, La Fuite,
Affreux, On the Edge and Borj Roumi point to Artify or promotional trailers;
trailers are not accepted as full films. Other gaps involve missing watch records
or unsupported/unavailable hosts. The coverage JSON lists every unresolved entry.

Recheck without changing catalogue data:

```sh
node scripts/audit-tunisian-films.js --out artifacts/tunisian-films-audit.json
```

The command follows all advertised pages, detects repeated pages, uses bounded
concurrency, and distinguishes descriptors from playback. This investigation does
not certify every Tunisian film ever released or every Arabic series.

## Delivery validation

The production backend was deployed as `6ae84a14e72d342b7d3bfc47`. Hosted health
and stream checks returned HTTP 200. The Needle returns two Tuniflix choices and
three CimaTN choices together, retaining each source's identity and referrer.

The signed 1.6.30 APK is version code 10630, 18,227,337 bytes, SHA-256
`1ea51637e33dacabe4fd704d28834b155609dc69a380f92ba11e8598834b77dd`.
Debug and release builds completed successfully. APK signature verification
passed; release assets include the new source parser and exclude the debug audit
page. Data publication uses the ordinary catalogue workflow, without another
application deployment.
