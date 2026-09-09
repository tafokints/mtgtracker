# Architecture

## Platform

MTG Trackers is a standalone Next.js 15 App Router application deployed on Vercel at https://mtgtrackers.com. Upstash Redis (or Vercel KV REST environment names) stores tracker records and analytics; Vercel Blob stores evidence uploads. The parent Golden Chocobo repository remains separate.

The registry in `src/lib/trackers.ts` drives dynamic tracker pages, statistics, report forms, APIs, themes, source links, and affiliate destinations. The `trackers` array is the featured list: One Ring (100 slots), Edgar Markov (500), LOTR Poster Cards (20 cards x 100 = 2,000), and Golden Chocobo (77). `allTrackers` adds generated single-printing trackers. Look up any route through `getTracker`, not the featured array.

`src/data/serialized-printings.json` is the reviewed Scryfall snapshot. `catalog:sync` fetches all serialized printings and fails on an unknown treatment instead of guessing quantities. `serialized-printings.ts` supplies release grouping, per-variant totals, language, and source metadata. Reporting opens for released English printings except the deferred Golden Chocobo migration. Announced and non-English printings have reference pages, not active report forms. Existing poster and Edgar records are reused, not regenerated.

## Identity And Storage

Trackers retain `cardsKey` and `submissionsKey` JSON arrays, but physical copies have printing-based `copyId` values independent of routes. The dedicated One Ring tracker owns its copies; poster-set aliases project those same facts and reports. Use `getTrackerTotalSlots`, not `tracker.total`, for whole-tracker validation. Numeric slot IDs remain tracker-local and launched definitions must not be reordered. Read docs/DATA_MODEL.md for relationships, journals, and rollout requirements.

`src/lib/tracker-data.ts` contains shared formatting, slot lookup, normalization, evidence merging, and read helpers. Client components also import its pure helpers.

`src/lib/tracker-store.ts` owns server-side writes. A Lua snapshot reads both raw arrays atomically, and a compare-and-set script commits both only if neither stored value changed. Conflicts reread current data and retry up to five times, then return a retryable 409. Mutation callbacks are synchronous and must have no external side effects. All report, review, price, image, and grading mutations use this path. Initialization uses SET NX and retains legacy source keys.

`admin-mutation.ts` adds required owner-bound `Idempotency-Key` receipts to price/grading/image journal events in that same transaction. Matching retries return current facts, including across shared views; changed-payload reuse returns 409. Private receipts survive history retraction and are validated in backups but stripped from public responses. The client retains opaque pending IDs across same-tab reloads; see docs/DATA_MODEL.md for restore and retry limits.

Backup export reads a consistent snapshot. Explicit admin restore validates all slots, journal entries, and report origins. Independent trackers replace their pair atomically, including when existing data is damaged; shared views use related-record CAS and retain unrelated copies/reports. Restore intentionally replaces the requested view's records; all pages showing its shared copies reflect that restoration.

Generated printing keys use `printing:{scryfallId}:cards` and `printing:{scryfallId}:submissions`. A single printing has at most 513 slots; large sets are not stored as one giant array. Generated mutations/restores also atomically SADD their slug to `mtgtrackers:active-printing-trackers`. Public discovery feeds read featured trackers plus that index, avoiding hundreds of empty reads. Backups validate numeric IDs, slot identity, nested evidence/prices/grading, and unique submission IDs before replacement. Generated restore rebuilds its own index membership.

Shared tracker writes use a multi-record Lua CAS over both views' card/report arrays. Evidence checks retain each report's original tracker/slot, while public feeds deduplicate copy IDs. Historical facts in alias slots block publication/mutation until explicitly reconciled through the authenticated preview/apply endpoint, which archives originals atomically. No production reconciliation was performed by this implementation.

## Public And Admin Flows

Approval requires a supported source (including a grading source) or protected evidence on the primary/explicitly merged reports before an unlocated copy can become located. Eligibility is checked inside the atomic mutation against the current copy, after all safety checks. Notes-only reports remain reviewable; context-only updates to already located copies never independently set `found` or verification. Retraction of the discovery therefore cannot leave a notes-only update sustaining it. See docs/SUBMISSION_CASES.md.

Optional `TrackerSummary.displayTitle` identifies editions in page headings/directories/report forms without changing the underlying card title, exact-serial searches, storage keys or copy IDs. The One Ring poster /100 and unique 001/001 have distinct printing headings and reciprocal reference links; the unique Black Speech printing remains reference-only.

- `/admin`: owner sign-in, cross-tracker inbox, focused safety-gated review and configuration-only service indicators. It is noindex/no-referrer/no-store with no site analytics. Private records are loaded only by authenticated APIs. Cursor pages use original report storage and active generated-printing membership, not shared-view projections; see docs/SECURITY_OPERATIONS.md for ordering and array-storage limits.
- `/`, `/trackers`: umbrella directory and recent discoveries.
- `/trackers/[slug]`: serial grid, filters, details, evidence, and marketplace links.
- `/trackers/[slug]/stats`: discovery and market summaries.
- `/trackers/[slug]/submit`: card/serial selection and evidence report.
- `/sets[/set]`: release-group directory and searchable printing lists, English by default.
- `/serialized-mtg-catalog[/slug]`: researched treatments and sources.
- `/serialized-mtg-catalog/[slug]/[card]`: exact printing references, language, total, release, relevant affiliates, and links into tracker/report flows.
- `/discoveries`, `/discoveries.json`, `/discoveries.xml`: public discovery feeds.
- `/verification-guide`, `/about`, `/contact`, `/privacy`, `/affiliate-disclosure`: trust and contact pages.

Public reports enter a separate pending queue. Approvals append events; later sightings preserve first-discovery facts. Explicitly confirmed corrections replace supplied facts. Pricing and grading are one-to-many histories, with asking/completed/unknown prices, currencies, certificates, regrades, and observed-ungraded events. Only completed USD sales feed USD statistics. Admin metadata edits cannot create a discovery. Revoke/reopen actions retain the journal and review history; public projections omit withdrawn events and private baselines.

Keep reporting low-friction: a selected copy plus a photo, supported source link or note is enough. Do not require an account, public name, discovery date, price, grade or a reporter-assigned confidence score. Extra facts remain optional; the admin establishes verification. The browser stages photos in memory before consent and sends them only on Submit after consent and challenge validation. It freezes the form during submission, preserves successful uploads for same-permission retries and stops on any failed upload. Copy changes/permission renewal discard remote IDs and require new uploads, while retaining local files. No browser-persisted draft, public fallback storage or scanner bypass is introduced.

Needs-info receipts use private, 90-day fragment-token links with noindex/no-referrer and no site analytics. A holder can add bounded replies and owned evidence when information is requested; the report returns to pending. Original submission retries compare payload hashes. All approvals and merges rerun safety checks; no new route bypasses scanning. Current reviewer identity is the configured owner ID, derived from the authenticated server-side session, not an asserted client name.

Needs-info replies accept a supported source, notes, owned photos, or a combination; a link-only reply does not require explanatory text. `followUps[].sourceUrl` is normalized and retained separately from the original `link`/payload hash. Same-ID retries compare normalized source, notes and attachments both before and inside CAS. New replies cannot exceed eight distinct report sources. The admin source-check route accepts a stored reply ID, never an arbitrary URL to inspect. All stored reply sources participate in approval/merge reputation checks and eligibility; their public source events share the parent approval's retraction lineage. Reply text stays in the private report, not automatically in the public card history.

Uploaded JPEG/PNG/WebP evidence (maximum 4 MB per file, 25 million decoded pixels) is decoded, oriented, resized to at most 3,000 pixels per side, and re-encoded as WebP without private metadata. Malformed, mismatched, animated, or oversized inputs are rejected before Blob storage. Multipart stream bytes are bounded even without Content-Length. Uploads have a cross-tracker 10/IP/hour limit and 500/site/day budget. Files receive UUID paths, not user filenames.

Evidence now enters a private Blob store. `submission-session` validates Turnstile and explicit submission permission, then issues a domain-separated HMAC token bound to one tracker, slot, report UUID, and one-hour expiry. Eight upload attempts are allowed per session. Public submit derives the report ID from that token, checks attachment ownership, and deduplicates retries in the existing atomic tracker commit. Client-supplied safety results and external image URLs are never trusted.

Each immutable image has an `evidence:v1:{uuid}` Redis record containing its report/slot identity, deterministic private pathname, SHA-256, dimensions, timestamps, and safety result. Register metadata before storage so interrupted uploads remain reconcilable. Cloudmersive scans the sanitized WebP; Azure screens a PNG derivative. Clean/flagged results are terminal, pending/error checks can be retried through an authenticated, rate-limited endpoint. Missing services fail closed. Scans are currently bounded synchronous work, not a durable background job queue.

`GET /api/evidence/[id]` verifies the stored bytes/hash and serves only clean evidence. Admins may read clean private evidence; anonymous readers additionally need an approved (or explicitly merged) report and a found canonical card referencing the same report/asset. Responses are no-store; there is no public Blob copy. Removing canonical references or reverting report approval stops subsequent app reads, but cannot retract copies already downloaded. Admin image updates may only select evidence already attached to that card.

Source links are normalized direct HTTPS pages on an explicit host/path allowlist; queries/fragments are discarded. No arbitrary URL fetching, redirects, embedded previews, or remote image import occurs. Admin source opening and approval require a successful Web Risk check. This detects known URL threats, not adult content on otherwise permitted platforms: moderators must inspect source content and authenticity. Approval checks every merged report and rejects a changed snapshot before the existing atomic commit. Flagged/unscanned images and external legacy image URLs cannot be approved through review.

Orphan cleanup, retention, automated backups of the new asset records/files, and audited deletion remain deployment gates. Existing tracker JSON backups do not contain Blob bytes or the new asset records. The separate encrypted recovery runner now captures these records/files and reconciliation archives, authenticates every part and supports isolated empty-target restore. Its nightly workflow is disabled until explicitly configured, and real cloud recovery has not been verified. `BLOB_READ_WRITE_TOKEN` must reference a private store. Local tests mock external providers, so cloud upload/read/delete and actual scanner behavior remain separate verification gates. See `docs/EVIDENCE_SECURITY.md`.

The owner Upload retention inventory is read-only: at most 20 metadata rows per response, bounded SCAN/cursor handling, 16 KiB per asset, and at most eight related tracker groups with 2 MiB reference snapshots each. All report states, card journals/baselines and configured legacy card records preserve references. Unreadable/oversized records are unknown, not cleanup candidates. It does not list Blob-only orphans or prove file presence/safety. Backup setup was deferred by the owner on 2026-09-06; no collector deletion or scheduled cleanup is enabled. See docs/ADMIN_RELIABILITY_2026-09-06.md.

## Security

Admin routes require a Redis-backed, revocable owner session with an opaque random token and HTTP-only strict same-site cookie. Production requires ADMIN_OWNER_ID, a strong ADMIN_PASSWORD_FRONTEND/ADMIN_SESSION_SECRET and an enrolled ADMIN_TOTP_SECRET. ADMIN_PASSWORD_FRONTEND is server-only despite its name; ADMIN_PASSWORD is no longer accepted. Missing configuration fails closed. Logout, idle/absolute expiry and credential changes invalidate sessions; mutations require same-origin requests. Login has IP/site budgets and TOTP replay protection. See docs/SECURITY_OPERATIONS.md. Separate moderators and comprehensive protected auditing remain future work.

JSON endpoints require object bodies. Public reports validate slot bounds, source/evidence URLs, prices, and text lengths before storage. Baseline headers are in next.config.mjs. Do not expose secrets or raw database errors to public clients.

Public health is now a read-only Redis PING with a minimal cached success response. Evidence reads and public telemetry have request budgets; telemetry accepts finite known dimensions and expires daily/last-event records after 90 days. Historic untouched keys are not automatically removed. Platform firewall/spend controls remain necessary.

## Affiliates And Measurement

Affiliate builders live in `src/lib/trackers.ts`. TCGplayer uses the user-approved generic partner redirect; eBay uses tracker or default campaign context; Amazon uses the configured Associate tag and relevant product searches. LOTR holiday poster pages target Special Edition collector boosters. Catalog promos without collector-booster distribution use an explicitly generic sealed-product fallback.

`AffiliateOutboundLink` leaves the merchant destination intact and sends best-effort click telemetry separately. Disclosures appear near marketplace links, including at the top of tracker pages. Admin analytics measure clicks and promotion activity, not commissions.

Standing owner requirement: every page containing affiliate links must show a clear affiliate disclosure at the top, before its first affiliate link, on desktop and mobile. The owner reports prior eBay affiliate compliance feedback; this placement is intentional, not decorative or redundant UI. Preserve it when redesigning pages or generating new trackers. Do not remove it, collapse it, or replace it with a footer-only notice or a link to the disclosure page. Additional notices near lower marketplace links may remain. This records the owner's requirement and rationale, not a claim that placement alone guarantees merchant compliance or commission credit.

Directory presentation (owner-approved 2026-09-07): `/trackers` uses one top-of-page notice covering all displayed merchants, not a repeated disclosure inside every tracker card. Keep that notice before the card grid and derive its merchant coverage from the same displayed links. The homepage currently has no affiliate links and needs no extra notice; add a top notice if affiliate placements are introduced. Individual tracker, reference and detail-view notices remain in place.

`scripts/validate-affiliate-links.mjs` validates configured, catalog, and boundary-serial URL shapes. Live checks deduplicate destinations, inspect redirects, and distinguish verified, failed, and manual-review outcomes. A 403/429 is not a verified pass. Merchant approval, credited orders, reversals, and payouts require merchant reports.

## Verification

Run focused regression tests, lint, and a production build. For affiliate changes also run link validation; for deployment changes run the public smoke check. Never use real submissions or destructive restores as production test fixtures. See TODO.md for current priorities and README.md for setup, keys, and operational commands.
