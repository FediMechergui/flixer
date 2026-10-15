# Arabic catalogue research

Checked 15 October 2026. These are research candidates, not integrated adapters.
FMHY discovery: https://fmhy.net/non-english#streaming-البث

| Source | Observed coverage | Access/playback findings | Decision |
| --- | --- | --- | --- |
| Kirmalk (`kirmalk.com`) | Egyptian series category advertises 222 pages; Maghreb series 74 pages; theatre category 2 pages. These are source pages containing episodes/recordings, not counts of unique shows. | Public listings and a sampled play detail return 200. `watch.php?vid={id}` and structured-data `embedUrl` expose the advertised player; sampled theatre player was `s1.hdup400.com/embed-*.html`. Actual video start still needs verification. The Maghreb category contains at least one title that does not establish Tunisian origin. | Priority candidate for Egyptian drama and plays; preserve exact source IDs and verify country separately. |
| AhwakTV (`yam.ahwaktv.net`) | Arabic films category advertises 51 pages, alongside explicit Egyptian and Arabic series categories and year-specific film categories. | Public catalogue and a sampled `watch.php?vid={id}` film page return 200. Player and complete pagination validation are pending. | Broad film candidate to compare against Kirmalk and EgyDead. |
| EgyDead (`tv10.egydead.live`) | Dedicated Arabic film category, `/series-category/arabic-series/`, `/show/` for performances, and Egyptian-dubbed cartoons. Detail metadata includes actual country and year. | Ordinary HTTP 200. A sampled film uses a normal POST form with `View=1`; browser submission reveals selectable `data-link` servers on hgcloud.to, morencius.com, mixdrop.top and playmogo.com. Trailer and hidden ad frames must be excluded. Catalogue/category completeness and actual video start still need verification. | Strong broad Arabic candidate; do not infer Egyptian origin solely from Arabic language. |
| MyCima (`mycima.gdn`) | Arabic film and series category links, alongside international categories. | Public pages return 200, but category pages need comparison against the home grid: the displayed page title is generic. Pagination links alone do not prove a complete filtered library. | Secondary candidate, pending pagination and player validation. |
| StreamTunisie (`streamtunisie.net`) | `/series-category/tunisian/` has source pagination; explicit series pages and actual episode links. Sample El Khottaifa shows 22 listed episodes, including irregular URL patterns. | First episode's embedded YouTube video reached readyState 4 in a browser. The same page also has a failed direct video element (error 4): selecting the first video blindly would break playback. Never generate episode URLs from the count: links include both `episode-01` and `3-episode` forms. Historical breadth still needs validation. | Promising Tunisian supplement with one actual playback check passed. |
| TunisiaTV (`www.tunisiatv.tn/ar/series`) | Official Tunisian archive lists classics including Choufli Hal and other drama, plus some films. | Archive returned 200. Several advertised detail links literally end in `/undefined`; a sampled link displayed no episode player. Those links cannot be treated as playable. | Official archive candidate; resolve actual episode access first. |
| Artify (`artify.tn`) | Specializes in Tunisian cinema; public catalogue exists. | Has official login and subscription/rental flows. No authenticated or paid playback was accessed. | Catalogue/source links where supported; no promise of unrestricted embedded playback. |
| Shahid / WATCH IT | Broad official Arabic and Egyptian catalogues. | Account, subscription and regional availability vary. | Potential official catalogue links/integration; not a replacement for verified public player adapters. |
| TopCinema (`web.topcinema.io`) | Current menu emphasizes foreign/Asian/anime content. | Public home page returned 200, but inspected menu had no Arabic film/series section. | Not a priority for this expansion. |

No source has been established as the largest: independently verified title
counts and complete pagination are still required. A new adapter must validate
ordinary access from the deployment host as well as locally, actual episode
coordinates, selectable working players, artwork, recent releases, Unicode
search and conservative matching before inclusion. Plays need an explicit
theatre classification, not an invented TV season. Tunisian origin, Tunisian
dubbing and general Arabic language must remain separate evidence.
