# Protected Evidence Intake

Implemented 2026-09-05. This is the first protected-intake milestone, not a completed production safety certification. The parent Golden Chocobo project is untouched. Affiliate IDs and top-of-page disclosures are unchanged.

## Flow

1. Choose a tracker/card/serial and optionally select local photo files, a supported source link or notes. Photos have local-only previews until Submit; selection and removal of unsent files make no storage request. Confirm permission under the privacy notice before sending anything.
2. Complete Turnstile. The server verifies success, hostname, and action `discovery`, then signs a one-hour report permission using a domain-separated ADMIN_SESSION_SECRET signature.
3. Upload at most eight JPEG/PNG/WebP images. The server bounds actual bytes, decodes pixels, removes metadata, and stores a WebP privately. Browser previews use local object URLs, not remote evidence URLs.
4. Each file has a separate Redis record `evidence:v1:{uuid}` with report identity, private path, SHA-256, dimensions, timestamps, and scan result. Raw storage addresses and bearer permissions are never included in public records or logs.
5. Cloudmersive checks the stored WebP for malware. Azure AI Content Safety checks a PNG derivative for sexual content. A sexual severity above zero is held; this conservative policy can flag legitimate artwork. Missing configuration is pending; errors/timeouts remain error; only explicit valid successes produce clean. Clean/flagged are terminal for an immutable asset; authenticated retries only process pending/error states.
6. Public submit binds uploaded IDs to the signed report and selected slot, then creates a pending report with immutable original facts. Identical retries return the original ID; differing payloads return 409. A private receipt link permits bounded needs-info replies and additional owned files, without overwriting original facts. Different card/serial selections require a new permission and new uploads. See docs/DATA_MODEL.md.
7. Admins inspect clean private evidence and use Check source link before navigating to a source. Approval rechecks source reputation and all selected merged evidence. Any changed report snapshot aborts approval; cards/review status commit together.
   An unlocated copy additionally needs a supported structured source (including grading sources) or owned protected attachment on those selected reports. Reference artwork, plain-text notes, prices and certificate numbers alone do not qualify. The atomic callback rechecks the current copy to handle concurrent retractions. Already located copies may receive context-only updates, but those events cannot establish location or strengthen verification. UI eligibility never substitutes for server-side safety checks.
8. Images remain in private storage after approval. The app serves them only when the asset is clean and both approved report lineage and canonical found-card references match. Shared views retain original upload ownership. Responses are no-store and bytes must match the stored hash. Use the audited revoke action to remove an approval's contributions; directly editing a derived card field does not change its journal. Retraction prevents subsequent app reads, not retrieval of copies someone already downloaded.

The simplified form (2026-09-06) keeps pricing, grading, discovery dates/names and source-type overrides optional. It no longer assigns an evidence-quality score or offers Looks Confirmed: supported links request source-linked review, otherwise the form requests unverified review. Admin approval and all server checks are unchanged. The shared file-size constant keeps the browser convenience check aligned with the server; MIME labels are not trusted as proof of safe bytes. Photo-only and note-only reports are still pending reports, not discoveries.

Submit uploads selected files under the exact-copy permission before sending the report. Partial failures retain both successful IDs and failed local files for retry, with no incomplete report silently sent. Lost report responses reuse the same permission and evidence IDs. A changed copy or expired permission requires fresh uploads; local files remain selected but old remote IDs are not reused. Drafts and original files stay in browser memory only and are lost on reload/navigation. Removal after an upload still detaches rather than deletes; no cleanup policy changed.

## Service Setup

Use separate Redis/Blob stores and credentials for isolated testing and production. Do not put development fixtures in the live database.

| Variable | Value/source |
| --- | --- |
| `BLOB_STORE_ID` | Connected **private** Vercel Blob store. The installed SDK obtains/refreshes Vercel OIDC automatically; do not manually copy a Vercel identity token. |
| `BLOB_READ_WRITE_TOKEN` | Optional static-token alternative for a **private** store, still required by the separate off-Vercel recovery runner. An existing public store cannot simply be switched to private. |
| `ADMIN_SESSION_SECRET` | Strong server-side secret; owner credential rotation invalidates sessions. Also used with a separate signing context for report permissions. |
| `ADMIN_OWNER_ID` / `ADMIN_TOTP_SECRET` | Owner identifier and enrolled authenticator seed; production owner login requires both. See docs/SECURITY_OPERATIONS.md. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key. Configure before building the frontend. |
| `TURNSTILE_SECRET_KEY` | Matching server-side Turnstile secret. |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Exact comma-separated domains expected in server verification, e.g. `mtgtrackers.com,www.mtgtrackers.com`. Use separate explicit test hostnames in isolated environments. |
| `CLOUDMERSIVE_API_KEY` | Cloudmersive Virus Scan API key. Requests use the fixed HTTPS file-scan endpoint and sanitized image bytes. |
| `AZURE_CONTENT_SAFETY_ENDPOINT` | Your resource origin, e.g. `https://YOUR-RESOURCE.cognitiveservices.azure.com`. Other hosts are rejected. |
| `AZURE_CONTENT_SAFETY_KEY` | Azure AI Content Safety resource key. |
| `GOOGLE_WEB_RISK_API_KEY` | Restricted Google Cloud key authorized for Web Risk. The app uses the commercial URL Lookup API, not the noncommercial Safe Browsing API. |

Do not paste secret values into chat or commit local environment files. Review providers' current billing, data processing, region/retention terms, and account limits before activating them. The privacy notice discloses sharing sanitized files, image derivatives, URLs, and challenge signals with these providers. No accounts, paid plans, or live scanner calls were created by this implementation.

No Turnstile configuration means public intake is unavailable, with a visible form notice. No Blob store connection or static token means uploads return 503; provider authentication failures also deny uploads. Missing image scanners allow private quarantine only: no preview or approval. Missing Web Risk means source opening and source-linked approval return 503. Notes-only reports still require Turnstile and human review. There is no production bypass.

The owner reports creating a private Blob store, and the Vercel connection now includes `BLOB_STORE_ID` for Production and Preview. This is not yet an isolated Preview environment. The owner dashboard has an explicit storage diagnostic for private upload/read/anonymous-denial/delete; passing it does not verify image scanning or the report workflow. Follow docs/INTAKE_SETUP.md before activating the remaining services.

## Link Policy

Supported direct HTTPS sources currently include US eBay item pages, TCGplayer products, Reddit comments, X/Twitter posts, Instagram posts/reels, PSA/CGC certificates, and Wizards articles. Hostnames and paths are matched exactly in `src/lib/evidence-policy.ts`; arbitrary subdomains, IPs, userinfo, nonstandard ports, shorteners, redirect endpoints, and remote image URLs are rejected. Query strings and fragments are discarded. Other sources should be described as plain text in review notes until explicitly supported.

The server never fetches submitted sites, follows their redirects, or embeds untrusted remote images. Web Risk sees the source URL and checks known malware/phishing/unwanted-software lists. This is NOT adult-content classification of linked pages and NOT a guarantee that a platform post is appropriate. Human reviewers must inspect the destination, card/serial, visible private information, image relevance, and provenance. Platform content can change later; periodic rechecks/takedown remain TODO. Notes are plain text, never HTML or automatically linked.

Private Needs Info replies use this same source policy. The optional `sourceUrl` is normalized at intake, must be a supported direct HTTPS page, and remains plain text in the private receipt. A link-only reply is valid; entirely empty replies are not. New replies cap the report at eight distinct sources (original, grading and follow-up combined). Reply sources never overwrite original facts. The owner selects a stored reply ID for Check source link; client URL fields cannot redirect that check. Approval checks all sources again, including merged reports, then rejects changed snapshots. Only approved source events become public; private reply notes are not automatically published. Missing/flagged/unavailable Web Risk still blocks source opening and approval.

## Storage And Recovery Limits

- Upload records precede Blob writes, leaving reconcilable records if storage or the request fails. A deterministic UUID pathname permits future orphan reconciliation without retaining personal filenames.
- Upload budgets: 8 attempts/session, 10/IP/hour, 500/site/day. Reports: 5/IP/tracker/hour, 10/IP/site/hour, 1,000/site/day. Rate-limit increment/expiry is atomic. Trust forwarded IP headers only behind the deployment's trusted proxy; do not expose an unprotected origin.
- Scanning is currently bounded synchronous request work (60-second route budget), with authenticated, rate-limited retry for pending/error assets. Durable jobs, backoff, and automated reconciliation remain TODO.
- Attachment removal only detaches an unsent form entry; it is not physical deletion. The owner-only Upload retention inventory can inspect bounded metadata/reference batches without fetching files or deleting data. Its Potentially abandoned label is an investigation hint, not removal authorization; all report statuses and retained history keep associated evidence out of that list. See docs/ADMIN_RELIABILITY_2026-09-06.md. Retention enforcement, orphan cleanup, audited removal and takedown tooling remain TODO. Backup setup is deferred by the owner; recovery is unverified and deletion remains disabled.
- Existing tracker export/import backs up cards and submissions, NOT Blob bytes or `evidence:v1:*`. The separate encrypted recovery runner now includes records/files and reconciliation archives; activation and a hosted restore drill remain required. See docs/SECURITY_OPERATIONS.md. Missing asset metadata fails closed on read, rather than silently trusting an imported URL.
- Owner login uses revocable server-side sessions, server-derived owner attribution and mandatory production TOTP. `/admin` now provides an all-tracker owner inbox with in-page review through the existing safety-gated APIs. Separate moderators, independent report storage and comprehensive auditing remain future work. See docs/SECURITY_OPERATIONS.md.
- Previously approved external images are not automatically migrated or deleted. Pending legacy external evidence must be re-uploaded before approval. Review/import historical data deliberately; do not silently rewrite production records.

## Verification

Local tests exercise real image decoding/re-encoding and the route lifecycle with mocked Blob and provider responses. Cases cover successful review/publication, private pending access, hash mismatch, ownership, token tampering/expiry, unsupported links/images, body limits, scan holds/outages, immutable results, source failures, stale approvals, concurrent edits, and cross-origin admin requests. They use generated benign images and simulated threat classifications, not real pornography or malware.

Checkpoint results: 282 tests passed across 21 files; lint and production build passed. The actual Upstash SDK and Lua scripts passed against an isolated local fakeredis/Lupa REST fixture, including terminal scan results and atomic rate-limit expiry repair. Headless Edge/Playwright checks passed at 320, 390, and 1,440 pixels: serial preselection, removed external-image controls, disabled intake without setup, no horizontal overflow, and no page runtime errors. Additional isolated browser fixtures at 390 and 1,440 pixels verified that flagged/legacy evidence is not requested or embedded, approval is disabled, and source links require checking. Authentication and queue data were intercepted only inside that browser fixture; this does not prove hosted authentication, provider calls, or cloud Blob operations. A pre-existing missing TypeScript dependency source-map warning remains in test output.

Read-only production checks at this checkpoint passed: the health endpoint reported Redis read/write/delete connectivity and One Ring returned 100 slots with zero discoveries. These checks concern the existing live deployment, not activation of this new pipeline. No production discovery or review was created by this work.

Before opening intake broadly: run an isolated hosted upload/read/scan/approve/revoke/delete cycle with the actual services, test challenge success/expiry/replay and scanner outages, add retention and complete evidence-aware backup/restore, then set production credentials and redeploy. Do not claim mocked checks prove real cloud behavior or perfect threat detection.

## Primary References

- [Vercel private storage security](https://vercel.com/docs/vercel-blob/security)
- [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- [Cloudflare server-side challenge verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudmersive file malware scanning](https://api.cloudmersive.com/docs/virus.asp)
- [Azure image content analysis](https://learn.microsoft.com/en-us/rest/api/contentsafety/image-operations/analyze-image?view=rest-contentsafety-2024-09-01)
- [Google Web Risk](https://docs.cloud.google.com/web-risk/docs/overview)
- [OWASP upload defense in depth](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
