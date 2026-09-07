# Admin Save Reliability And Upload Inventory

## Scope

This pass protects price/grading/image saves from duplicate history after uncertain responses and adds a read-only owner upload inventory. The owner deferred backup setup on 2026-09-06. No recovery workflow is activated, no collector records/files are deleted, and no screening gates are relaxed. The separate Golden Chocobo repository and affiliate configuration/disclosures are unchanged.

## Admin Saves

- Every edit requires a v4 UUID `Idempotency-Key`, bound to the server-derived owner, exact printing copy, edit kind and normalized payload digest.
- The event and private receipt commit together through the existing related-record compare-and-set. Simultaneous identical requests append once. Changed-payload or different-owner reuse returns 409.
- A previously committed request returns the current card, not the old result. Retrying cannot undo later edits or reapply retracted history, and does not depend on a source provider being available again. New edits retain all source/image safety checks.
- Browser saves coalesce in-flight double clicks and retain an opaque pending ID in tab-local session storage after failure. Only a digest and UUID are stored, never form text or credentials. Same values in the same route after reload reuse that ID; a changed request or a deliberately new save after success gets a different ID.
- Receipts live in the retained card journal, including across One Ring/poster aliases. Backup validation accepts old journals without them and validates new receipts. Public card responses exclude the receipts. Restoring a snapshot from before the edit also removes its receipt; no claim of deduplication across discarded history is made.
- Refresh any tracker admin page opened before this release. Old clients without the header receive a validation error instead of making an unprotected write. If tab storage is disabled, retry IDs survive only in memory.

## Inventory

Open `/admin` -> Service setup -> Upload retention -> Check inventory. Fetching is explicit, not automatic. Responses contain only an asset UUID, card label, tracker slug, timestamp, byte count and classification when available. There are no Blob locations, report tokens, upload hashes, scanner details or deletion controls. Signing out clears the view.

| Status | Meaning |
| --- | --- |
| Report or history retained | The asset, its app evidence URL, or its owning report ID occurs in related current/legacy card or report records. Rejected, duplicate, cannot-verify, needs-info and retracted reports also retain their associated assets. |
| Within retention window | Less than seven days have passed since the later of creation and upload-session expiry. No abandonment inference is made. |
| Potentially abandoned | Older valid metadata has no matching reference in readable, validated related current/legacy records at this check. Investigate; this is not deletion approval. |
| Needs investigation | Metadata, references or identity could not be safely validated, including read/size limits, corruption and provider failure. |

The seven-day grace period is an investigation heuristic, not a final retention/deletion policy. An owning report retains even an asset detached from its current attachment list. Baselines, withdrawn journal events and shared aliases are searched conservatively.

The owner-only, same-origin POST endpoint allows 120 batches/hour site-wide. Each batch returns at most 20 records. Redis SCAN's count is a hint; surplus IDs are carried in a bounded cursor, and batches over 100 keys fail rather than silently truncate. Metadata reads are limited to 16 KiB each; reference reads cover at most eight related tracker groups at 2 MiB/group, including configured legacy card keys. Validation/reference-walk budgets turn uncertainty into Needs investigation. Collector arrays are never initialized or changed; authentication and rate-limit counters still operate normally.

This is a point-in-time metadata inventory, not a complete file audit. SCAN may repeat/omit records while storage changes, and a batch can be empty with a continuation. It does not enumerate Blob files lacking metadata, verify file existence/bytes/hashes, rescan content, or inspect every external archive. Candidate status must never be used as an automatic delete instruction. Future cleanup requires verified complete backups, an agreed retention policy, fresh reference checks and audited removal.

## Verification

Local unit/route coverage includes same-key concurrency, changed-payload conflicts, lost commit responses, retraction, shared aliases, restore, public receipt redaction, all report statuses, legacy references, grace periods, malformed/oversized records, pagination, authentication and same-origin denial. The actual Upstash SDK/Lua fixture also exercises bounded read-only inventory snapshots against loopback-only Redis emulation.

Browser checks use intercepted APIs and benign fixtures, not hosted owner credentials or production discoveries. They cover failed-save retry after a page reload and inventory failures, pagination, logout clearing and narrow-screen layout. Final release results are recorded in TODO.md. These checks do not prove a real hosted scanner lifecycle, backup activation or recovery.
