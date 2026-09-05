# Architecture

## Platform

MTG Trackers is a standalone Next.js 15 App Router application deployed on Vercel at https://mtgtrackers.com. Upstash Redis (or Vercel KV REST environment names) stores tracker records and analytics; Vercel Blob stores evidence uploads. The parent Golden Chocobo repository remains separate.

The registry in `src/lib/trackers.ts` drives dynamic tracker pages, statistics, report forms, APIs, themes, source links, and affiliate destinations. The `trackers` array is the featured list: One Ring (100 slots), Edgar Markov (500), LOTR Poster Cards (20 cards x 100 = 2,000), and planned Golden Chocobo. `allTrackers` adds 268 generated single-printing trackers. Look up any route through `getTracker`, not the featured array.

`src/data/serialized-printings.json` is the reviewed Scryfall snapshot. `catalog:sync` fetches all serialized printings and fails on an unknown treatment instead of guessing quantities. `serialized-printings.ts` supplies release grouping, per-variant totals, language, and source metadata. Reporting opens for released English printings except the deferred Golden Chocobo migration. Announced and non-English printings have reference pages, not active report forms. Existing poster and Edgar records are reused, not regenerated.

## Identity And Storage

Each tracker has separate `cardsKey` and `submissionsKey` JSON arrays. Use `getTrackerTotalSlots`, not `tracker.total`, when validating a whole tracker; individual card definitions can have different quantities. A slot's numeric ID is tracker-local; its card slug plus printed serial identifies it within a treatment. Do not reorder launched card definitions without a migration: numeric IDs currently depend on their order.

`src/lib/tracker-data.ts` contains shared formatting, slot lookup, normalization, evidence merging, and read helpers. Client components also import its pure helpers.

`src/lib/tracker-store.ts` owns server-side writes. A Lua snapshot reads both raw arrays atomically, and a compare-and-set script commits both only if neither stored value changed. Conflicts reread current data and retry up to five times, then return a retryable 409. Mutation callbacks are synchronous and must have no external side effects. All report, review, price, image, and grading mutations use this path. Initialization uses SET NX and retains legacy source keys.

Backup export reads a consistent pair. Explicit admin restore validates all slots and replaces the pair with atomic MSET, including when existing data is damaged. Restore intentionally overwrites the target tracker; it does not merge reports received before the restore.

Generated printing keys use `printing:{scryfallId}:cards` and `printing:{scryfallId}:submissions`. A single printing has at most 513 slots; large sets are not stored as one giant array. Generated mutations/restores also atomically SADD their slug to `mtgtrackers:active-printing-trackers`. Public discovery feeds read featured trackers plus that index, avoiding hundreds of empty reads. Backups validate numeric IDs, slot identity, nested evidence/prices/grading, and unique submission IDs before replacement. Generated restore rebuilds its own index membership.

Known identity gap: One Ring is present in both its standalone tracker and LOTR Poster Cards, with independent storage. Unifying those records and deduplicating platform counts is a top priority in TODO.md. Do not silently migrate live data.

## Public And Admin Flows

- `/`, `/trackers`: umbrella directory and recent discoveries.
- `/trackers/[slug]`: serial grid, filters, details, evidence, and marketplace links.
- `/trackers/[slug]/stats`: discovery and market summaries.
- `/trackers/[slug]/submit`: card/serial selection and evidence report.
- `/sets[/set]`: release-group directory and searchable printing lists, English by default.
- `/serialized-mtg-catalog[/slug]`: researched treatments and sources.
- `/serialized-mtg-catalog/[slug]/[card]`: exact printing references, language, total, release, relevant affiliates, and links into tracker/report flows.
- `/discoveries`, `/discoveries.json`, `/discoveries.xml`: public discovery feeds.
- `/verification-guide`, `/about`, `/contact`, `/privacy`, `/affiliate-disclosure`: trust and contact pages.

Public reports enter a separate pending queue. Admins can approve, reject, request more info, mark duplicate, or mark cannot verify. Approval merges selected evidence, updates the card, records reviewer metadata, and marks merged reports duplicate in one commit. Follow-up/reopening for needs-more-info reports is still pending.

Uploaded JPEG/PNG/WebP evidence (maximum 4 MB per file, 25 million decoded pixels) is decoded, oriented, resized to at most 3,000 pixels per side, and re-encoded as WebP without private metadata. Malformed, mismatched, animated, or oversized inputs are rejected before Blob storage. Multipart stream bytes are bounded even without Content-Length. Uploads have a cross-tracker 10/IP/hour limit and 500/site/day budget. Files receive UUID paths, not user filenames.

Evidence now enters a private Blob store. `submission-session` validates Turnstile and explicit submission permission, then issues a domain-separated HMAC token bound to one tracker, slot, report UUID, and one-hour expiry. Eight upload attempts are allowed per session. Public submit derives the report ID from that token, checks attachment ownership, and deduplicates retries in the existing atomic tracker commit. Client-supplied safety results and external image URLs are never trusted.

Each immutable image has an `evidence:v1:{uuid}` Redis record containing its report/slot identity, deterministic private pathname, SHA-256, dimensions, timestamps, and safety result. Register metadata before storage so interrupted uploads remain reconcilable. Cloudmersive scans the sanitized WebP; Azure screens a PNG derivative. Clean/flagged results are terminal, pending/error checks can be retried through an authenticated, rate-limited endpoint. Missing services fail closed. Scans are currently bounded synchronous work, not a durable background job queue.

`GET /api/evidence/[id]` verifies the stored bytes/hash and serves only clean evidence. Admins may read clean private evidence; anonymous readers additionally need an approved (or explicitly merged) report and a found canonical card referencing the same report/asset. Responses are no-store; there is no public Blob copy. Removing canonical references or reverting report approval stops subsequent app reads, but cannot retract copies already downloaded. Admin image updates may only select evidence already attached to that card.

Source links are normalized direct HTTPS pages on an explicit host/path allowlist; queries/fragments are discarded. No arbitrary URL fetching, redirects, embedded previews, or remote image import occurs. Admin source opening and approval require a successful Web Risk check. This detects known URL threats, not adult content on otherwise permitted platforms: moderators must inspect source content and authenticity. Approval checks every merged report and rejects a changed snapshot before the existing atomic commit. Flagged/unscanned images and external legacy image URLs cannot be approved through review.

Orphan cleanup, retention, automated backups of the new asset records/files, and audited deletion remain deployment gates. Existing tracker JSON backups do not contain Blob bytes or the new asset records. `BLOB_READ_WRITE_TOKEN` must reference a private store. Local tests mock external providers, so cloud upload/read/delete and actual scanner behavior remain separate verification gates. See `docs/EVIDENCE_SECURITY.md`.

## Security

Admin routes require a signed, expiring HTTP-only session. Production requires both ADMIN_PASSWORD and ADMIN_SESSION_SECRET; missing configuration disables session creation and verification. Login is rate-limited to ten attempts per IP per fifteen minutes and fails closed if the limiter is unavailable. Public reports and image uploads have separate limits.

JSON endpoints require object bodies. Public reports validate slot bounds, source/evidence URLs, prices, and text lengths before storage. Baseline headers are in next.config.mjs. Do not expose secrets or raw database errors to public clients.

## Affiliates And Measurement

Affiliate builders live in `src/lib/trackers.ts`. TCGplayer uses the user-approved generic partner redirect; eBay uses tracker or default campaign context; Amazon uses the configured Associate tag and relevant product searches. LOTR holiday poster pages target Special Edition collector boosters. Catalog promos without collector-booster distribution use an explicitly generic sealed-product fallback.

`AffiliateOutboundLink` leaves the merchant destination intact and sends best-effort click telemetry separately. Disclosures appear near marketplace links, including at the top of tracker pages. Admin analytics measure clicks and promotion activity, not commissions.

Standing owner requirement: every page containing affiliate links must show a clear affiliate disclosure at the top, before its first affiliate link, on desktop and mobile. The owner reports prior eBay affiliate compliance feedback; this placement is intentional, not decorative or redundant UI. Preserve it when redesigning pages or generating new trackers. Do not remove it, collapse it, or replace it with a footer-only notice or a link to the disclosure page. Additional notices near lower marketplace links may remain. This records the owner's requirement and rationale, not a claim that placement alone guarantees merchant compliance or commission credit.

`scripts/validate-affiliate-links.mjs` validates configured, catalog, and boundary-serial URL shapes. Live checks deduplicate destinations, inspect redirects, and distinguish verified, failed, and manual-review outcomes. A 403/429 is not a verified pass. Merchant approval, credited orders, reversals, and payouts require merchant reports.

## Verification

Run focused regression tests, lint, and a production build. For affiliate changes also run link validation; for deployment changes run the public smoke check. Never use real submissions or destructive restores as production test fixtures. See TODO.md for current priorities and README.md for setup, keys, and operational commands.
