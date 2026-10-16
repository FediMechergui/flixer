# Android 1.6.8 catalogue and playback audit

Tested on the Medium Phone Android emulator against the hosted Flixer API, using a separate audit application ID to preserve the installed release's history.

Fixed permanent backend fallback after a failed health check, recent-title ordering after navigation, asynchronous metadata repainting, invalid placeholder artwork, canonical episode aliases, collection filtering, and hosted stream proxy response errors. Compact home snapshots update before the full index. Playback starts from verified quick sources while additional servers load. Native document errors trigger server failover; trusted player compatibility uses a fixed host allowlist.

The emulator retained identical recent-title lists after Movies, Shows and Search navigation, including simulated API network failure. Arabic episode playback and fullscreen worked. Eight regional/content collections, Netflix filtering and the DC universe were exercised. The automated suite passes 97 tests.

External players remain independently operated: the movie audit encountered unavailable streams, a provider 404, and browser verification. An iframe loading is not evidence that video plays. HDToday refresh retains its existing cached catalogue while hosted access is blocked. Historical crawling remains incremental; this release does not claim an exhaustive global catalogue.

Verified source metadata is persisted in the data snapshot, including the missing Happy & Gay synopsis and its alternate FMovies offering. Refresh runs every six hours; snapshot publication preserves the previous download until its replacement is fully uploaded.
