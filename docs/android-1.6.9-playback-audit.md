# Android 1.6.9 playback audit

The emulator exercised 40 initial server choices across 13 provider families, followed by 15 longer checks on additional titles and all 15 resolved choices for the HDToday film Give Me an A. These are sampled attempts, not exhaustive testing of every catalogue title. Short checks alone cannot establish that a host is permanently unavailable.

Confirmed video-clock advancement included Tunisian YouTube episodes, Kirmalk film/series players, an Egyptian film through its verified AhwakTV alternate, a Korean film through its verified FMovies alternate, and a direct ToonTales cartoon. The HDToday sample film did not reach playback on any of its 15 choices during the test windows; some displayed explicit missing-video errors. Other sampled hosts returned 403, failed to load or remained unconfirmed. Resolving a route is not a playback guarantee.

Fixed a full-stream shortcut that skipped missing HDToday identity enrichment. Verified alternate metadata supplies numeric IDs for 69 of 120 checked cached HDToday titles. The hosted sample now resolves 15 choices instead of none. Forty Egyptian titles were refreshed with 191 resolved server choices; availability remains title-dependent. Scheduled refreshes now continue HDToday identity enrichment without fetching its blocked catalogue.

Refresh servers now performs fresh source lookup instead of simply reopening saved links, including nested Arabic wrappers and specialist page caches. It is offered when the original result contains no servers. Resolver failures are retained alongside working alternatives. Fragment-bearing player URLs match native network errors even when Android omits the fragment.

Known deleted-video and HTTP-200 error pages trigger failover through scripts restricted to approved player origins and messages from the active frame. Embedded preferences require confirmed video-clock advancement. Player-initiated navigation to the app root is guarded before browser navigation and hash routing, preserving normal Back and Home navigation.

Validation: 99 automated tests, 19 app workflow checks with no JavaScript errors, real deleted-Mixdrop-to-direct-video failover, empty-list refresh recovery, and app-root navigation cancellation preserving the current document. A signed Android 1.6.9 (169) APK is built. External verification, unavailable files and server outages are not represented as solved.
