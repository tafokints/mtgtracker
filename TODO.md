# TODO

## Current Plan (2026-09-06)

Goal: become a trusted, comprehensive serialized MTG reference funded by relevant affiliate purchases. Accuracy, recoverability, and useful collector workflows come before more promotional placements. Click counts measure interest; merchant-reported commissions and operating costs measure profitability.

Current phase: infrastructure readiness. Zero production discoveries is acceptable and is not a launch blocker. Validate empty and populated workflows with isolated test fixtures; do not seed production just to demonstrate readiness. Content acquisition and audience growth come later.

Standing affiliate requirement: preserve a clear top-of-page disclosure before the first affiliate link on every page containing affiliate links, on desktop and mobile. The owner reports prior eBay compliance feedback, which is why this placement is intentional. Future layout work must not remove, collapse, or relocate it to the footer; see ARCHITECTURE.md.

### Now: Collector Workflow And Browsing

The owner has deferred screening-service account setup and requested a core workflow/usability pass. Do not bypass existing safety gates: pending uploads remain private and unapprovable until real checks pass. Public "under review" means an unresolved report exists, not that a discovery is verified.

- [x] Require structured source/protected evidence for new-discovery approval, including selected merges and the latest atomic copy state. Allow context-only updates to located copies without independently setting location or verification; preserve retraction behavior. Show actionable approval reasons and keep Needs Info available. Case matrix: docs/SUBMISSION_CASES.md.
- [x] Label The One Ring: Poster Edition /100 explicitly in the home/directory/tracker/report/stats headings and The One Ring: Unique 001/001 on its reference page, with reciprocal printing links. Preserve original card title, storage, /100 copy identities and affiliate searches; the /1 Black Speech printing stays reference-only.
- [ ] Add a structured supported-source field to private Needs Info replies, with immutable reply history, normalization, review/reputation checks and backup validation. Current replies accept notes and owned photos; a URL typed into notes is not approval evidence. For now, a separate exact-serial source report can be explicitly merged by the owner.
- [ ] Design an unknown-serial tips inbox separate from exact-copy reports; never invent a serial or mark a slot located from an unbound tip.

Approval/edition verification (2026-09-07): 562 tests across 36 files, lint and build pass. Owner, workflow, collector, submission and quantity/guide browser suites pass at 320/390/1440px; screenshots were inspected. Offline checks pass for 819 configured, 1,740 serial-boundary, 66 catalog and 894 printing affiliate links. The read-only deployment suite now checks the distinct Ring headings and corrected public evidence guidance (65 checks). Hosted scanner setup and lifecycle testing remain deferred, not proven by these fixtures.

- [x] Keep needs-more-info reports in public open-report counts, including reports about already located copies. Publish counts only, not reporter details, review notes or pending evidence.
- [x] Add consistent Under Review / Unreported labels, visible update reporting on located cards, and a report confirmation with the private receipt and a return-to-serial link.
- [x] Add labeled search/card/status/sort controls, quick status counts, exact stamped-number/range search and 48-card pagination. Preserve shareable filters/page state and stop clearing filters when opening details.
- [x] Move serial browsing ahead of FAQ/market explanations, collapse the long card activity overview, and add previous/next serial controls with native modal keyboard handling.
- [x] Simplify public reporting at the owner's request: numeric serial entry, evidence before optional facts, local-only photo selection before consent, and no reporter-assigned confidence score. Photo, supported-link and note-only reports remain available without an account/name/date/price/grade. Submit retains consent, Turnstile, private uploads and safety-gated admin review. Partial upload/report failures preserve same-page inputs and successful IDs for retry; copy changes/expired permissions require fresh uploads of retained local files.
- [x] Finish local desktop/mobile collector and owner review regression checks, including affiliate disclosure placement. 450 tests across 32 files, lint, build and collector/owner/workflow browser fixtures at 320/390/1440px pass. See docs/COLLECTOR_WORKFLOW_QA_2026-09-05.md. Release through the existing GitHub -> Vercel pipeline; read-only live checks remain separate from hosted intake verification.
- [ ] Complete a real hosted upload -> scan -> approve/reject lifecycle after isolated stores and scanner accounts are ready. Intercepted browser fixtures and local route tests are not hosted service proof.

Deferred local service-diagnostic work is preserved in the Git stash named `Deferred service diagnostics before collector workflow pass`; it is not in this release or pushed to GitHub. It includes the optional owner Turnstile acceptance/replay diagnostic and scanner configuration validation. Screening accounts are not configured; the real backend challenge acceptance/replay check is still pending.

Submission UX verification (2026-09-06): 543 tests across 36 files, lint and build pass. `check-submission-ui.mjs`, `check-collector-ui.mjs` and `check-turnstile-ui.mjs` pass at 320/390/1440px, including local-only selection, consent, minimal reports, partial/lost-response retries, exact-copy/expiry binding and optional-field validation. Screenshots were inspected; APIs/widgets are isolated fixtures, not hosted scan proof. Offline affiliate URL checks pass unchanged. Unsent drafts are memory-only, not saved across navigation/reload. Whole-site affiliate reporting remains the next code priority below; backups and screening-account setup remain deferred.

### Audit And Reliability

- [x] Review all 298 catalogued printing quantities across 22 families against publisher sources and numbered card references. Keep unique One Ring /1 separate from poster One Ring /100, preserve Chocobo /77 and Doctor/Sol Ring variants, clarify printing labels, and fix the LOTR poster statistics denominator from 100 to 2,000. Independent regression expectations and source limitations: docs/SERIAL_QUANTITY_AUDIT_2026-09-06.md.
- [ ] Locate primary publisher distribution documentation for Mirrored Viscera Seer and Secret Lair /295. Their numbered card stamps were checked; keep the existing documentation caveat rather than claiming fully verified promotion details.
- [x] Switch the sole owner password source to `ADMIN_PASSWORD_FRONTEND` at the owner's request, including password checks and session/replay fingerprints. Keep it server-only, reject legacy-password fallback and retain production MFA. Release `0058bc3` passed 343 tests, lint, build, CI and 62 production smoke checks; the owner subsequently confirmed the complete sign-in flow below.
- [x] Push the five pending application commits through GitHub -> Vercel and verify the live custom domain. Release `7ad9ceb` passed GitHub Verify and is live at `/admin`; the owner only changed environment variables before this source push.
- [x] Refresh outdated privacy smoke expectations; verify minimal health, private/noindex admin responses, mandatory-MFA anonymous status, denial of private APIs and no admin sitemap entry. The production smoke suite passes 62 checks.
- [x] Add owner-only `/admin` with a cross-tracker paginated inbox, focused in-page review, safe source rechecks, configuration indicators, session-loss handling and no analytics/indexing/private caching. Reuse existing review APIs and scan gates.
- [x] Add revocable owner sessions, idle/absolute expiry, credential-rotation invalidation, strict cookies/origin checks and production TOTP with replay protection; record server-derived owner IDs on reviews.
- [x] Add encrypted recovery archives for shared tracker snapshots, journals, asset metadata/files and reconciliation archives, with integrity verification and isolated empty-target restore; add a disabled-until-configured nightly workflow.
- [x] Rate-limit telemetry and image reads, bound analytics context and retention, make public health read-only, and remove production CSP unsafe-eval.
- [x] Owner reports enrolling the regenerated Base32 key and updating Vercel. Production variable names for owner ID, TOTP, password and session secret were confirmed without reading values.
- [x] Owner confirms real production password/TOTP login, logout and re-login at `https://mtgtrackers.com/admin`. This is user-reported verification; the agent did not receive passwords, seeds, codes or cookies.
- [ ] Configure separate Preview password/owner ID/TOTP settings and isolated Redis/Blob stores before hosted workflow QA; current connections must not be mistaken for a sandbox.
- [ ] Deferred by owner on 2026-09-06: activate the protected backup environment/failure notifications and perform a real hosted restore drill; retain the encryption key offline. The protected environment and successful encrypted backup are not set up yet. Do not enable deletion while recovery remains unverified.
- [x] Add owner-bound idempotency IDs to admin price/grading/image writes. Atomically retain private retry receipts in the copy journal, reject changed-payload reuse, and recover the same request ID after a failed save or same-tab reload. Tests cover concurrency, lost commit responses, shared One Ring views, retraction, restore and public redaction. See docs/ADMIN_RELIABILITY_2026-09-06.md.
- [x] Add an owner-only read-only upload inventory under Service setup. Bound metadata/reference reads, retain assets associated with reports/history regardless of review status, and flag uncertain records without guessing. No Blob reads, removal controls, automatic cleanup or backup activation.

Reliability/inventory verification (2026-09-06): 514 tests across 35 files, lint, production build and actual Upstash SDK/Lua fixture checks pass. Owner, reporting/history and collector browser suites pass at 320/390/1440px, including a failed-save retry after reload, inventory errors/pagination and logout clearing. Screenshots were inspected. Browser APIs are intercepted, not proof of hosted scans or backup recovery. The deployment smoke suite now also checks anonymous inventory denial and private/noindex headers (63 total live checks).

- [ ] Include active generated trackers in efficient whole-site affiliate rollups; unscoped reports currently default to featured trackers.
- [ ] Configure platform WAF/bandwidth/spend controls, validate trusted forwarded-IP handling, and review untouched legacy analytics keys with a dry-run cleanup.

- [x] Prevent concurrent submissions, reviews, and admin edits from overwriting each other; commit approved cards and review status together.
- [x] Fix multi-card backup round trips and export a consistent cards/submissions snapshot.
- [x] Fail closed when production admin credentials are missing; rate-limit login attempts.
- [x] Reject malformed JSON shapes and ambiguous serial IDs before storage.
- [x] Stop counting reference artwork as serial evidence and fix catalog links to complete treatment trackers.
- [x] Correct generic TCGplayer CTA copy and One Ring sealed-product relevance; preserve existing affiliate account IDs.
- [x] Distinguish verified affiliate destinations from bot-blocked checks; audit dynamic serial and catalog links too.
- [x] Apply compatible dependency security updates and rerun tests, build, and live checks.
- [x] Refresh architecture/agent docs for featured trackers and the generated printing registry.

Baseline audit evidence is in docs/PROJECT_AUDIT_2026-09-05.md. The expanded upload, CRUD, catalog, and browser checks are in docs/QA_AND_CATALOG_2026-09-05.md. Neither report proves merchant commission credit or a completed cloud Blob lifecycle.

### Completed: Upload And Catalog Pass

- [x] Decode and re-encode actual JPEG/PNG/WebP bytes; reject malformed, oversized, animated, and excessive-pixel images; strip embedded private metadata.
- [x] Enforce upload body limits plus cross-tracker IP and site-wide budgets; show previews and prevent duplicate form sends.
- [x] Test create/read/review/edit/export/restore routes, admin access, invalid inputs, and concurrency with isolated fixtures; tighten review and backup validation.
- [x] Verify the actual Upstash SDK and Lua CAS/restore/activity-index scripts against a disposable local emulator.
- [x] Handle omitted/null/empty Redis snapshot fields when initializing untouched trackers; add production smoke assertions for actual numbered-slot arrays.
- [x] Research and snapshot 298 serialized printings: 291 English (290 released, one announced) and seven non-English reference variants.
- [x] Publish the set -> treatment -> printing hierarchy, search/language controls, source links, sitemap entries, and 268 generated single-printing trackers.
- [x] Reuse existing One Ring, Edgar, and poster trackers; keep Golden Chocobo migration deferred.
- [x] Validate affiliate attribution and query relevance for all generated printing/serial links; retain generic TCGplayer and top/bottom disclosures.

### Deferred Setup: Protected Evidence Intake

- [x] Recognize connected private Blob stores through `BLOB_STORE_ID` and SDK-managed Vercel OIDC, while retaining static-token support and fail-closed private uploads. No identity token is copied or passed manually.
- [x] Add an owner-confirmed, rate-limited storage diagnostic to Service setup: private upload, bounded exact read-back, anonymous denial and generated-file-only cleanup. No collector records or scans are changed; failed cleanup remains visible. See docs/INTAKE_SETUP.md.
- [x] Owner reports the production storage diagnostic passed for `mtgtracker-blob`, confirmed private and connected to `mtgtracker`. The diagnostic requires private upload, exact read-back, anonymous denial and cleanup to succeed. Vercel confirms release `7b664b9` is Ready on the custom domain. This is owner-reported hosted storage verification, not an agent-observed scan or report lifecycle test.
- [x] Replace public uploads with private Blob intake and individually addressable asset metadata; protect reads with scan status, canonical approval, ownership, and content hashes.
- [x] Add server-verified Turnstile and one-hour, card-bound report sessions; cap uploads per session and submissions across trackers; deduplicate report retries.
- [x] Connect the owner's existing Turnstile site key in Vercel Production and set the exact custom-domain allowlist; owner supplied the secret directly to Vercel. Fix single-use token retries after lost responses, retain/reset the explicit widget ID, clear expired/error tokens and reject invalid deployed hostname configuration. 436 tests, lint, build and local browser fixtures at 320/390/1440px pass. No secret retrieval or replacement widget; see docs/INTAKE_SETUP.md.
- [ ] Verify a fresh real Turnstile token succeeds once through the hosted submission-session handler and replay is rejected. Configuration presence and mocked tests do not prove a matching site key/secret or Cloudflare domain authorization. Do not create QA discoveries in Production.
- [x] Deploy Turnstile release `c49cca9` through GitHub -> Vercel: CI Verify and 62 live smoke checks pass, and the real widget shows Success in the in-app browser. Backend acceptance/replay remains a distinct pending gate above. Save the owner-approved canonical Spin skill bundle after checking its installer hash; skill validation and helper syntax checks pass. No secret getter/creation helper ran.
- [x] Reject external image URLs and restrict source links to supported direct HTTPS pages; strip query/fragment parameters and do not fetch arbitrary destinations.
- [x] Integrate Cloudmersive malware checks, Azure sexual-content screening, and Google Web Risk source checks with fail-closed responses and authenticated scan retries.
- [x] Prevent unsafe previews/approval/merge/image overrides; show review safety states, check source links before opening, and preserve atomic approval after asynchronous checks.
- [x] Make rate-limit increment/expiry atomic; bound public JSON bodies; reject cross-origin admin mutations.
- [ ] Configure private Blob, Turnstile, both image scanners, and Web Risk in isolated Preview/Development, then Production. No real scanner credentials or external moderation calls were used for the local tests. See docs/EVIDENCE_SECURITY.md.
  The owner reports a successful private Blob diagnostic; its connection still spans Production and Preview. Production Turnstile settings are now present, but real challenge validation and the screening services remain pending. Reports stay review-gated and unscanned evidence remains private/unapprovable. No secrets were downloaded. Separate Preview stores/credentials before full workflow tests.
- [ ] Verify real private upload/read/scan/approve/revoke/delete in an isolated hosted environment before enabling intake broadly; never seed production with QA discoveries.
- [ ] Add durable scanning jobs with authenticated delivery, retry/backoff, and reconciliation for interrupted requests. Current scanning is synchronous and supports admin retry only.
- [x] Add an all-tracker owner inbox with status/tracker filters and bounded cursor pages. Featured trackers plus active generated printings are read without initializing empty card arrays; original report storage avoids shared-view duplicates.
- [ ] Move reports/events into independently indexed records. Inbox pages still decode up to eight existing report arrays and review detail loads the selected tracker's full queue; arrays still grow. Preserve printing-based copy IDs, journals, origin ownership and active-index integrity.
- [ ] Add separate moderator accounts/roles, invitations and a comprehensive protected audit log before inviting reviewers. Owner identity, production MFA and revocable owner sessions are implemented; this is not yet a multi-user identity system.
- [ ] Add safe review/escalation for content-filter false positives, malicious-content reporting/takedown, and later source rechecks. No manual scanner override exists; legitimate MTG artwork may be held.

### Next: Infrastructure Readiness

- [x] Implement printing-based physical-copy identity, shared One Ring/poster views and queues, cross-view evidence ownership, atomic related-record writes/restore, and deduplicated discovery feeds.
- [x] Add explicit revision-checked reconciliation for historical alias conflicts, archiving original records in the same transaction. No production reconciliation has been run.
- [x] Add append-only card events and one-to-many price/grading histories. Preserve first-discovery facts on sightings, explicitly confirm corrections, classify prices/currencies, retain certificates/regrades/ungraded observations, and keep admin metadata edits from creating discoveries.
- [x] Add audited revoke/reopen actions and private, expiring needs-info receipts with bounded replies/owned attachments. Check retry payloads instead of silently dropping changed details; retain merged observations and reject stale merges.
- [x] Add schema-v2 journal/origin-aware tracker backups and nested restore validation; keep private baselines and withdrawn events out of public card responses. This does not include Blob bytes or asset metadata.
- [ ] Preview any production shared-copy conflicts and review reconciliation decisions after taking complete backups; do not silently choose a legacy record.
- [ ] Complete the protected-intake service setup and hosted lifecycle gate above. Earlier public Blob setup advice is superseded: use a private store.
- [ ] Add orphan-upload cleanup, a retention policy, and audited admin removal after verified recovery and explicit policy approval. The read-only inventory is implemented; seven days is an investigation grace period, not an approved deletion policy. Detaching a form attachment is not physical deletion; report hard-delete is not implemented.
- [x] Bound/rate-limit new public telemetry and add retention; arbitrary dimensions no longer create unlimited persistent keys. Historic untouched keys still need reviewed cleanup.
- [ ] Deferred by owner on 2026-09-06: enable the implemented encrypted recovery backup workflow and perform an isolated hosted restore drill. New recovery archives include asset metadata/files; tracker JSON exports alone still do not.
- [ ] Validate the existing tracker scaffold across single-card and multi-card sets, different serialized quantities, shared identities, themes, and relevant affiliate defaults/fallbacks.
- [x] Add mobile/browser regression checks for empty trackers and isolated populated fixtures: serial selection, submission, image preview, review, and filters; improve the 2,000-slot browsing experience with 48-card result pages. Real hosted service verification remains a separate gate.
- [ ] Locate primary distribution documentation for the two Secret Lair serialized promos; their pages currently disclose the source limitation. Refresh the printing snapshot for new releases and manually review newly encountered sets.
- [ ] Add per-tracker aesthetics through shared theme tokens and verify contrast/readability.
- [x] Confirm eBay campaign `5339113954` is Active and register `https://mtgtrackers.com` as a Website media property. Registration is observed, not blanket compliance approval.
- [x] Confirm Amazon Store ID `meleeitonme0a-20` matches the site and save `https://mtgtrackers.com` in the website list, with the owner's answer to the required audience declaration. Existing properties remain unchanged.
- [x] Confirm the TCGplayer application is Approved in Impact account `6334129` and the existing generic link is `https://partner.tcgplayer.com/DyJ25G`. Deploy the owner-authorized passive meta tag and register `mtgtrackers.com`; Impact shows Connected after reload. Keep the old Golden Chocobo entry unchanged.

Affiliate account checkpoint (2026-09-06): see docs/AFFILIATE_ACCOUNT_VERIFICATION_2026-09-06.md. Release `87fa824` passed 514 tests, lint, build, GitHub Verify and 63 production smoke checks. Attribution IDs, affiliate links, top disclosures and payment settings were not changed. Ownership/registration checks do not prove qualifying orders or earned commissions; merchant-report reconciliation remains in the later queue.

Infrastructure acceptance: reports remain pending until authenticated review; overlapping views agree on card identity and discovery counts; image ingestion and telemetry have abuse/cost limits; backups can be restored in isolation; new trackers reuse validated configuration; affiliate destinations, attribution parameters, fallbacks, and disclosures pass checks. No minimum production discovery count is required.

Backend relationship/workflow details and reconciliation instructions are in docs/DATA_MODEL.md. The deployment checkpoint has 338 passing tests across 27 files, successful lint/build, and no known dependency vulnerabilities. Production smoke passes 62 checks; actual hosted browser checks at 390/1440px validate the anonymous owner login UI, and a hosted 390px check confirms uploads/submissions remain disabled without service configuration. The preceding actual-SDK/Lua checks cover revocation/expiry, telemetry retention, recovery snapshots, shared-copy CAS and reconciliation. Dashboard review/held-image/filter/outage/logout browser fixtures remain intercepted tests, not successful owner login or hosted scanner proof. See docs/SECURITY_OPERATIONS.md and docs/DEPLOYMENT_2026-09-05.md for release evidence and remaining gates. The parent tracker and affiliate configuration/disclosures were not changed.

### Later: Content And Growth

- [ ] Grow source-backed discoveries through admin review when content work begins; measure report-to-approval time. This is not an infrastructure readiness gate.
- [ ] Add planned-tracker request demand reporting before prioritizing new live trackers.
- [ ] Reconcile merchant-reported clicks, qualifying orders, reversals, and commissions with site telemetry. Record hosting/storage costs and net revenue monthly.
- [ ] Verify Google Search Console ownership and submit the sitemap.
- [ ] Migrate Golden Chocobo only after canonical identity and backup work is verified; preserve the separate existing tracker.

The sections below retain completed implementation history; unchecked alternatives are not current commitments.

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
- [x] Reject unknown affiliate placements before storing click telemetry.
- [x] Store affiliate click source paths for better CTA and page attribution.
- [x] Sanitize affiliate click source paths to internal paths before storing admin telemetry.
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
- [x] Remove stale client-side WebApplication structured data from tracker pages.
- [x] Add verified structured data for tracker pages and directory.
- [x] Add breadcrumb structured data across core public pages and tracker routes.
- [x] Add production smoke-check script for core pages, health, sitemap, and live trackers.
- [x] Add robots.txt verification to production smoke checks.
- [x] Add static trust page, sitemap, and breadcrumb structured data checks to production smoke.
- [x] Add live tracker submit pages to sitemap and smoke checks.
- [x] Move tracker submit page structured data from client Head to server-rendered JSON-LD.
- [x] Add tracker marketplace CTA and stats market-context assertions to production smoke checks.
- [x] Add GitHub Actions verification for tests, lint, build, audit, affiliate link validation, and production smoke monitoring.
- [x] Add public JSON and RSS feeds for recent verified discoveries.
- [x] Add a public recent discoveries page with exact serial links and feed links.
- [x] Add tracked marketplace CTAs to recent discovery cards.
- [x] Add a crawlable serialized MTG catalog page with source links, tracker status, and broad marketplace CTAs.
- [x] Add individual serialized catalog entry pages with source links, schema, sitemap coverage, and tracked marketplace CTAs.
- [x] Add catalog-specific Amazon sealed-product affiliate searches with Associate-tag telemetry validation.
- [x] Add prefilled tracker-request links to planned serialized catalog entry pages.
- [x] Add prefilled tracker-request links directly to planned serialized catalog rows.
- [x] Add a public verification guide linked from report forms to improve crowd-sourced evidence quality.
- [x] Add public share actions with campaign-tagged discovery URLs.
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
- [x] Add a live evidence quality checklist to public report forms. Superseded on 2026-09-06 by the simplified form; an attached image alone cannot establish a visible serial stamp or verification quality.

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
