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
- [x] Add affiliate click rollups for serial-detail card and serial context.
- [x] Link safe internal last-click source paths from the affiliate stats table.
- [x] Show actual last-click affiliate destinations in admin stats.
- [x] Add CSV export for admin affiliate click stats.
- [x] Add quick-read affiliate performance insights to the admin panel.
- [x] Add top-of-page affiliate marketplace CTA placement.
- [x] Add contextual affiliate CTA placement for active filtered tracker views.
- [x] Add active-view summary copy to contextual filtered affiliate CTAs.
- [x] Add serial detail marketplace CTA placement.
- [x] Add tracker trust and market-signal strip under primary marketplace CTAs.
- [x] Add tracked exact-serial eBay CTAs to tracker grid cards.
- [x] Use exact card-and-serial eBay searches from serial detail CTAs while preserving affiliate attribution.
- [x] Add affiliate attribution checks for eBay custom IDs, Amazon tags, and TCGplayer redirects.
- [x] Add admin affiliate coverage audit for tracker-specific merchant coverage, attribution, and CTA copy.
- [x] Add affiliate intent metadata for singles, auction comps, and sealed product links.
- [x] Add marketplace CTA recommendations from affiliate coverage, directory interest, and click winners.
- [x] Add baseline security headers.
- [x] Return 400 for malformed JSON request bodies.
- [x] Remove placeholder aggregate rating structured data.
- [x] Add verified structured data for tracker pages and directory.
- [x] Add breadcrumb structured data across core public pages and tracker routes.
- [x] Add production smoke-check script for core pages, health, sitemap, and live trackers.
- [x] Add robots.txt verification to production smoke checks.
- [x] Add static trust page, sitemap, and breadcrumb structured data checks to production smoke.
- [x] Add live tracker submit pages to sitemap and smoke checks.
- [x] Add tracker marketplace CTA and stats market-context assertions to production smoke checks.
- [x] Add GitHub Actions verification for tests, lint, build, audit, affiliate link validation, and production smoke monitoring.
- [x] Add public JSON and RSS feeds for recent verified discoveries.
- [x] Add copy-ready share text for located serial discoveries.
- [x] Add serial-aware social metadata for exact tracker links.
- [x] Add one-click native, X, and Reddit share actions for located serials.
- [x] Add admin promotion candidates for approved high-signal discoveries.
- [x] Track admin promotion share actions separately from affiliate clicks.
- [x] Add UTM-tagged promoted discovery URLs for copy, X, and Reddit posts.
- [x] Add promotion efficiency rollups that compare promotion actions with affiliate clicks by tracker.
- [x] Track promoted discovery page visits from `utm_campaign=discovery_promotion` URLs.
- [x] Add promotion funnel insight cards for best funnels, CTA gaps, and distribution gaps.
- [x] Add source-level promotion efficiency for X, Reddit, and copied posts.
- [x] Include promotion source efficiency in affiliate stats CSV exports.
- [x] Add recommended next actions to weak promotion funnel insight cards.
- [x] Add a promote-next recommendation that pairs the best approved discovery with the strongest current promotion source.
- [x] Add tracker growth recommendations from directory CTA, promotion, and affiliate-click signals.
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
- [x] Add admin evidence-strength summaries and prioritize stronger pending reports.
- [x] Add public report evidence image count guardrails and removal controls.
- [x] Show selected card and serial confirmation on the public report form.
- [x] Require source or image evidence when public reports request confirmed status.

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
- [x] Add tracker directory latest-discovery links and report-a-find CTAs.
- [x] Track tracker directory open/report/latest-discovery CTA clicks in admin stats and CSV exports.
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
- [x] Add tracked marketplace CTAs and market trust context to tracker stats pages.
- [x] Add server-rendered Dataset JSON-LD to tracker stats pages.
- [x] Add tracker-specific collector notes and discovery guidance to tracker and stats pages.
- [x] Add tracker-specific FAQs with FAQPage structured data.
- [x] Add exact-serial ItemPage structured data for shareable serial links.

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
