# Project Audit: 2026-09-05

## Current Position

MTG Trackers has a working standalone platform: three live trackers, a 22-treatment research catalog, card/serial report selection, an admin review queue, evidence uploads, backup/restore, source links, discovery feeds, and affiliate click reporting. The parent Golden Chocobo app was not changed.

Public production reads during this audit returned:

| Tracker | Slots | Approved discoveries | Pending reports |
| --- | ---: | ---: | ---: |
| The One Ring | 100 | 0 | 0 |
| Edgar Markov | 500 | 0 | 0 |
| LOTR Poster Cards | 2,000 | 0 | 0 |

These are application slots, not 2,600 distinct physical copies: the poster collection includes the same 100 One Ring copies as the dedicated tracker. Those two views currently have independent storage. Content acquisition and canonical identity are higher priorities than adding more affiliate placements.

## Findings Addressed

1. Concurrent public reports and admin edits used whole-array read/edit/write operations and could lose another request's update. Shared compare-and-set persistence now retries against current state.
2. Approval saved cards and report status separately. Both now commit atomically; a competing approval receives 409 instead of duplicating price history.
3. Backup restore validated the per-card total (100) instead of the poster collection's 2,000 slots. Restore now validates all slots and replaces cards/submissions atomically; exports read a consistent snapshot.
4. Production session verification could fall back to a development signing secret when credentials were absent. It now fails closed, and login attempts are rate-limited with constant-time password digest comparison.
5. Non-object JSON could trigger server errors; permissive serial parsing accepted values such as 7junk. Invalid shapes/serials are rejected, numeric API prices are retained, and inherited property names are rejected as review actions.
6. Default reference artwork inflated the evidence count to 100 on an empty One Ring tracker. Evidence counts now require a located card with a non-reference image; empty multi-card summaries use the full slot count.
7. TCGplayer CTA text suggested specific product searches despite using the user-approved generic redirect. It now says Browse TCGplayer. One Ring Amazon searches now target Holiday Release Special Edition boosters. Catalog promos have a labeled generic fallback, and active eBay searches no longer promise preselected sold results.
8. The catalog's LOTR Poster Cards link selected the first matching tracker (One Ring). It now opens the full treatment tracker.
9. The affiliate validator accepted lookalike domain suffixes and treated eBay 403 as a passed destination check. It now validates exact domain boundaries, duplicate parameters, redirect attribution, dynamic serial examples, and catalog links; bot blocks require manual review.
10. Eight dependency advisories were reported at baseline. Compatible updates cleared the dependency audit without a framework major upgrade.
11. Architecture and agent instructions described already-completed work as planned, and deployment notes named the wrong Vercel root for the standalone repository. Docs and the project skill now reflect the implementation and current risks.

## Affiliate Evidence

- eBay: configured campaign 5339113954, tracker-specific custom IDs, and required URL fields are present. Automated destination requests receive 403, so browser/account verification remains open.
- Amazon: configured tag meleeitonme0a-20 remains in the checked final destinations, which returned 200.
- TCGplayer: the generic DyJ25G redirect returned 200 on a TCGplayer domain with an Impact click ID, publisher ID 6334129, irgwc=1, and utm_source=impact.
- URL-only validation covers 15 configured links, 132 boundary-serial examples, and 66 catalog links. Live requests check the distinct configured destinations, not every generated serial/catalog search.
- These observations do not establish account ownership/approval, credited orders, commissions, or profitability. Review merchant reports and monthly Vercel/Redis/Blob costs.

Official references: [eBay link creation](https://partnernetwork.ebay.com/resources/create-your-affiliate-link), [eBay campaign/custom-ID reporting](https://partnernetwork.ebay.com/solutions/optimizing-using-tracking-parameters), [eBay disclosure guidance](https://partnernetwork.ebay.com/resources/affiliate-disclosure-faq), and [Amazon disclosure guidance](https://affiliate-program.amazon.com/help/node/topic/GHQNZAU6669EZS98).

## Verification And Limits

- Baseline: 114 tests and production smoke checks passed despite the uncovered defects.
- Regression suite: 146 tests pass, including concurrent submissions, duplicate approvals, atomic failure behavior, concurrent image/price edits, 2,000-slot restore, authentication, serial input validation, reference-image exclusion, and affiliate destination checks.
- Executed the actual snapshot/commit Lua scripts with fakeredis/Lupa in an isolated environment; missing keys, stale-write rejection, and preservation of concurrent reports passed. The actual Upstash SDK also passed simultaneous mutations, raw snapshot decoding, and atomic restore against a loopback-only REST fixture, which was removed after testing.
- Dependency audit reports zero advisories after compatible updates. The project skill passes its validator.
- TypeScript, lint, production build (41 generated pages), and local smoke checks pass. Mobile browser checks verified the card/serial prefill and selection reset, the full poster catalog destination, and no horizontal overflow at 390px. Local preview used no production database credentials. Post-push deployment checks are reported in the task handoff.
- No production submissions, approvals, restores, or merchant account changes were used as test fixtures.

## Next Outcomes

1. Establish one canonical identity for each printing/card/serial, then reconcile One Ring's two views without losing evidence or counting discoveries twice.
2. Build a source-backed discovery dataset through review; track approval turnaround and unresolved evidence requests.
3. Reconcile account-approved affiliate destinations with merchant-reported credited revenue and operating costs before scaling promotion.
4. Harden image content handling, follow-up reports, telemetry limits/retention, automated backups, and restore drills.
5. Improve the collector-first mobile layout and 2,000-slot browsing performance; introduce tracker-specific themes through shared components.
6. Expand catalog coverage from verified sources and measured collector demand. Keep Golden Chocobo migration separate until identity and recovery are proven.

The executable priority queue and acceptance status live in TODO.md.
