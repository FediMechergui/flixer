# Provider delivery audit ? 3 November 2026

The initial bounded pass covered **all 25 catalogue providers**, **40 title samples** and **123 returned routes**. This is a representative provider/type check, not every catalogue item or episode. Every returned route for those samples was inspected. Requests came from the local Node environment; hosted and device access can differ.

Four initial routes returned recognized media bytes: Aloula (MPEG-TS), MegaCartoons and ToonTales (MP4), and Cinetimes (WebM). This confirms delivery, **not decoding or advancing playback**. Seventy-five responses were only JavaScript player documents; 16 showed missing files, nine required browser verification and six denied access. The remainder were timeouts, other errors, deferred device resolvers or YouTube players. Targeted follow-ups below supersede individual initial results.

## Per-provider results

| Provider | Samples | Returned routes in initial pass | Finding |
| --- | ---: | ---: | --- |
| myflixer | 2 | 13 | One source shell HTTP 502; direct HLS timed out. |
| fmovies | 2 | 6 | Five JS shells; one Embos route HTTP 451. Generated routes remain availability-unverified. |
| hdtoday | 2 | 15 | 13 JS shells; one timeout; one DNS resolution error. These are documented provider routes, not availability proof. |
| aloula | 1 | 1 | Actual MPEG-TS segment bytes received from the public guest HLS route. |
| cimafu | 2 | 43 | 43 routes: missing files, verification challenges and JS shells. No decoded video check. |
| streamtunisie | 2 | 2 | Both sampled sources currently advertise YouTube players. |
| kirmalk | 2 | 0 | Initial source-origin failure; verified domain/HD-VK fix and follow-up below. |
| ahwaktv | 2 | 0 | Both captured IDs exceeded five upstream redirects; listing still works. |
| egydead | 2 | 1 | Film returns a player shell; sampled series episode has no extracted servers. |
| tuniflix | 2 | 3 | Film Uqload shell; Streamtape-family host timed out. Series advertises YouTube. |
| cinetimes | 1 | 1 | Actual WebM bytes received from the exact Commons file linked by the source. |
| cimatn | 2 | 3 | Series returns VK, YouTube and Dailymotion; Dailymotion HTTP 403. Sampled film has no current server entries. |
| frenchstream | 2 | 8 | Five tracker routes HTTP 403; three other JS player shells. |
| dessinanime | 2 | 0 | Initial full-detail attempt hit HTTP 403. Six cached player IDs independently delivered media; see below. |
| frembed | 2 | 5 | Le Petit Prince Voe deleted, Dood verification. Avatar Uqload explicitly deleted; corrected diagnostic confirmed this on retest. |
| dessinanimenet | 1 | 2 | HLS master/rendition HTTP 200 but actual segment HTTP 404; iframe shell loads. |
| onepace | 1 | 0 | Source lists are reachable, but current files limit embedding to onepace.net; adapter excludes these. |
| youtubeoriginals | 1 | 1 | Official channel episode needs an on-device YouTube test. |
| wco | 1 | 1 | Device resolver descriptor; Node HTTP cannot certify native WCO playback. |
| animegg | 1 | 1 | Episode player shell loads; needs device test. |
| megacartoons | 1 | 1 | Actual MP4 bytes received. |
| toontales | 1 | 1 | Actual MP4 bytes received. |
| myasiantv | 2 | 1 | Both series and film player shells load after correcting audit to follow the film offering ID. |
| multimovies | 2 | 12 | 12 source player shells; no decoded video confirmation. |
| yoturkish | 1 | 2 | Two source player shells; no decoded video confirmation. |

## Repairs and targeted follow-ups

- **Kirmalk:** the previously verified `.art` source now issues an HTTP 301 to `kirmalk.blog`. Film and series pages preserved the title through their ID redirects. The adapter now follows only this explicitly verified move and retains saved `.com` and `.art` identities. The movie publishes `ss.hd-vk.com` with an exact `/embed-<id>.html` player path; this previously omitted host is now accepted for Kirmalk only. Its player document returned HTTP 200, and the series returned its OK.ru player. Later source requests also timed out, so availability remains intermittent. The 21 Arabic adapter tests passed.
- **MyAsianTV:** the initial audit incorrectly passed the film display ID into its resolver. The film offering points to a separate watch page. Correcting the audit produced the actual Zumivids film player; no app change was needed for this case.
- **Frembed:** a targeted retest after the deleted-file diagnostic fix correctly classifies the Avatar Uqload response as missing video despite HTTP 200. Le Petit Prince Voe still returns HTTP 404 and Dood still requires browser verification.
- **One Pace:** the sampled Pixeldrain records have `embed_domains: ["onepace.net"]`. Those source restrictions remain respected; this was not a file-name parser failure.

## DessinAnime delivery evidence

A separate source investigation used the exact cached source player identities and the ordinary public stream API. Les Simpson S1E1, Bluey S1E4, Avatar S1E1, Miraculous S0E1 and the sampled Aang film returned HTTP 206 MP4 responses with recognized `ftyp` headers. Fullmetal Alchemist: Brotherhood S1E1 returned an HLS master, variant and an actual MPEG-TS segment. Each media probe read 4,096 bytes. These six delivery results are separate from the initial 123-route pass.

Episode-page HTTP 403 responses still limit discovery of additional player IDs. The native transport and player-host fixes address playback of known IDs; they do not create unknown episode links. This audit does not claim that every episode or alternate server works. Sanitized source evidence is in `artifacts/dessin-2026-11-03/cc-media-verified.json`.

## Reproduction and native hand-off

Run `node scripts/audit-provider-delivery.js --out artifacts/provider-delivery-2026-11-03`. Use `--provider kirmalk,myasiantv` for a bounded subset. Reports retain status, host, timing and media signatures; temporary media URLs and response bodies are excluded. The HLS check follows one rendition and its first segment only.

The current native matrix at `artifacts/player-repair-2026-11-03/providers/resolved.private.json` contains 12 freshly resolved cases across ten providers, including the four delivered-media routes, Tuniflix Uqload, CimaTN, FMovies, HDToday, WCO and Kirmalk. It is a test input, not a successful-playback result. Native outcomes belong in the Android audit report.
