# CLAUDE.md

Engineering guidance for MTG Trackers.

## Project Boundary

This is the standalone repository at `mtg-serial-tracker`, deployed at https://mtgtrackers.com from https://github.com/tafokints/mtgtracker.git. Do not edit the parent Golden Chocobo app. Next.js 15 App Router, React 18, Upstash Redis/Vercel KV, and Vercel Blob are already implemented.

Read `TODO.md` for the current priority queue, `ARCHITECTURE.md` for invariants, and `README.md` for setup and operational commands. Older checked roadmap entries describe completed features, not verification of production configuration.

For Turnstile maintenance, the owner-approved canonical Spin bundle is in `.claude/skills/turnstile-spin/SKILL.md`. Read docs/INTAKE_SETUP.md for this project's existing widget, action, environment-name mapping and verification checkpoint. Preserve those choices. The saved bundle is reference material, not authorization for credential access: secret-bearing commands must follow the hosted guide's approved external executable, confirmation and stdin-only rules, never project-local helper execution.

## Work Loop

1. Inspect the worktree and nearby code; identify one concrete outcome and its acceptance checks.
2. Fix collector trust, data loss, and security issues before adding promotional UI.
3. Use tracker configuration and generic routes. Keep all changes inside this repository.
4. Run relevant regression tests, `npm run lint`, and `npm run build`.
5. For affiliate changes run `npm run links:validate`; for deployments run `npm run smoke`.
6. Update TODO.md with completed work, evidence, and remaining issues. Report limitations honestly.
7. Stage intended files and commit; push when the ongoing user-authorized deployment flow calls for it.

## Essential Invariants

- `trackers` is only the featured list. `allTrackers`/`getTracker` include generated printing trackers; Golden Chocobo migration remains deferred.
- Catalog hierarchy is set -> treatment -> printing -> numbered tracker. Refresh the reviewed Scryfall snapshot with `catalog:sync`; unknown treatments need manual mapping and sourced quantities. Non-English and unreleased printings are reference-only.
- Generated printing storage uses Scryfall IDs. Mutations/restores atomically maintain the active-printing index; do not scan every empty tracker for the homepage feed.
- Use `getTrackerTotalSlots` for whole-tracker counts. Poster Cards has 2,000 slots, not 100.
- Use `src/lib/tracker-store.ts` for mutations. Separate GET/edit/SET operations can lose concurrent updates.
- Mutation callbacks may retry. Keep them synchronous with no uploads, notifications, or external side effects.
- Approval must commit card changes and report statuses together.
- Public reports never directly change canonical discoveries. Images are not proof merely because reference artwork exists.
- Preserve printing-based copy IDs, tracker-local slot IDs, and launched card-definition order. One Ring/poster routes share owner facts and report queues through related-record CAS. Historical alias facts require explicit, archived reconciliation; see docs/DATA_MODEL.md.
- Append events for discoveries, corrections, pricing, grading, image selection, and retraction. Do not directly overwrite journal-derived facts. Keep asking prices separate from completed sales and do not infer owners/sellers from reporters. Preserve original evidence ownership when projecting reports between routes.
- Preserve existing data and legacy keys. Never run destructive reset/import/restore tests against production.
- Require admin authentication for privileged routes. Missing production credentials must fail closed.
- Do not commit credentials, cookies, local environment files, database dumps, or private evidence.
- Upload files are decoded/re-encoded into private Blob storage, bound to a signed report session and exact serial. Reject arbitrary external evidence URLs. Pending/error/flagged safety checks must never be bypassed in review, merged evidence, or admin image overrides. The public evidence route additionally requires canonical approval and matching report ownership. See docs/EVIDENCE_SECURITY.md.
- Mocked storage/scanner tests do not prove real cloud upload/read/delete or real content classification. Detaching evidence is not deletion; retention is pending. Encrypted asset/file recovery tooling exists, but its hosted activation and restore drill are pending.

## Configuration

Vercel uses the standalone Git repository root (`.`). Redis accepts either UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN; use a write-capable REST token. Production owner sessions need ADMIN_OWNER_ID, strong ADMIN_PASSWORD_FRONTEND/ADMIN_SESSION_SECRET and an enrolled ADMIN_TOTP_SECRET. ADMIN_PASSWORD_FRONTEND is a server-only secret despite its name, with no fallback to ADMIN_PASSWORD; never expose it in browser configuration. Sessions are revocable with idle/absolute expiry; every admin guard is asynchronous and must be awaited. Read docs/SECURITY_OPERATIONS.md before authentication or recovery changes. Public reports require configured Turnstile; private Blob supports a connected BLOB_STORE_ID with SDK-managed Vercel OIDC or a static BLOB_READ_WRITE_TOKEN. Never copy or manually pass the Vercel identity token. Image approval requires both scanners and source-linked approval requires Web Risk. Use .env.example, docs/INTAKE_SETUP.md and docs/EVIDENCE_SECURITY.md. The owner-confirmed storage diagnostic never accepts paths or changes collector data; it is not a scan/workflow certification. Never enable public fallback uploads or a production challenge/scanner bypass.

The user-approved TCGplayer redirect is generic: label it accordingly. Preserve affiliate IDs in configuration; do not invent tracking IDs or claim link checks prove commission credit. eBay/Amazon product queries must match the printing and distribution product. Official merchant reports are needed for earned revenue.

Keep a visible affiliate disclosure at the top of every page containing affiliate links, before the first affiliate link, including on mobile and new generated pages. The owner requires this placement because of prior eBay compliance feedback. It is not redundant UI to remove during design cleanup; a footer-only notice is not a substitute. See ARCHITECTURE.md for the standing requirement.

## Product Priorities

Current phase: infrastructure readiness. Zero production discoveries is acceptable and is not a launch blocker. Use isolated fixtures to verify populated workflows; defer discovery acquisition and audience growth to the later TODO queue.

Prefer evidence-backed discoveries, source provenance, reliable review, searchable card/serial identity, and mobile usability. Use shared theme configuration for aesthetic differences. Refer to the current TODO queue instead of recreating completed uploads, backups, filters, or analytics.
