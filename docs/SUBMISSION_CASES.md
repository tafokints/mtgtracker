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

## Follow-Up Replies

Private Needs Info receipt links accept a supported source link, notes, additional owned photos, or a combination. No second report or mandatory explanation is needed when someone only has the link. New replies allow up to eight distinct sources on the report. Links are normalized, stored in each reply and screened during admin review/approval; original report facts remain unchanged. A URL typed into the notes field is still plain text, not structured evidence. Drafts are memory-only and do not survive reload/navigation.

Same-reply retries preserve the source and avoid duplicate entries; changed-payload reuse is rejected. Approved follow-up links appear in the card's source history and are withdrawn with their parent approval. The private receipt shows sources as text, never automatically opens them, and does not publish private reply notes.

## Ring Identity

- The One Ring: Unique 001/001 is LTR #0, Black Speech, with one numbered copy. It remains a reference page under the current English-reporting scope.
- The One Ring: Poster Edition /100 is LTR #748z, a distinct Holiday Release printing. `/trackers/one-ring` retains the 100 existing slots and shared poster-view copy IDs.
- Edition display labels never replace stored card names, slugs, storage keys or marketplace query subjects.

Quantity sources and audit limitations: docs/SERIAL_QUANTITY_AUDIT_2026-09-06.md.

## Release Verification

Local automated tests cover the case matrix, held/clean photo-only reports, source-check failures, explicit merges, context-only corrections, retraction and concurrent review. Browser fixtures cover mobile/desktop approval messages, held merge selection, receipts, form inputs, edition headings, quantities and reference artwork. These are isolated tests, not hosted scanner proof.

Verification: 562 tests / 36 files, lint, build and offline affiliate checks passed. Owner, workflow, collector, submission and quantity/guide suites passed at 320/390/1440px. Screenshots were inspected. The deployment suite includes distinct Ring labels and public submission guidance alongside existing health and anonymous admin-denial checks.

Follow-up extension: 591 tests / 36 files, lint, build and unchanged affiliate checks passed. Follow-up, owner and workflow browser suites passed at 320/390/1440px, including lost-response retries, plaintext private sources, failed source checks, correct stored-reply selection and notes-only replies. Source histories are covered through approval, shared views, merge, retraction and backup restore. Deployment checks now include anonymous receipt GET/POST and source-check denial (68 total). These checks do not exercise real hosted provider scans.

The owner deferred screening-service setup and encrypted recovery activation. Missing image scanners hold photo approval; missing Web Risk holds source-linked approval. There is no production bypass, no production QA discovery, and no automatic rewrite of existing reports.
