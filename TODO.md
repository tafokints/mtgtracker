# TODO

## Launch Readiness

- [x] Add real admin authentication.
- [x] Protect admin-only API routes:
  - [x] review submissions
  - [x] update price
  - [x] update image
  - [x] update grading
  - [x] add price history
- [x] Add basic public submit rate limiting.
- [x] Add stricter server-side validation for:
  - [x] serial range
  - [x] URLs
  - [x] image URLs
  - [x] prices
  - [x] source type
  - [x] verification status
  - [x] max text lengths
- [x] Add Vercel deployment notes for `mtgtrackers.com`.
- [x] Add affiliate disclosure near marketplace links.
- [x] Add eBay Partner Network disclosure on tracker pages.
- [x] Add top-of-page affiliate disclosure on tracker pages.
- [x] Add affiliate link validation script.
- [x] Add affiliate outbound click telemetry.
- [x] Track middle-click new-tab affiliate clicks through shared outbound links.
- [x] Add admin affiliate click stats view.
- [x] Add affiliate stats rollups by tracker, merchant, and placement.
- [x] Store affiliate click source paths for better CTA and page attribution.
- [x] Store shareable tracker view context with affiliate click metadata.
- [x] Surface last-click view-context rollups in affiliate stats.
- [x] Add per-click affiliate counters for shareable tracker view filters, sorts, and card filters.
- [x] Link safe internal last-click source paths from the affiliate stats table.
- [x] Add top-of-page affiliate marketplace CTA placement.
- [x] Add contextual affiliate CTA placement for active filtered tracker views.
- [x] Add active-view summary copy to contextual filtered affiliate CTAs.
- [x] Add serial detail marketplace CTA placement.
- [x] Use exact card-and-serial eBay searches from serial detail CTAs while preserving affiliate attribution.
- [x] Add affiliate attribution checks for eBay custom IDs, Amazon tags, and TCGplayer redirects.
- [x] Add affiliate intent metadata for singles, auction comps, and sealed product links.
- [x] Add baseline security headers.
- [x] Return 400 for malformed JSON request bodies.
- [x] Remove placeholder aggregate rating structured data.
- [x] Add verified structured data for tracker pages and directory.
- [x] Add production smoke-check script for core pages, health, sitemap, and live trackers.
- [x] Add robots.txt verification to production smoke checks.
- [x] Add live tracker submit pages to sitemap and smoke checks.
- [ ] Validate Google Search Console setup.
- [x] Replace placeholder Google verification metadata.
- [x] Add privacy/contact/about pages before broad promotion.
- [x] Add standalone affiliate disclosure page.
- [ ] Submit `https://mtgtrackers.com/sitemap.xml` in Google Search Console.

## Submission Review Queue

- [x] Show approved and rejected submission history in admin.
- [x] Add duplicate detection for repeated reports on the same serial.
- [x] Add report status options beyond approved/rejected:
  - [x] needs more info
  - [x] duplicate
  - [x] cannot verify
- [x] Allow admins to merge evidence from multiple pending reports.
- [x] Add audit trail for who reviewed each report.
- [x] Add public report evidence image count guardrails and removal controls.
- [x] Show selected card and serial confirmation on the public report form.

## Image Storage

- [x] Choose image storage provider:
  - [x] Vercel Blob
  - [ ] S3
  - [ ] Cloudinary
- [x] Replace URL-only evidence with uploads.
- [x] Store all submitted evidence images with the report.
- [x] Let admins choose the canonical card image during approval.
- [x] Keep image provenance attached to each discovery.

## Modular Tracker Backend

- [x] Extract One Ring-specific Redis logic into generic tracker helpers.
- [x] Move tracker-specific settings into config:
  - [x] slug
  - [x] title
  - [x] set/release/card type
  - [x] total
  - [x] Redis card key
  - [x] Redis submissions key
  - [x] serial formatter
  - [x] reference image
  - [x] theme
  - [x] affiliate links
- [x] Convert API routes to use tracker config by slug.
- [x] Add researched serialized MTG scaffold catalog.
- [x] Surface serialized scaffold queue on `/trackers`.
- [x] Convert One Ring pages to dynamic tracker pages:
  - [x] `/trackers/[slug]`
  - [x] `/trackers/[slug]/stats`
  - [x] `/trackers/[slug]/submit`
- [x] Generate sitemap tracker routes from live tracker config.
- [x] Add Edgar Markov as the first second live single-card tracker.
- [x] Launch LOTR Poster Cards as the first live multi-card tracker.
- Add multi-card treatment data model:
  - [x] tracked card definitions
  - [x] card-plus-serial discovery slots
  - [x] submission validation for card and serial
  - [x] admin review filters by card
- [x] Add scaffold tooling for single-card trackers from `src/lib/serialized-catalog.ts`.
- [x] Add catalog/tracker consistency checks for live catalog entries.
- Add Golden Chocobo as a second tracker after the generic path is ready.

## Directory And UX

- [x] Add cross-tracker recent discovery feed to the homepage.
- [x] Link homepage recent discoveries to exact serial detail URLs.
- [x] Add discovered count and pending report count to tracker directory cards.
- [x] Keep directory stats read-only so multi-card trackers are not initialized from directory visits.
- [x] Add tracked marketplace links to tracker directory cards.
- [x] Add richer tracker metadata:
  - [x] set name
  - [x] release name
  - [x] card type
  - [x] source/reference links
- [x] Add tracker-specific affiliate links with default fallback.
- [x] Add tracker-specific theme config placeholders.
- [x] Improve mobile layout for tracker cards and admin review.
- [x] Add empty states for no submissions, no prices, and no discoveries.
- [x] Make `Report a Find` visible on live tracker pages so new discoveries can enter admin review.
- [x] Add serial-specific report links directly on unlocated tracker cards.
- [x] Highlight saved evidence image counts on tracker cards.
- [x] Add tracker filter for discoveries with saved evidence.
- [x] Add tracker source-type filters for marketplace, grading, social, article, private sale, and other discoveries.
- [x] Add evidence-count sorting on tracker pages.
- [x] Preserve tracker search, filter, card, and sort state in shareable URLs.
- [x] Add active filter chips with one-click clearing on tracker pages.
- [x] Add tracker result-count summaries for active views.
- [x] Add located, confirmed, and evidence-backed counts to tracker result summaries.
- [x] Scope pending report counts in tracker summaries to the active result view.
- [x] Add one-click copy for current tracker view links.
- [x] Add shareable serial detail links with URL state.
- [x] Add one-click copy for serial detail links.
- [x] Add serial-specific report links that prefill the submit form.
- [x] Link tracker latest-find summaries to exact serial detail modals.
- [x] Add public verification signals to serial detail modals.
- [x] Show approved evidence images in serial detail modals.
- [x] Link stats-page recent discoveries to exact serial detail views.
- [x] Add stats-page source-quality breakdowns.
- [x] Make stats-page pricing coverage explicit when sale data is missing.
- [x] Add stats-page source-type breakdowns.

## Data Safety

- [x] Add export/backup endpoint for cards and submissions.
- [x] Add import/restore tooling for admin use.
- [x] Add lightweight schema versioning for tracker data.
- [x] Document Redis key conventions.

## Maintenance

- [x] Review npm audit warnings.
- [x] Upgrade Next.js and frontend dependencies to clear audit findings.
- [x] Add graceful tracker data fallback when the cards API is unavailable.
- [x] Decide whether to migrate arbitrary image rendering to `next/image`.
- [x] Centralize externally hosted card/evidence images behind a safe wrapper.
- [x] Add basic tests for submission approval/rejection.
