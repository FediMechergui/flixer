# Flixer Android interface and inline playback

Validation started on 31 October and continued on 1 November 2026 (Africa/Lagos). This work targets the Android app built from `client-terrarium/` and its existing Netlify backend.

## Interface and loading

- Retained Flixer's green and amber identity, movie and series catalogues, filters, universes, streaming services and specialist collections.
- Reduced the feature panel from a 4:5 poster to a compact square. Replaced automatic slide rotation with accessible previous/next controls.
- Improved supporting-text contrast, poster-title readability and touch targets. Added a visible loading state before the application scripts initialize.
- Home ranking rows now render independently. A delayed optional ranking or universe rail does not hold the ready rows behind it.
- The first browse page displays matching saved titles while the complete index loads. An empty or exhausted saved selection waits for the remaining index, preserving coverage and avoiding duplicate results.
- Opening playback no longer waits for optional filter metadata. Background catalogue transfers yield between batches while watching or while the app is hidden, retain already downloaded parts, and resume afterward. Foreground catalogue requests can continue for a saved title outside the initial home snapshot.

## Playback

- Playback remains inline by default, including a publisher's request for a custom video view. Flixer's own fullscreen control expands the player.
- Source choices have a separate full-width strip, source count and status. Switching sources scrolls that strip rather than moving the title page. Failed choices remain available for an explicit retry.
- Native bridge errors advance to another source. Document load alone no longer cancels the bounded startup deadline.
- Embedded and native media playback preserve supported source headers. Public-media handoff also retains the WebView's User-Agent and current position.
- Confirmed player preferences remain authoritative. Without one, native playback can prioritize a documented VidFast route before unconfirmed wrappers or a deferred relay lookup.
- The observed VidSrc nested content origin receives progress telemetry without becoming an approved top-level player destination or receiving Capacitor's application bridge.
- Fullscreen saves the previous orientation, uses landscape, hides system bars, and restores the prior orientation on exit or close. The debug audit activity handles rotation like the production activity.

## Backend

FMovies requests now use its current publisher origin and accept saved links from the previous origin. Credentials, unrelated origins and unexpected external redirects remain rejected. A live legacy Dune: Part Two metadata request resolved successfully in approximately one second during the local source check.

Verified movie identities now receive VidSrc, VidFast and VidLink alternatives, as verified TV episodes already did. These retain their own provider names and an `unverified` availability label until actual playback is observed. Unknown films and unlisted episodes do not receive guessed identities. Existing equivalent HDToday routes are deduplicated by URL.

The backend changes were deployed to the existing Netlify API project. Routine catalogue publication still uses runtime snapshots rather than deploying the app for each refresh.

## Automated and interface checks

All **285 Node tests passed**. Both Android build variants compiled successfully. Regressions cover legacy FMovies origins, verified movie alternatives, independent home-row rendering, immediate cached browse results, cancelled navigation, source headers, native failover, watch-position preservation, source preference, and background index interruption and recovery.

On the Android API 35 emulator at a 412 CSS-pixel viewport:

| Workflow | Observation |
|---|---|
| Home after a page reload | Recent title cards available in approximately 503 ms |
| Movies tab | 24 actual linked title cards available in approximately 85 ms |
| Series tab | 24 actual linked title cards available in approximately 94 ms; streaming-service and rating filters present |
| Return to home | Approximately 62 ms; the first recent title identities were preserved |
| Universes | 61 entries; approximately 248 ms to display |
| Alias search | `happy and gay` returned **Happy & Gay** |
| Title details | Approximately 336 ms for the sampled cached title |
| Home collections | Specialist collections, genres, universes and streaming-service rows remained present |
| Layout | No horizontal page overflow in the checked home, browse and search views; the additional 346 CSS-pixel viewport check also had no page or hero-control overflow |

These are individual emulator smoke-test observations with local/catalogue caches, not cold-network benchmarks or guarantees for physical devices. Counts require actual linked title cards and exclude skeleton placeholders; image downloads may finish later. The corrected pre-fix Movies measurement was approximately 10.45 seconds because it waited for the entire index, compared with 85 ms after the change when matching saved titles were available.

After dismissing that system tip, the corrected sustained check passed:

- VidFast's content clock advanced from **107.40 to 165.88 seconds** over approximately **65 seconds**, beyond the startup deadline.
- Explicit fullscreen produced a **2400 × 1080** landscape frame without the Android status bar. Android Back restored the **1080 × 2400** portrait inline page while the content clock continued to approximately **187.43 seconds**.
- Reopening the source resumed from that position and advanced to **191.43 seconds**.
- Close invoked the exit callback and left **zero remote player WebViews**.

The signed release APK is `artifacts/flixer-v1.6.29.apk`, Android version **1.6.29 / 10629**, **18,227,200 bytes**. SHA-256: `e6c28fe2ca9f86052b63ae72a66a14937cbdf9312ef3a22d5e46cf0db83e31bc`. The audit activity and audit HTML are excluded from this release; the separately identified debug package was used for instrumentation.

## Provider coverage and limits

The device audit uses actual production player code with one server per attempt, so a different source cannot silently satisfy that attempt. Positive short-playback evidence requires an advancing visible content clock or native progress with a plausible content duration. Loaded frames, HTTP 200 and a native `playing` flag alone are insufficient.

The original sweep sampled films, series, animation, French and Arabic/Tunisian sources. Its extended TV check confirmed playback through independently named VidSrc and VidFast alternatives. Restrictions, missing owner routes, and timeouts remain distinct outcomes. In particular, the sampled HDToday film's VidFast route returned upstream 404 responses; an Embos TV route returned HTTP 451. Those observations do not establish that every title on those hosts is unavailable.

The majority-of-player-routes target has **not** been established. The accompanying audit reports list tested, confirmed and untested choices rather than marking every returned URL playable. Signed media URLs, cookies and raw publisher documents remain in ignored local QA files.

The selected device sweep finished with **14 advancing-video confirmations from 42 tested choices**, drawn from **84 returned choices across 23 title samples**. The remaining 42 returned choices were not tested in this pass. Dune: Part Two played inline through the newly returned VidSrc and VidFast movie alternatives; the sampled VidLink movie route failed. Original FMovies routes and HDToday film failures remain visible in the [per-route report](ux-inline-provider-audit/provider-playback-audit-2026-10-31.md).
