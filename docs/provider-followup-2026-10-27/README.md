# Current Arabic, Tunisian and WCO follow-up

The [per-server results](provider-playback-audit-2026-10-27.md) and [JSON record](provider-playback-audit-2026-10-27.json) cover fresh lookups for six Arabic/Tunisian titles and four WCO samples on Android 15. All 40 returned choices received an outcome: seven advancing-video confirmations, eight player errors and 25 without advancing video. This is sample coverage, not every title, season or episode in the catalogue.

- Tuniflix: Doctor Love's YouTube route and The Needle / الإبرة / L'Aiguille's Uqload route played. The two StreamTape routes did not. A production bug returned an obsolete snapshot player during ordinary playback even though a fresh lookup found the current links. Ordinary Tuniflix playback now revalidates through the shared two-minute page cache. Transient failures retain approved cached links with an explicit diagnostic; authoritative removal does not become cached success.
- CimaTN: Hbiba returned no player; its lookup reported HTTP 429. A catalogue entry remains insufficient to claim playback.
- EgyDead: the sampled film returned eleven alternatives and no own-source player. AhwakTV and FrenchStream alternatives played. Those are not EgyDead-source confirmations.
- Cimafu: three of 21 returned choices for the sampled Al Moallem episode played: 1vid, Vidmoly and Vidspeed. Other returned players failed or remained unconfirmed.
- WCO: all four current ordinary-resolution attempts remained unconfirmed. Separate inspection observed HTTP 403 at the public player document. The app now reports that specific denial when observed. Search and matching remain available, independently of playback availability.

The 24 October instrumented WCO successes were not reproduced in the current tests. Current WCO checks do not attach DevTools to publisher WebViews; attaching a debugger may affect timing, but a causal explanation has not been established. Historical successes are not current reliability certification.

The report records the exact debug APK fingerprint per attempt. The final signed release has a separate smoke record. Clock checks alone do not certify the absence of overlays: the signed-app check exposed a promotional Uqload iframe, addressed with a narrowly scoped cosmetic rule and a confirmed popunder-loader request rule. Verification and account notices remain visible. No temporary source URLs, tokens, cookies or source documents are published.

The [signed release smoke check](../release-smoke-2026-10-27.json) verifies the final APK through normal navigation: English alias search, source badges, current Uqload selection, changing film content, inline playback, closing the player and returning to a populated Recently updated row. A final isolated-player retest also confirmed advancing content on the final debug APK.
