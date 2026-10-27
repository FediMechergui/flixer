# Provider badges and WCO search — 24 October 2026

Catalogue cards, resume cards and search results display a compact provider badge. A single source uses its name; several distinct catalogue sources use **Various providers**. Duplicate servers, sub/dub choices from one source and TVmaze streaming-service metadata do not add providers. The accessible label includes the source names.

The Android 15 emulator's live search for **Gravity Falls** displayed one result with MyFlixer, FrenchStream and WCO. The detail page offered WCO as a separate version, and opening it loaded its own episode guide. This UI observation used debug APK 1.6.26, SHA-256 `0c2af86d800792992acb356f9564de5524690c132dc228b7ec9a2a301266c37f`; the later episode-alias correction is validated separately below. No stream or page-load status is treated as playback proof.

WCO's public search returned unrelated titles containing only one query word. The device adapter now requires all query words, preserves explicit edition labels, and retries known alternate titles serially after an empty result. Other providers still search concurrently. Cancelled results cannot replace the current query. A unique matching name or alias can group yearless WCO results under a shared search card; the original source IDs and episode numbering remain independent. Conflicting years or external IDs stay separate.

The live details check also captured a previously cached Gravity Falls list containing 80 entries for 40 episodes: FrenchStream IDs and their explicitly aliased MyFlixer IDs appeared twice. The corrected client merge reduces that captured list to 40 entries and retains every original route ID, including FMovies offerings. Existing episode IDs remain stable when a refreshed list changes its preferred provider. Equal season/episode numbers without explicit aliases do not establish equivalence.

The final 24 October debug build, SHA-256 `e1cba7e8a69c8d3b06e0ff79c67dbe0d4f79e4f7eb5124f2c4adfe55ecd609b9`, was also checked on a fresh Android 15 emulator. Live search again showed one Gravity Falls result with the same three providers. After opening and refreshing its details, the saved record contained 40 episodes and 40 distinct numbered slots. A first-boot Android Messages dialog was cleared before player-route tests began; it is not counted as a source failure.

Regression checks cover native WCO search, progressive provider responses, grouped detail-version links, conflicting remakes, query alias retries, partial-word exclusions, episode-route preservation and cached episode deduplication. The Android build passes unit checks and release lint. Player results are recorded separately in the [original 336-choice audit](provider-playback-audit-2026-10-24.md) and the [provider-family follow-up](provider-followup-2026-10-24/provider-playback-audit-2026-10-24.md).

## 27 October release check

Live provider responses now also pass a final title/known-alias query check, preventing unrelated popular results from appearing for a query such as needle. The signed release displayed The Needle's Arabic name and provider badge when searched by its English alias. The [current playback follow-up](provider-followup-2026-10-27/README.md) records the remaining Arabic/Tunisian and WCO failures. Grouping a WCO source under a matching title does not imply its player is currently available.
