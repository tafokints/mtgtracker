# MTG Trackers

A Vercel-ready umbrella site for Magic: The Gathering serialized card trackers.

The live trackers are `The One Ring` at `/trackers/one-ring`, `Edgar Markov` at `/trackers/edgar-markov`, and `LOTR Poster Cards` at `/trackers/lotr-poster-cards`. The existing Golden Chocobo tracker stays untouched for now and can be migrated later as `/trackers/golden-chocobo`.

## Routes

- `/` - platform homepage
- `/trackers` - tracker directory
- `/trackers/one-ring` - The One Ring tracker
- `/trackers/one-ring/stats` - The One Ring stats
- `/trackers/one-ring/submit` - public discovery report flow
- `/trackers/edgar-markov` - Edgar Markov tracker
- `/trackers/edgar-markov/stats` - Edgar Markov stats
- `/trackers/edgar-markov/submit` - public discovery report flow
- `/trackers/lotr-poster-cards` - LOTR Poster Cards multi-card tracker
- `/trackers/lotr-poster-cards/stats` - LOTR Poster Cards stats
- `/trackers/lotr-poster-cards/submit` - public discovery report flow
- `/trackers` also includes a serialized scaffold queue sourced from `src/lib/serialized-catalog.ts`
- `/about` - project purpose and independence notes
- `/contact` - correction, tracker request, and issue-reporting paths
- `/privacy` - submission, analytics, and admin review privacy notes
- `/affiliate-disclosure` - marketplace affiliate relationship disclosure
- `/discoveries.json` - JSON Feed 1.1 feed for recent verified discoveries
- `/discoveries.xml` - RSS feed for recent verified discoveries

## Features

- Directory model for multiple serialized-card trackers
- Tracker directory cards include open-tracker, report-a-find, latest-discovery, and marketplace paths to move visitors into useful tracker actions quickly
- Cross-tracker recent discovery feed on the homepage with exact serial detail links
- Public JSON and RSS discovery feeds for community bots, readers, and sharing workflows
- Stats-page recent discovery links that jump to the exact serial detail view
- Structured data for live tracker pages and the tracker directory
- Breadcrumb structured data for core public pages, tracker pages, stats pages, and submit pages
- Multi-card tracker definitions for serialized treatments with many card names
- Public tracker grid for serials `001/100` through `100/100`
- Progress, result-count and quality summaries with view-specific pending reports, shareable search/filter/sort views, active filter chips, located/confirmed/source-linked/evidence/source-type filters, evidence-count sorting, and market/date sorting
- Tracker cards highlight saved evidence image counts for proof-backed discoveries
- Stats-page source-quality breakdowns for confirmed, source-linked, and unverified discoveries
- Stats-page source-type breakdowns for marketplace, grading, social, article, private-sale, and other discovery signals
- Stats-page pricing coverage that distinguishes priced copies from discoveries without public sale data
- Shareable serial detail links through `serial`, `card`, or exact `slot` URL parameters, with one-click copy from the detail modal
- Copy-ready share text for located serial discoveries, including verification, source, price, and exact tracker link when available
- One-click native, X, and Reddit share actions for located serial detail modals
- Serial-aware Open Graph and Twitter metadata for exact serial detail URLs
- Shareable tracker view links through `q`, `filter`, `sort`, and `cardFilter` URL parameters, with one-click copy from tracker headers
- Card-level public filtering for multi-card serialized treatments
- Card activity summaries for multi-card tracker pages
- Public report flow with source type, evidence level, price, image uploads, image URLs, and notes
- Report form evidence image count guardrails and removal controls before submission
- Serial detail report links preselect the matching card and serial in the report form
- Unlocated tracker cards include serial-specific report links that preselect the matching report form fields
- Report forms confirm the currently selected card and serial when a report link preselects or changes them
- Serial detail pages show public verification signals, approved evidence image thumbnails, and provenance links when available
- Admin review queue before crowd-sourced discoveries become public tracker updates
- Admin promotion candidates for approved high-signal discoveries with copy-ready posts and share links
- Card-level admin review filtering for multi-card serialized treatments
- Hidden admin panel with price, image, grading, and price-history updates
- Curated serialized MTG catalog for future tracker scaffolding
- Upstash Redis storage for Vercel deployment

## Local Setup

```bash
cd mtg-serial-tracker
npm install
copy .env.example .env.local
npm run dev
```

Set these env vars in `.env.local` and in Vercel. Either Redis naming pair works:

```bash
# Upstash names
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Vercel Redis/KV integration names
KV_REST_API_URL=...
KV_REST_API_TOKEN=...

ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=...
BLOB_READ_WRITE_TOKEN=...
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=...
```

For local development only, the admin password falls back to `dev-admin` if `ADMIN_PASSWORD` is not set.

## Deploying On Vercel

1. Import the repository in Vercel.
2. Set the project root to `mtg-serial-tracker`.
3. Add an Upstash Redis database.
4. Add Redis REST env vars. Vercel may provide `KV_REST_API_URL` and `KV_REST_API_TOKEN`; those are supported. Manual Upstash envs can use `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
5. Add a Vercel Blob store and connect it to the project. Vercel should provide `BLOB_READ_WRITE_TOKEN`.
6. Add `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` after creating the property in Google Search Console.
7. Deploy.

The first `/api/trackers/[slug]/cards` request initializes Redis for that tracker. One Ring creates 100 serial slots, Edgar Markov creates 500 serial slots, and LOTR Poster Cards creates 2,000 card-plus-serial slots. Public reports are stored in each tracker's configured submissions key until approved.

The `/trackers` directory uses read-only stats snapshots so new multi-card trackers are not initialized just because someone browses the directory.

## Redis Keys And Backups

Each live tracker owns two Redis JSON values defined in `src/lib/trackers.ts`:

- `tracker.storage.cardsKey` stores the public serial card records.
- `tracker.storage.submissionsKey` stores public discovery reports and admin review history.

Current live keys:

- `one_ring_cards`
- `one_ring_submissions`
- `edgar_markov_cards`
- `edgar_markov_submissions`
- `lotr_poster_cards`
- `lotr_poster_submissions`

Legacy keys are read once during card initialization, migrated into the configured `cardsKey`, then deleted. Rate-limit keys use the `rate-limit:{trackerSlug}:submit:{clientIp}` and `rate-limit:{trackerSlug}:upload:{clientIp}` patterns and are not included in tracker backups.

Affiliate click telemetry is stored separately from tracker backups:

- Shared outbound affiliate links track normal clicks and middle-click new-tab clicks.
- `affiliate:clicks:{yyyy-mm-dd}:{trackerSlug}:{merchant}:{placement}` counts daily outbound clicks.
- `affiliate:clicks:total:{trackerSlug}:{merchant}:{placement}` counts all-time outbound clicks.
- `affiliate:context:{yyyy-mm-dd}:{trackerSlug}:{field}:{value}` counts daily outbound clicks by shareable tracker view context for `filter`, `sort`, `cardFilter`, detail `card`, and `serial`.
- `affiliate:context:total:{trackerSlug}:{field}:{value}` counts all-time outbound clicks by shareable tracker view context.
- `affiliate:last-click:{trackerSlug}:{merchant}:{placement}` stores the latest click metadata, including source page path and shareable tracker view context when available, for quick inspection.
- `GET /api/admin/affiliate-stats` summarizes the tracked click keys for authenticated admins, including tracker, merchant, intent, placement, per-click view-context rollups, detail-card and serial rollups, and last-click view-context hints. Internal last-click source paths are linked from the admin table for quick review.
- Admin affiliate stats show the actual last-click destination, including dynamic exact-serial marketplace searches.
- Admin affiliate stats include quick-read insights for the top CTA, best placement, stale high-lifetime placements, and latest click source.
- Admin affiliate stats include promotion funnel insights for best-performing promoted trackers, promoted-visit gaps, and distribution gaps.
- Admin affiliate stats can be exported as CSV for placement, destination, last-click context, and promotion-source efficiency analysis.
- Affiliate links include an intent label: `singles`, `auction-comps`, `sealed-product`, or `marketplace`.
- Admin promotion share actions are tracked separately as `promotion:actions:{yyyy-mm-dd}:{trackerSlug}:{action}`, `promotion:actions:total:{trackerSlug}:{action}`, and `promotion:last-action:{trackerSlug}:{action}` so review-to-promotion activity can be compared with affiliate clicks.
- Admin promotion share URLs append `utm_source`, `utm_medium=social`, `utm_campaign=discovery_promotion`, and `utm_content` so promoted discoveries can be separated by copy, X, Reddit, tracker, card, and serial in analytics.
- Promoted discovery page visits are tracked separately as `promotion:visits:{yyyy-mm-dd}:{trackerSlug}:{source}`, `promotion:visits:total:{trackerSlug}:{source}`, and `promotion:last-visit:{trackerSlug}:{source}` when the URL includes `utm_campaign=discovery_promotion`.
- Affiliate clicks from promoted URLs increment `affiliate:promotion-source:{yyyy-mm-dd}:{source}` and `affiliate:promotion-source:total:{source}` so X, Reddit, and copied posts can be compared as monetization channels.
- Tracker directory CTA clicks are tracked separately as `directory:clicks:{yyyy-mm-dd}:{trackerSlug}:{action}`, `directory:clicks:total:{trackerSlug}:{action}`, and `directory:last-click:{trackerSlug}:{action}` for `open-tracker`, `report-find`, and `latest-discovery` actions.
- Admin promotion efficiency compares promotion actions and promoted visits with affiliate clicks by tracker and source so promoted discoveries can be judged against monetizable traffic.

Admin backups are tracker-scoped:

- `GET /api/trackers/[slug]/export` downloads a JSON backup with `schemaVersion`, tracker metadata, counts, cards, and submissions.
- `POST /api/trackers/[slug]/import` restores one exported backup for the same tracker slug.
- Restore requests must include `confirm: "RESTORE_TRACKER_BACKUP"` and overwrite only that tracker's `cardsKey` and `submissionsKey`.
- The hidden admin panel includes `Export Backup` and `Restore Backup` controls after login.

## Admin And Review Workflows

- Report form: use the `Report a Find` link on any live tracker page to send a discovery into admin review.
- Evidence level: public reports can request `Looks Confirmed` only when they include a source link or evidence image.
- Evidence uploads: report forms accept JPEG, PNG, or WebP uploads up to 4 MB per image. Uploaded images are stored in Vercel Blob and saved as evidence image URLs on the queued report.
- Admin panel: press `Ctrl + Alt + A` on `/trackers/one-ring`.
- Review queue: use the admin panel `Review` tab to approve or reject pending reports.
- Pending reports show evidence-strength summaries and are prioritized by review signal count.
- Affiliate stats: use the admin panel `Affiliate` tab to compare tracker, merchant, and placement click totals, review quick-read performance insights, then export CSV for outside analysis.
- Promotion stats: use the admin panel `Affiliate` tab to compare copy, X, and Reddit promotion actions after approved discoveries are prepared for posting.
- Promotion links: use the admin panel `Review` tab's promotion candidates so copied posts and X/Reddit shares include campaign-tagged tracker URLs.
- Promotion efficiency: use the admin panel `Affiliate` tab to compare promotion actions, promoted page visits, and downstream affiliate clicks by tracker and source.
- Promotion CSV: use the admin panel `Affiliate` tab export to analyze X, Reddit, and copied-post efficiency outside the admin panel.
- Promotion funnel insights: use the admin panel `Affiliate` tab to quickly spot which promoted trackers are turning visits into affiliate clicks and which need better CTAs or posting links; weak-source cards include a recommended next action.
- Promote next: use the admin panel `Review` tab's promotion candidates to see the strongest approved discovery and the currently recommended source/channel.
- Growth recommendations: use the admin panel `Affiliate` tab to turn directory CTA, promotion, and affiliate-click signals into prioritized tracker actions.
- Directory CTAs: use the admin panel `Affiliate` tab to compare which tracker directory actions are pushing visitors into tracker pages, report forms, and latest-discovery detail views.
- Directory marketplace links are tracked as `tracker-directory`.
- Primary marketplace CTAs: tracker pages include top-of-page marketplace actions tracked as `tracker-top-cta`, plus contextual filtered-view actions tracked as `tracker-filtered-cta` with the active view summarized near the links.
- Serial card grid eBay searches are tracked as `tracker-card-serial`.
- Serial detail marketplace links are tracked as `serial-detail`.
- Serial detail eBay links use exact card-and-serial search queries while preserving the tracker campaign `customid`.

## Tracker Scaffolding

List serialized catalog entries:

```bash
npm run catalog:list
```

Generate a reviewable single-card tracker config snippet:

```bash
npm run tracker:scaffold -- innistrad-remastered-edgar-markov --tracker-slug edgar-markov
```

The scaffold command reads `src/lib/serialized-catalog.ts`, blocks multi-card treatments that need card-plus-serial support, emits the catalog back-reference, uses the current affiliate URL builders, and tries to fetch direct Scryfall card images when available.

## Promotion Checks

Before promoting the site, run:

```bash
npm run lint
npm run build
npm run links:validate
npm run smoke
```

Also verify:

- `/api/health` returns `ok: true` in production.
- `https://mtgtrackers.com/robots.txt` advertises `https://mtgtrackers.com/sitemap.xml`.
- `npm run smoke` verifies public trust pages, sitemap coverage, and breadcrumb structured data.
- Live tracker pages load on `https://mtgtrackers.com`.
- Live tracker submit pages load and show the public discovery report form.
- Marketplace links are relevant to the tracker subject.
- Affiliate disclosures are visible near marketplace links.
- TCGplayer links use the generic `partner.tcgplayer.com/DyJ25G` redirect and validate that the final URL receives `irclickid` and Impact parameters.
- eBay affiliate links use campaign `5339113954` and a `customid` matching the tracker slug.
- Amazon affiliate links use Associate tag `meleeitonme0a-20`.
- `/about`, `/contact`, `/privacy`, and `/affiliate-disclosure` load in production.
- Google Search Console ownership is verified and `https://mtgtrackers.com/sitemap.xml` is submitted.

`npm run smoke` defaults to `https://mtgtrackers.com`. To check another deployment, run `npm run smoke -- https://your-preview-url.vercel.app` or set `SMOKE_BASE_URL`. For local production-build smoke checks without Redis health, set `SMOKE_SKIP_HEALTH=1` and `SMOKE_CANONICAL_BASE_URL=https://mtgtrackers.com`.

## References

- Scryfall reference printing: https://scryfall.com/card/ltr/748z/the-one-ring
- Wizards product context: https://magic.wizards.com/en/products/the-lord-of-the-rings-tales-of-middle-earth

## Agent Guidance

- `CLAUDE.md` - Claude Code project instructions
- `AGENTS.md` - Codex and general AI coding-agent instructions
- `.codex/skills/mtg-trackers/SKILL.md` - reusable MTG Trackers development workflow
- `docs/SERIALIZED_MTG_CATALOG.md` - researched serialized-card scaffold catalog
