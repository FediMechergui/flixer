# Arabic providers for the Flixer APK

Checked 15 October 2026. Implementation: `server/src/arabic-providers.js`.
The APK is the product; hosted APIs and catalogue data support its search,
playback and automatic updates. Dahsha remains separate and documentary-only.

| Provider | Catalogue and episode handling | Playback |
| --- | --- | --- |
| Tuniflix | Tunisian, Arabic and Turkish tag archives, source pagination. Only the main MovieList is imported; sidebar recommendations are excluded. Actual season pages and episode tables supply coordinates. | Source iframe and OptionBx entries identify fixed-origin trembed wrappers. Approved external players include easyvidplayer, strp2p and YouTube. |
| CimaTN | Public Blogger post feeds supply catalogue entries and release-year labels, separately from publication dates. Entries without their own watch-page data are excluded. Exact seriesData.episodes keys and availableEpisodes establish the available episodes; missing numbers are never generated. | Object/array literals are parsed as JSON5 data, never executed. Only advertised, approved YouTube, VK, MediaDelivery and Videas destinations are retained. |
| StreamTunisie | Tunisian categories, actual episode links and irregular URL patterns retained. Film-category entries advertising TV seasons are excluded from films. | Follow the actual film watch link or parse the literal source-player URL. Failed placeholder videos and ads are excluded. A sampled El Khottaifa YouTube episode reached readyState 4. |
| Kirmalk | Egyptian-series episode listings resolve their actual title-specific season category before importing a show. Theatre uses the explicit source category and plays/theatre tags. Main category links and pagination supply actual episodes. | Structured VideoObject/embed metadata supplies approved players such as hdup400. |
| AhwakTV | Arabic-film and Egyptian-series categories. Where no show category exists, exact source episode-title prefixes form a stable search group. Only matching explicit episode links are retained; unknown seasons remain unknown. | Follow fixed-origin see.php?vid and read actual data-embed-url choices, excluding ads. |
| EgyDead | Arabic films and season containers. Episode cards are not imported as separate series. Season details retain only episode URLs belonging to that source title stem. | Submit the ordinary View=1 form and read serversList links, excluding trailers and hidden advertising frames. |
| Cinetimes | Small free Tunisian archive collection, not a large modern-film library. Country comes from the source collection. Silent films are not labelled Arabic-audio films. | Public Wikimedia Commons videos use native direct-file playback, including WebM. |

All seven catalogue origins returned HTTP 200 on the hosted runner with an
explicit Flixer request identity. Tuniflix and Cinetimes refused the earlier
generic request identity. No proxy rotation, browser challenge solving, account,
premium access or DRM bypass is used. Upstream formats and availability can
change; imported records remain cached.

## Metadata and catalogue counts

Posters and actual plot sections come from each source. Existing valid metadata
is retained; empty poster objects do not prevent source artwork filling the gap.
Bilingual aliases survive export and search. Missing source synopses stay missing.

Collection badges report saved titles, not total upstream library sizes. Live
browsing combines relevant providers. Regional historical imports continue
incrementally; the scheduled crawl budget is 180 pages. FMovies sometimes returns
empty, inconsistent filtered pagination for a query variant. Bounded equivalent
requests retry it; still-failing pages retain retry cursors without preventing
other regional partitions from making progress.

Validated player choices can be cached with source episodes. A narrow Arabic
snapshot avoids parsing the whole deployment catalogue for each title request.
Fixed origins, strict paths and approved player hosts apply throughout.

## Sources not integrated

MyCima did not pass filtered-pagination and playback validation. Artify, Shahid
and WATCH IT have account, subscription or regional requirements; their paid
catalogues are not advertised as unrestricted in-app streams. TunisiaTV's sampled
undefined archive links did not expose a usable player. These remain research
candidates, not functioning Flixer adapters.
