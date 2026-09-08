# Copy Identity And Reporting Workflows

Implemented locally on 2026-09-05. No production migration is performed by this change.

## Relationships

```text
Exact printing (Scryfall printing ID, not the generic card name)
  -> many numbered physical copies: copy:{printingId}:{serialNumber}
       -> many community reports
            -> many private evidence assets
            -> many review actions and submitter replies
       -> many historical events
            -> price observations
            -> grading / regrading / observed-ungraded events
            -> discovery, sighting, correction, image selection, retraction
```

Tracker routes are views, not physical-copy identities. A One Ring /100 copy is shared by the dedicated tracker and the LOTR Poster Cards view. Tracker-local numeric slot IDs remain stable for existing links. The poster definition declares its canonical owner; the owner stores the facts and journal. Alias slots store layout/identity only. All currently live definitions resolve to an exact printing ID; fallback identities are reserved for custom/unmapped configurations and must not be renamed after launch.

`tracker-relationships.ts` projects owner records into each view and combines reports for visible copies. A report keeps its original tracker/slot so private image ownership and old report links survive projection. Evidence ownership must never be checked against a remapped view ID alone.

`tracker-store.ts` atomically reads and compare-and-sets all related card/report arrays for shared views. Concurrent review, correction, price, grading, and restore operations retry a complete snapshot. Unrelated poster cards/reports are retained when a dedicated One Ring backup is restored. Generated independent printing trackers retain their existing CAS and activity-index behavior. Public discovery feeds deduplicate by copy ID.

These are logical one-to-many relationships, still persisted inside the existing Redis JSON arrays. The `/admin` inbox now offers cursor pages over original tracker report storage, avoiding duplicates from alias projections. It selects featured plus active generated trackers, returns at most 20 summaries and reads at most eight report arrays per request. Selected-report review still reads the selected tracker's projected queue. This does not claim bounded per-record physical storage or global snapshot pagination. Indexed independent report/event records remain the next scaling step; keep these IDs and invariants when moving them.

## Historical Facts

- `historyBaseline` preserves pre-journal facts. Existing undated/unclassified prices are retained as unknown, not invented completed sales.
- `history` is append-only. Public fields are rebuilt from the baseline and active events; never directly edit a derived field to retract evidence.
- A later sighting fills missing facts and may strengthen verification, but does not replace the original finder/date/source/notes. It remains a separate event with its own context.
- A correction requires explicit moderator confirmation and replaces only supplied fields. Private reviewer notes are not copied into public card notes.
- Price observations distinguish `asking-price`, `completed-sale`, and `unknown`, with their own dates, currencies, source URLs, and optional sale parties. The reporter is not inferred to be the owner or seller. A date found is not a sale date.
- Only classified completed USD sales contribute to the existing USD sale-statistics fields. Other prices remain visible in history. A backfilled older sale must not replace a later sale.
- Two reports with the same normalized source, price, currency, type, and transaction date contribute one price-history observation. Reports without an identifying source are not assumed to describe the same transaction.
- Grading events preserve service, grade, optional certificate and event date. Regrades and later observations of an ungraded card do not delete previous grading events. Dates are not guessed. An absent current grade means unknown, not proof that the copy has never been graded.
- Admin price/grading writes require an already documented copy and never independently set `found` or upgrade verification.
- Notes-only report approvals similarly add context only to an already located copy. Their events omit `found` and `verificationStatus`, including explicitly confirmed corrections, so withdrawing the discovery also removes its location/verification contribution. New discoveries require evidence on the primary or explicitly merged reports, checked against the latest copy inside CAS. Historical events are not silently rewritten; old unsupported approvals require deliberate review/retraction.
- Retraction appends a journal event, changes report status to `revoked`, and rebuilds the copy without that approval's contributions. Previously approved evidence becomes inaccessible to anonymous readers. Other independently approved reports survive. Legacy approvals without journal entries require deliberate correction/reconciliation, not an invented rollback.
- Public card responses omit the private baseline, withdrawn events and private admin retry receipts. Admin exports retain the complete journal and review history.

## Retry-Safe Admin Edits

Price, grading and image-selection writes require a v4 UUID `Idempotency-Key`. `admin-mutation.ts` binds it to the authenticated owner and a SHA-256 digest of the copy ID, edit kind and normalized payload. The edit and its private `adminMutation` receipt are appended in the same atomic journal commit. Matching retries return the current card without reapplying an old edit; reuse for a different payload or owner returns 409. Both shared One Ring views resolve to the same receipt. The legacy update-price route preserves the header and delegates to the price-history route.

The browser coalesces identical in-flight saves and keeps only an opaque request ID under a payload-digest key in tab-local session storage. After an uncertain response, retry the same values; a same-tab reload can recover that ID. Changed values are a different request. Confirmed success removes the pending ID so a deliberately new identical observation remains possible. When session storage is unavailable, reload persistence is not guaranteed. Previously open admin pages must refresh after this release to send the new header.

Receipts have no independent expiry and survive later edits, retraction, and restore of a snapshot containing them. A deliberate restore to a snapshot predating the edit removes its receipt along with that history; retry protection cannot span discarded history. Import validates unique IDs, hashes, owners and eligible event kinds. These receipts are not a general audit service or a reason to bypass image/source checks for new edits.

## Review And Follow-Up

Public `pendingReports` / directory `pendingReportCount` aggregate unresolved `pending` and `needs-more-info` reports. They include updates to located copies, and never include private reporter text, review notes, receipt tokens, or pending images. An unlocated copy with an open report is **Under Review**, not found; one without an open report is **Unreported**. Located/confirmed copies keep their approved status while showing a separate update-review count. Closed statuses leave this count. This is a read-time projection, not a stored status migration.

1. A signed, card-bound submission session creates one report. Identical retries return the same receipt; a different payload for that session returns 409 instead of silently losing edits.
2. File safety and source screening remain separate from factual verification. Missing or flagged checks do not acquire an override through the new workflows.
3. Moderators can approve, reject, request information, mark duplicate, or mark cannot verify. Merged evidence must belong to the same copy and all selected reports must remain unchanged and pending until the atomic commit. Merged price/grading observations and context are retained as child events governed by the parent approval; corrections must be reviewed separately.
4. Needs Info requires a message. In the current admin form the review-note field is explicitly labeled as shared for that action only. Other review notes are private.
5. The receipt includes a private `/reports/{originalTracker}/{reportId}#token` link. Its domain-separated signature expires after 90 days. The token stays in the URL fragment, is sent in `x-report-token`, and is not a public report identifier or an admin permission. Protect the link like a password. Rotating the session secret invalidates existing links.
6. A token holder can view a minimal receipt and answer a needs-info request with a supported source link, bounded plain text, owned attachments, or a combination. A link alone is enough. `followUps[].sourceUrl` stores the canonical HTTPS source; original report fields and payload hashes stay unchanged. New files use fresh one-hour upload permission for the original report and undergo the same image checks. Replying appends review history and returns the report to pending. Same-ID retries compare the normalized source, notes and attachment IDs before and inside the atomic mutation; changed reuse fails instead of replacing history. New replies cap distinct report sources at eight.
7. Receipt pages are noindex/no-referrer and do not load site analytics. Replies are rate-limited. There are no accounts, automatic email notifications, or contact-address collection in this milestone.
8. Admins can reopen needs-info/rejected/cannot-verify/revoked reports with a reason. Merged duplicates can be reopened after their parent approval is retracted. Approved reports require retraction first. Reapproval reruns safety checks and creates a new event ID, even if its timestamp matches an earlier approval.

Reviewer identity is now the configured owner ID from the authenticated server-side session, not a caller-supplied name. Owner login requires production TOTP and supports revocation/idle expiry. This is one owner account, not named multi-moderator access; see docs/SECURITY_OPERATIONS.md.

## Legacy Reconciliation

Public reads/writes fail closed with a reconciliation-required error if historical facts still exist in an alias slot. They do not silently choose one history. Empty existing trackers need no destructive migration.

An authenticated administrator can:

1. GET `/api/admin/reconcile-copies` for the current revision and side-by-side legacy/canonical candidates. This preview does not write data. Initialize any still-uninitialized legacy-key owner through its normal tracker read first.
2. Review every candidate and explicitly choose `keep-canonical` or `adopt-legacy` per copy ID.
3. POST the returned `revision`, `confirm: "RECONCILE_SHARED_COPIES"`, and the `decisions` array to the same endpoint. Each decision is `{copyId, choice}`. This is a deliberately privileged data selection, not an automatic evidence merge.
4. A single CAS transaction archives the original raw records at `copy-reconciliation:v1:{uuid}`, writes the chosen owner facts, and clears alias facts. A stale revision aborts without writing. Original reports remain associated with their original tracker/slot. The unselected historical snapshot is retained in the private archive for further review.

No reconciliation has been run against production. Reconciliation archives are included in the encrypted recovery runner; its hosted workflow still needs activation and verification.

## Backups And Release Gates

Schema-v2 tracker exports contain canonical view data, journals, grading/price history, and report origin/review metadata. Import accepts v1 and v2, validates nested history and origin identities, and retains concurrent changes outside the restored view. Restoring a shared copy intentionally affects every page showing that copy; do not treat an alias export as an independent database.

These per-tracker exports still do NOT back up private Blob bytes or `evidence:v1:*` metadata. The separate encrypted recovery runner includes both plus reconciliation archives; see docs/SECURITY_OPERATIONS.md. Its hosted activation and restore drill remain unverified. Complete evidence-aware backups, isolated hosted provider testing, cleanup/retention, durable scanners, false-positive escalation, and named moderator roles before broad intake. No production credentials, discoveries, or affiliate settings were changed by this work.

## Local Verification

Follow-up source extension (2026-09-07): stored reply sources count toward discovery eligibility, inbox source indicators, admin review and every approval/merge reputation check. Approval appends separate link-only sighting events governed by the primary approval, preserving the original card source when present and exposing a follow-up source when none existed. Private reply text is not copied to public facts. Retraction removes all child-source contributions. Backup validation accepts old note replies and new canonical source replies and rejects duplicate reply IDs/noncanonical URLs.

- 307 tests across 23 files cover shared identities, queues and evidence ownership, repeat reports, old/new transactions, merged observations, regrades/ungraded events, corrections, stale merges, retractions, private-token expiry and replay, follow-up replies, origin-aware restore, and archived reconciliation.
- Lint and the production build passed. The existing missing TypeScript dependency source-map warning is unrelated to these tests.
- The actual Upstash SDK, including its default pipelining and base64 encoding, exercised shared-copy CAS and archived reconciliation against the loopback-only fakeredis/Lupa fixture. No cloud database was used.
- Headless Edge/Playwright checks passed at 320, 390, and 1440 pixels for report fields, correction review, price/ungraded requests, public history, private replies, and absence of horizontal overflow/runtime errors. Browser API responses were intercepted; this does not verify hosted authentication, Turnstile, Blob, or scanners.
- An attempted separately configured app test server was blocked by the tool environment. It was not bypassed; browser checks used the ordinary local preview with mocked API data instead. No production configuration was changed.
