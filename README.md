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

## Features

- Directory model for multiple serialized-card trackers
- Cross-tracker recent discovery feed on the homepage
- Structured data for live tracker pages and the tracker directory
- Multi-card tracker definitions for serialized treatments with many card names
- Public tracker grid for serials `001/100` through `100/100`
- Progress, search, located/confirmed/source-linked filters, and sorting
- Card-level public filtering for multi-card serialized treatments
- Card activity summaries for multi-card tracker pages
- Public report flow with source type, evidence level, price, image uploads, image URLs, and notes
- Admin review queue before crowd-sourced discoveries become public tracker updates
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

- `affiliate:clicks:{yyyy-mm-dd}:{trackerSlug}:{merchant}:{placement}` counts daily outbound clicks.
- `affiliate:clicks:total:{trackerSlug}:{merchant}:{placement}` counts all-time outbound clicks.
- `affiliate:last-click:{trackerSlug}:{merchant}:{placement}` stores the latest click metadata, including source page path when available, for quick inspection.
- `GET /api/admin/affiliate-stats` summarizes the tracked click keys for authenticated admins, including tracker, merchant, intent, and placement rollups.
- Affiliate links include an intent label: `singles`, `auction-comps`, `sealed-product`, or `marketplace`.

Admin backups are tracker-scoped:

- `GET /api/trackers/[slug]/export` downloads a JSON backup with `schemaVersion`, tracker metadata, counts, cards, and submissions.
- `POST /api/trackers/[slug]/import` restores one exported backup for the same tracker slug.
- Restore requests must include `confirm: "RESTORE_TRACKER_BACKUP"` and overwrite only that tracker's `cardsKey` and `submissionsKey`.
- The hidden admin panel includes `Export Backup` and `Restore Backup` controls after login.

## Admin And Review Workflows

- Report form: use the `Report a Find` link on any live tracker page to send a discovery into admin review.
- Evidence uploads: report forms accept JPEG, PNG, or WebP uploads up to 4 MB per image. Uploaded images are stored in Vercel Blob and saved as evidence image URLs on the queued report.
- Admin panel: press `Ctrl + Alt + A` on `/trackers/one-ring`.
- Review queue: use the admin panel `Review` tab to approve or reject pending reports.
- Affiliate stats: use the admin panel `Affiliate` tab to compare tracker, merchant, and placement click totals.
- Directory marketplace links are tracked as `tracker-directory`.
- Primary marketplace CTAs: tracker pages include top-of-page marketplace actions tracked as `tracker-top-cta`, with tracker-specific copy when configured.

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
