# Continue Watching across player changes

Embedded WebView players previously reported that playback had started but never supplied content progress to Continue Watching. Replacement servers also reused the page's initial resume position, and closing the player could discard the final part of a five-second save interval. Returning to an unchanged home tab reused its old Continue Watching row.

The Android player now forwards visible HTML5 content progress through a session-specific listener and seeks eligible videos to the app's resume position. Advertising and hidden videos are excluded. The active episode keeps its latest content position through automatic failover, source discovery and manual switching. Old player sessions cannot overwrite its replacement. Closing, pausing and backgrounding flush the latest observed position; native direct playback also saves the final returned position.

Progress follows explicit episode-provider aliases when the primary episode ID changes. Equal episode numbering does not merge unrelated editions. New records retain the season and episode label. Returning to a cached home refreshes Continue Watching independently of the other rows when the catalogue revision is unchanged. Live catalogue updates can still replace catalogue rows.

## Verification

- 265 Node regression tests pass, including failed startup, direct-to-embedded switching, stale-session isolation, final-position persistence, explicit aliases, independent editions, rewind, background/pause flush and cached-home refresh.
- Android unit checks, release lint and debug/release builds pass.
- Android 15 emulator controls used a synthetic series at season 2, episode 2. The first source was deliberately unavailable. A public HLS sample played on the second source, saved progress, returned to the correct Continue Watching card, and reopened with the saved position.
- A separate fixture repeated that flow through Tuniflix's public Uqload file player with media handoff disabled, exercising the new embedded-progress bridge. Both first and resumed attempts failed over from the unavailable first source. The second request resumed from the newly saved position, and its advancing content clock was persisted to the same episode.

The [machine-readable evidence](continue-watching-verification-2026-10-27.json) records player requests and saved positions without source URLs. Fixture media tests verify persistence plumbing; they do not claim that those sample films belong to the synthetic series, or validate every upstream provider. Third-party players must expose an observable content video for timestamp tracking. Telemetry can lag the content clock by approximately two seconds between updates.

The signed 1.6.27 APK was installed as an update and exercised through normal alias search and playback. After watching The Needle in Uqload, its title page displayed Resume and the home page displayed the film in Continue Watching with saved progress. Existing device storage was retained.
