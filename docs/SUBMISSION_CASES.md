# Submission And Review Cases

Updated 2026-09-07. Public reports are leads, never automatic discoveries. A report identifies the exact printing/card and stamped serial. No account, name, date, price or grade is required. Consent and Turnstile remain mandatory.

| Submitted evidence | Intake and review |
| --- | --- |
| Supported source link, no photo | Queue normally. Web Risk and human inspection of the exact serial are required before approval. No image is invented or imported. |
| Photo, no link | Private upload and queue. Both image checks must pass, then the owner inspects card/serial before approval. |
| Photo and link | Every attachment and structured source on all selected reports must pass its checks. One good item does not bypass a held item. |
| Notes only, unlocated copy | Queue as a potential find. Cannot approve as located; request evidence, explicitly merge a supporting same-copy report, or close as cannot verify/rejected. |
| Notes only, already located copy | May approve context after review. Does not independently mark found or change verification, even when the request asks for confirmed. Withdrawing the original discovery removes its contribution. |
| Price or grading details without source/photo | Not evidence of discovery by themselves. A supported structured grading source can qualify, subject to reputation and human checks. |
| No source, photo or notes | Reject incomplete submission. |
| Unsupported URL or external image URL | Reject structured URL intake. Plain-text context remains plain text, not an automatic clickable link, fetch, or evidence substitute. |
| Duplicate or complementary reports | Owner explicitly selects pending reports for the same copy to merge. Check all of them, preserve observations, and tie their contributions to the parent approval for retraction. |
| Wrong or unknown serial/printing | Do not assign a guessed copy. Request clarification or reject. Unknown-serial tips remain a separate planned workflow. |

Safety checks are necessary, not proof of authenticity. Supported platform pages may still contain adult or misleading content and may change later. Human review remains required; no automatic safety guarantee or scanner override exists.

## Pending Versus Located

Pending and Needs Info contribute only to public open-report counts. Private evidence, reporter details and review notes are not published. The owner must inspect the right printing and visible serial before choosing verification. Reference artwork is never discovery evidence.

The eligibility guard runs inside the atomic review mutation as well as the interface. A concurrent retraction cannot turn a context-only approval into a new discovery. Context-only journal events omit location and verification facts. Existing historical events are not automatically migrated or rewritten.

## Follow-Up Limits

Private Needs Info receipt links currently accept text and additional owned photos. They do not yet expose a structured source-link field. A URL in reply text does not qualify as evidence; submit a separate exact-serial source report for the owner to merge until that field is implemented. Drafts are memory-only and do not survive reload/navigation.

## Ring Identity

- The One Ring: Unique 001/001 is LTR #0, Black Speech, with one numbered copy. It remains a reference page under the current English-reporting scope.
- The One Ring: Poster Edition /100 is LTR #748z, a distinct Holiday Release printing. `/trackers/one-ring` retains the 100 existing slots and shared poster-view copy IDs.
- Edition display labels never replace stored card names, slugs, storage keys or marketplace query subjects.

Quantity sources and audit limitations: docs/SERIAL_QUANTITY_AUDIT_2026-09-06.md.

## Release Verification

Local automated tests cover the case matrix, held/clean photo-only reports, source-check failures, explicit merges, context-only corrections, retraction and concurrent review. Browser fixtures cover mobile/desktop approval messages, held merge selection, receipts, form inputs, edition headings, quantities and reference artwork. These are isolated tests, not hosted scanner proof.

Verification: 562 tests / 36 files, lint, build and offline affiliate checks passed. Owner, workflow, collector, submission and quantity/guide suites passed at 320/390/1440px. Screenshots were inspected. The deployment suite includes distinct Ring labels and public submission guidance alongside existing health and anonymous admin-denial checks.

The owner deferred screening-service setup and encrypted recovery activation. Missing image scanners hold photo approval; missing Web Risk holds source-linked approval. There is no production bypass, no production QA discovery, and no automatic rewrite of existing reports.
