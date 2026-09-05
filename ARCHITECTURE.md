# Architecture

## Platform

MTG Trackers is a standalone Next.js 15 App Router application deployed on Vercel at https://mtgtrackers.com. Upstash Redis (or Vercel KV REST environment names) stores tracker records and analytics; Vercel Blob stores evidence uploads. The parent Golden Chocobo repository remains separate.

The registry in `src/lib/trackers.ts` drives dynamic tracker pages, statistics, report forms, APIs, themes, source links, and affiliate destinations. Live trackers are One Ring (100 slots), Edgar Markov (500), and LOTR Poster Cards (20 cards x 100 = 2,000). Golden Chocobo remains planned.

## Identity And Storage

Each tracker has separate `cardsKey` and `submissionsKey` JSON arrays. Use `getTrackerTotalSlots`, not `tracker.total`, when validating a whole tracker; individual card definitions can have different quantities. A slot's numeric ID is tracker-local; its card slug plus printed serial identifies it within a treatment. Do not reorder launched card definitions without a migration: numeric IDs currently depend on their order.

`src/lib/tracker-data.ts` contains shared formatting, slot lookup, normalization, evidence merging, and read helpers. Client components also import its pure helpers.

`src/lib/tracker-store.ts` owns server-side writes. A Lua snapshot reads both raw arrays atomically, and a compare-and-set script commits both only if neither stored value changed. Conflicts reread current data and retry up to five times, then return a retryable 409. Mutation callbacks are synchronous and must have no external side effects. All report, review, price, image, and grading mutations use this path. Initialization uses SET NX and retains legacy source keys.

Backup export reads a consistent pair. Explicit admin restore validates all slots and replaces the pair with atomic MSET, including when existing data is damaged. Restore intentionally overwrites the target tracker; it does not merge reports received before the restore.

Known identity gap: One Ring is present in both its standalone tracker and LOTR Poster Cards, with independent storage. Unifying those records and deduplicating platform counts is a top priority in TODO.md. Do not silently migrate live data.

## Public And Admin Flows

- `/`, `/trackers`: umbrella directory and recent discoveries.
- `/trackers/[slug]`: serial grid, filters, details, evidence, and marketplace links.
- `/trackers/[slug]/stats`: discovery and market summaries.
- `/trackers/[slug]/submit`: card/serial selection and evidence report.
- `/serialized-mtg-catalog[/slug]`: researched treatments, sources, and tracker requests.
- `/discoveries`, `/discoveries.json`, `/discoveries.xml`: public discovery feeds.
- `/verification-guide`, `/about`, `/contact`, `/privacy`, `/affiliate-disclosure`: trust and contact pages.

Public reports enter a separate pending queue. Admins can approve, reject, request more info, mark duplicate, or mark cannot verify. Approval merges selected evidence, updates the card, records reviewer metadata, and marks merged reports duplicate in one commit. Follow-up/reopening for needs-more-info reports is still pending.

Uploaded JPEG/PNG/WebP evidence (maximum 4 MB per file) is stored in Vercel Blob. Canonical cards preserve evidence source submission IDs, source URLs, and source types. Upload content validation, metadata stripping, and orphan cleanup remain roadmap work.

## Security

Admin routes require a signed, expiring HTTP-only session. Production requires both ADMIN_PASSWORD and ADMIN_SESSION_SECRET; missing configuration disables session creation and verification. Login is rate-limited to ten attempts per IP per fifteen minutes and fails closed if the limiter is unavailable. Public reports and image uploads have separate limits.

JSON endpoints require object bodies. Public reports validate slot bounds, source/evidence URLs, prices, and text lengths before storage. Baseline headers are in next.config.mjs. Do not expose secrets or raw database errors to public clients.

## Affiliates And Measurement

Affiliate builders live in `src/lib/trackers.ts`. TCGplayer uses the user-approved generic partner redirect; eBay uses tracker or default campaign context; Amazon uses the configured Associate tag and relevant product searches. LOTR holiday poster pages target Special Edition collector boosters. Catalog promos without collector-booster distribution use an explicitly generic sealed-product fallback.

`AffiliateOutboundLink` leaves the merchant destination intact and sends best-effort click telemetry separately. Disclosures appear near marketplace links, including at the top of tracker pages. Admin analytics measure clicks and promotion activity, not commissions.

`scripts/validate-affiliate-links.mjs` validates configured, catalog, and boundary-serial URL shapes. Live checks deduplicate destinations, inspect redirects, and distinguish verified, failed, and manual-review outcomes. A 403/429 is not a verified pass. Merchant approval, credited orders, reversals, and payouts require merchant reports.

## Verification

Run focused regression tests, lint, and a production build. For affiliate changes also run link validation; for deployment changes run the public smoke check. Never use real submissions or destructive restores as production test fixtures. See TODO.md for current priorities and README.md for setup, keys, and operational commands.
