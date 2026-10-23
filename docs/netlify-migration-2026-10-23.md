# Flixer backend migration — 23 October 2026

The mobile API is deployed at https://flixer-api-fedimechergui.netlify.app.
The deployment contains one shared request function and small service/universe
metadata files. It does not host the Flixer app UI or relay video traffic.

Collection remains on GitHub Actions. A successful hosted run published 104,112
canonical titles and 9,200 provider source records into immutable data packs,
without a hosting deployment. Separate source/owner packs preserve Arabic,
French-cartoon and official YouTube adapter metadata. The home endpoint reads
the small bootstrap; provider-specific search skips full catalogue loading.

Live checks returned HTTP 200 for health, provider registration, home, catalogue
manifest, encoded legacy saved-title URLs, FMovies search and stream choices,
Arabic alias search, cached French-cartoon player descriptors and a cached
Tuniflix player link. Observed home requests took 1.46 seconds initially and
0.39 seconds when cached; a 102-episode saved guide took 1.85 seconds. These are
individual network measurements, not latency guarantees or proof that every
upstream video plays. French source pages still returned 403 while their cached
player IDs remained available.

The expanded 92 MB offline index exposed a WebView memory/loading problem on
the constrained emulator. Hosted APK builds now preserve all titles in roughly
1 MB local parts, with four concurrent reads and complete-generation validation.
The existing home revision guards also apply to this bundled index.

Validation: 216 backend/client tests, Android unit tests, release lint and a
signed Android build. The APK uses the existing signing certificate and points
both API and data fallback URLs to Netlify. Older APKs need this update because
their API address is compiled into the application.

Only Vercel project `flixer` was deleted. Comparing the project list before and
after confirmed that all 26 other projects, including Dahsha, remained present.
The obsolete Flixer deploy-hook secret and local project link were removed.
Vercel still reported the team's existing `fluidCpuDuration` fair-use block
after deletion; no reset time was supplied. Migration does not erase historical
team usage or automatically restore those other deployments.
