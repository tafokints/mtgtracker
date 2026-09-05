---
name: mtg-trackers
description: Develop, debug, and verify this standalone MTG Trackers app, including serialized-card identity, discovery review, Redis persistence, evidence storage, and affiliate links. Applies to this project rather than the separate parent Golden Chocobo tracker.
---

# MTG Trackers

Work inside the standalone `mtg-serial-tracker` repository. The parent Golden Chocobo tracker is a separate application. Read the current TODO.md priority queue and ARCHITECTURE.md before deciding the next improvement; README.md contains setup, key conventions, and operational checks.

## Fragile Invariants

- `src/lib/trackers.ts` drives live pages, quantities, card definitions, themes, sources, and affiliate destinations.
- `trackers` is the featured list, not the full registry. Use `getTracker`/`allTrackers` for generated printing routes. Catalog snapshot refresh and set/treatment/printing rules are in ARCHITECTURE.md.
- Generated printing mutations and restores must atomically maintain the active-printing index; discovery feeds should not read hundreds of empty trackers.
- Use `getTrackerTotalSlots` for whole-tracker validation. A multi-card tracker's `total` is only the default per-card quantity.
- Existing numeric slot IDs depend on card-definition order. Do not reorder launched definitions without a migration.
- Use `src/lib/tracker-store.ts` for canonical writes. Its compare-and-set commit prevents concurrent reports or admin actions from overwriting one another.
- Mutation callbacks may retry: keep external effects outside them. Approval must persist card changes and review status together.
- Discovery reports stay pending until admin review. Vercel Blob uploads, extended review states, and backup/restore already exist.
- Uploads decode/re-encode real image bytes and strip metadata before public Blob storage. Distinguish local mocked-storage tests from a real cloud upload/read/delete test; attachment removal does not delete a blob. Retention remains in TODO.md.
- Reference artwork is not serial-specific evidence. Do not inflate discovery/evidence counts with placeholders.
- One Ring currently appears in two independently stored trackers. Resolve its canonical identity explicitly before expanding overlapping collections.
- Preserve legacy source keys and existing records. Use isolated fixtures for destructive or concurrency tests.

## Affiliate Work

Keep the user-configured campaign and partner IDs. TCGplayer's partner URL is a generic marketplace destination. eBay searches need campaign attribution and tracker context; Amazon searches need the Associate tag and the correct distribution product. Holiday LOTR poster serials use Special Edition collector boosters.

Keep visible disclosures near outbound links, including top tracker placements. Preserve direct destinations when sending best-effort telemetry. Clicks are not commissions: actual profitability needs merchant-reported credited orders, reversals, revenue, and operating costs.

The link validator covers configured links, catalog links, and sample boundary serials. HTTP 403/429 requires manual review; it is not proof that a destination works.

## Finish A Change

Run meaningful regression tests for persistence, security, or affiliate attribution changes, plus lint and build. Run the affiliate validator when links change and the smoke check for deployments. Document the observed outcome and remaining work in TODO.md; do not mark unverified account configuration or a broad product ambition complete.

Use existing session authorization for commits/deployment. This skill does not grant permission to publish new content, change merchant accounts, or migrate production records.
