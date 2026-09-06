# Owner Security And Recovery

Implemented and deployed on 2026-09-05. This is an operations guide, not a claim that every provider is configured or a penetration-test certification. The owner dashboard and security code are live; hosted owner login, evidence-provider setup and restore verification remain gates. See docs/DEPLOYMENT_2026-09-05.md. The Golden Chocobo project and affiliate destinations/disclosures are unchanged.

## Owner Access

The current permission model is one owner, not a shared moderator pool. The server derives `ADMIN_OWNER_ID`; clients cannot choose an identity or grant a role. Every privileged route checks a Redis-backed owner session. Reviews retain the owner ID in their private review history. Multi-person accounts, invitations, moderator-only permissions and a comprehensive external audit log remain separate work. Do not share the owner's credentials with future moderators.

Production requires:

- `ADMIN_OWNER_ID`: stable non-secret identifier, for example your chosen owner handle. This is attribution, not an email-verification system.
- `ADMIN_PASSWORD_FRONTEND`: independently generated password of at least 16 characters. Keep it in a password manager. This is server-only despite the name; never add `NEXT_PUBLIC_`, include it in Next.js `env` configuration, or send its configured value to the browser.
- `ADMIN_SESSION_SECRET`: independently generated secret of at least 32 characters. This existing secret also signs collector report permissions/receipts.
- `ADMIN_TOTP_SECRET`: random base32 authenticator seed, 32-128 characters, enrolled in your authenticator before deployment. The supported standard is TOTP, SHA-1, six digits, 30-second period. Keep an offline recovery copy in your password manager. Never put it in chat, Git, screenshots, or a third-party QR generation website.

For enrollment, the installed OTPAuth library can generate a seed locally: `node --input-type=module -e "import { Secret } from 'otpauth'; console.log(new Secret({ size: 20 }).base32)"`. Run this yourself in a private terminal, enter the seed in your authenticator and the matching Vercel environment variable, and remove the terminal output from shared records. This command is documentation only; no owner seed has been generated or shown by the agent.

Password-variable migration: `ADMIN_PASSWORD_FRONTEND` replaces `ADMIN_PASSWORD` as the sole login password source. Set the new variable in Vercel Production before deploying this code, and separately in Preview/Development wherever owner login is needed. The old variable is ignored, including when the new value is missing or too short. Password comparison, session invalidation and TOTP replay protection all use the new value. Do not change the authenticator seed or session secret just to switch password variables.

Development still requires an explicit password and session secret; the old `dev-admin` fallback is removed. An explicitly configured TOTP seed is checked in every environment, and production has no password-only bypass. Preview production builds therefore also require enrolled MFA, with separate preview secrets.

Sessions use random 256-bit opaque tokens. Redis stores only their hashes and owner metadata. They expire after 30 minutes of inactivity or eight hours absolute. Logout removes the server record. Password, owner-ID, MFA-seed, or session-secret changes invalidate existing sessions. Old stateless cookies are rejected. TOTP steps cannot be reused for simultaneous logins. Redis failure denies privileged operations rather than accepting an unverifiable session.

Cookies are HTTP-only, Secure in production, SameSite=Strict, and no-store responses protect login state. Mutations including login/logout require a matching Origin or browser `Sec-Fetch-Site: same-origin`. Scripts using an admin cookie must send the exact Origin. Never weaken this to accept arbitrary origins. Production CSP no longer enables `unsafe-eval`; nonce-based removal of `unsafe-inline` remains future framework work.

If a device or password is compromised, rotate the owner password to invalidate sessions. If the authenticator is lost, rotate the seed through your secured Vercel account and enroll it again. A password rotation does not break collector receipt links; rotating `ADMIN_SESSION_SECRET` does. Enable MFA on Vercel, GitHub, Upstash and all provider accounts, and protect the main branch. There is no self-service owner reset or recovery-code endpoint to attack.

## Owner Dashboard

`/admin` is the dedicated owner workspace. Its initial HTML contains no report records, evidence, configuration values or authenticated identity. Inbox and configuration APIs authenticate every request. The page/API responses are private/no-store, the page is noindex/no-referrer, and site analytics are excluded. Login uses the existing password/TOTP flow, and session checks on returning to the tab remove private state after revocation/expiry. A failed logout does not pretend the server session was removed.

The Reports view supports status/tracker filters, cursor navigation and focused review inside the page. Approve, merge, reject, needs-info, cannot-verify, reopen and retract actions reuse the tracker review implementation and its atomic writes, original evidence ownership and scanner gates. Reviewed source links also require the existing reputation check before opening. No public evidence links or scanner overrides were introduced. Card metadata editing, per-tracker export/import and affiliate analytics remain in the existing tracker admin tools.

The inbox reads original storage, not projected alias queues, and selects featured trackers plus the existing active-printing index. A page returns at most 20 summaries and reads at most eight report arrays. It is grouped by tracker slug, then oldest submission timestamp/report ID, not globally chronological. Cursors bind to filters and use a stable last-report key, so approving an earlier row does not shift subsequent offsets. New/changed records before the cursor appear on refresh; this is not an immutable snapshot. Empty batches may have a continuation. No total-count or completeness claim is made from a partial page. Independent report/event records, index audits and fully bounded per-report reads remain the scaling milestone.

Service setup returns only presence/configuration booleans, never credentials. Configured does not prove private-store access, valid provider credentials, scan quality or successful cloud tests. Scheduled backup/restore verification cannot be inferred from the application environment and is explicitly not verified in this view.

The owner reports enrolling a regenerated Base32 seed in Google Authenticator and updating Vercel. Production owner variable names were confirmed without reading values. Application release `7ad9ceb` is live at `https://mtgtrackers.com/admin`; anonymous MFA status, access denial and browser rendering passed. Actual password/TOTP login and logout are awaiting the owner test. Do not confuse the local preview with production or infer secret validity from variable presence. Local review checks use intercepted browser APIs and benign synthetic reports; no production reports were created.

## Public Request Budgets

- Login: 10 attempts/IP/15 minutes, 100/site/15 minutes.
- Telemetry: 120 requests/IP/hour, 20,000/site/day across affiliate/directory/promotion endpoints. Bodies are limited to 8 KiB. Only known filters, sorts, cards, catalog treatments and bounded serial/slot values create context keys. Free-form text is limited to expiring last-event records. Daily counters and last-event records expire after 90 days. Finite lifetime counters remain.
- Evidence reads: 300/IP/minute before loading metadata/files. Public reads still recheck clean safety status, canonical approval and provenance; no-store remains intentional for takedown. This is not a promise of protection against distributed traffic. Add platform WAF/bot controls and bandwidth/spend alerts before promotion.
- Health: read-only Redis PING, minimal `{ok}` response, short shared-cache lifetime on success; no public write/delete probes or raw exceptions. It verifies connectivity, not write permissions or the scanner/Blob lifecycle.

Rate limits are application controls, not replacements for Vercel firewall controls. Verify that the deployment overwrites forwarded-IP headers and has no exposed origin allowing spoofing. Keep temporary limits separate from permanent data; do not enable database eviction on canonical records. Review historic telemetry separately: the new policy repairs daily expiry on touched keys but does not sweep untouched pre-existing keys. Existing large or arbitrary legacy analytics keys need an explicit dry-run cleanup before deletion.

## Encrypted Recovery Backups

Tracker JSON export/import remains a limited per-view administrative tool. It is NOT a complete image backup. The new recovery runner includes:

- Existing live tracker cards/submissions and their histories, including consistent snapshots of related shared views and retained configured legacy card keys.
- `evidence:v1:*` metadata and all private `quarantine/` image files, including held images and unreferenced files.
- `copy-reconciliation:v1:*` archives and an active-printing index rebuilt from captured records.

It excludes sessions, credentials, rate-limit/IP keys and affiliate analytics. Source code/catalog/configuration remain in Git; the manifest records the workflow revision. External legacy image URLs are retained as references, not downloaded. Retain the matching Git revision for recovery.

Each part and the final manifest use AES-256-GCM with a fresh random nonce, authenticated record identity and SHA-256 integrity checks. The encryption key is independent of application secrets. Only a completed archive has `manifest.enc`; partial runs are not recoverable backups. Missing referenced evidence, file/hash mismatches, invalid paths and oversized parts fail the run. Bounded limits are 32 MiB/record, 4 MiB/image and 100,000 parts; growth beyond these limits requires a reviewed streaming design, not silent truncation.

Consistency is atomic per related tracker group, not a globally instantaneous database snapshot. Evidence is immutable, but there may be uploads/updates after a group's snapshot. Unreferenced interrupted-upload metadata can exist without a file. Backups do not implement point-in-time recovery; pair them with provider recovery options and retention policies appropriate to the data.

### Enable Nightly Backups

1. Generate an independent 32-byte random key encoded as 64 hex characters for `BACKUP_ENCRYPTION_KEY`. Keep an offline recovery copy outside GitHub; losing it makes backups unreadable. Keep old keys for the archives they encrypted.
2. Create a protected GitHub environment named `recovery-backup`, restricted to trusted `main` deployments. Add source Redis URL/token, private `BLOB_READ_WRITE_TOKEN`, and `BACKUP_ENCRYPTION_KEY` as environment secrets. Prefer a read-only Redis token for this source-only runner. Blob's token is sensitive and must never be placed in frontend variables.
3. Set repository variable `BACKUPS_ENABLED=true`. The workflow is otherwise disabled. Its pinned actions, read-only repository permission, and trusted-main condition do not replace GitHub account/branch protection.
4. Run the workflow manually and confirm success. Only then rely on its daily schedule. It uploads encrypted artifacts with 30-day retention. Artifacts may be downloadable by others if the repository permits it; encryption, independent key storage and strict environment access are essential. Consider longer-lived storage in a separate account according to the recovery policy.
5. Enable GitHub workflow-failure notifications. Agree on a recovery objective: initially propose at most 24 hours of loss and a same-day recovery. These targets are not validated until a timed hosted restore drill succeeds.

Locally, the runner consumes environment variables already present in the process; it does not automatically load `.env` files. Use `npm run backup -- backups/RUN-ID` with an existing parent folder and a new final directory. `npm run backup:verify -- backups/RUN-ID` authenticates every part without any cloud credentials or writes. Never put private plaintext dumps in the repository.

### Isolated Restore Only

Use newly created Redis and private Blob stores that are not attached to an active application. Set `RESTORE_REDIS_REST_URL`, `RESTORE_REDIS_REST_TOKEN`, `RESTORE_BLOB_READ_WRITE_TOKEN`, `RESTORE_ISOLATED=true`, and `RESTORE_CONFIRM_TARGET` to the exact destination Redis origin. Use the archive's encryption key. Run `npm run backup:restore -- backups/RUN-ID`.

Restore authenticates all parts before writing, rejects the source Redis origin/source Blob credential, requires empty targets, claims Redis atomically, disallows overwriting files, and verifies restored image bytes and database strings. It does not copy live login sessions or activate a site. An interrupted restore leaves `mtgtrackers:restore-in-progress` and must not be served. Do not point the site at a partially restored store; investigate and use fresh isolated targets rather than deleting live data. No automatic cleanup or rollback is run against either environment.

After restore, verify shared-copy counts/history, owner login, private pending-image denial, approved-image access, revoke/takedown, and new upload/scan/approve. Test provider outages and corrupted archives. A hosted drill with actual storage/providers has NOT been performed yet. Local synthetic fixtures prove software behavior only.

## Remaining Release Gates

- Complete the owner production login/logout test and configure separate isolated Preview secrets; Preview owner ID/TOTP are currently absent. The owner reports enrollment and Production variables exist, but successful hosted authentication has not yet been observed.
- Activate and validate hosted backups, test actual restoration, and configure spend/failure alerts.
- Complete actual private Blob, Turnstile, malware/sexual-content scanners and Web Risk setup/tests. Known-threat link screening is not adult-content classification or authenticity verification.
- Add durable scan jobs, cleanup/retention and false-positive/takedown handling; keep scans fail-closed.
- Add independent paginated report/event storage and opt-in owner notifications. The unified owner inbox exists, but its backing tracker arrays and selected-tracker detail queries still need the independent-record migration.
- Add request IDs for retried admin price/grading/image edits; current public-report retries are protected but these admin writes can still repeat after a lost response.
- Correct whole-site affiliate rollups to include active generated trackers efficiently. Click telemetry is not proof of merchant commission credit.
- Add multi-user moderator roles and a comprehensive protected audit trail before inviting other reviewers. Current review history records the configured owner, but this is not a general-purpose identity provider.

References: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP file uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [OTPAuth](https://github.com/hectorm/otpauth), [Vercel private Blob](https://vercel.com/docs/vercel-blob/private-storage).
