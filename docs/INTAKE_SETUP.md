# Evidence Service Activation

## Current Checkpoint

- Owner confirms successful production password/TOTP login, logout and re-login after `0058bc3`.
- Owner confirms `mtgtracker-blob` is private and connected to `mtgtracker`, and reports a successful production Test storage run after release `7b664b9`. The diagnostic's success requires all four checks: private upload, exact read-back, anonymous denial and cleanup. Vercel independently confirms that release is Ready at `mtgtrackers.com`; the test result is owner-reported. No secret values were retrieved or copied.
- The application supports that connection's SDK-managed OIDC authentication as well as the existing static-token alternative. A configured connection is not proof of a working private store.
- The existing Turnstile widget is retained. The owner reports adding its matching `TURNSTILE_SECRET_KEY` in Vercel Production; a names-only check confirms presence. The agent added the public site key and production hostname list below, without retrieving any secret. Release `c49cca9` is Ready on `mtgtrackers.com`; GitHub Verify and all 62 live smoke checks pass. The in-app browser shows the real widget's Success state on the custom domain. Actual backend success/replay validation is still pending; the automated Edge browser did not obtain a real token, including its timed-out interactive run. No bypass was attempted. The live-check script now brings the widget into view before waiting for a token; rerun it with owner participation to complete this gate.
- Cloudmersive, Azure Content Safety and Google Web Risk are not configured in the last Production environment-name check. No real provider scans or complete hosted report lifecycle have been run.

## Verify The Existing Store

Use the existing private store, not a duplicate or the Golden Chocobo store. In its Vercel Projects tab, confirm it is connected to `mtgtracker` for the intended environment. Vercel adds `BLOB_STORE_ID` and manages rotating identity credentials. The SDK handles token refresh; do not manually set or share `VERCEL_OIDC_TOKEN`. A static read-write token remains an alternative, not a requirement for the hosted website. See [Vercel connection and authentication](https://vercel.com/docs/vercel-blob/using-blob-sdk#authentication).

1. Deploy the updated application after changing the connection.
2. Sign into `/admin`, open Service setup and refresh configuration.
3. Select Test storage and confirm the small provider operation. It does not upload an image or create a report.
4. Require all four checks to pass: private upload, exact read-back, anonymous access denied, and test file removed. Share only the result labels if troubleshooting is needed.

The diagnostic uses a unique, sub-1-KiB benign text file. It accepts no paths or URLs from the browser. Its anonymous request has no credentials, rejects redirects and can only reach the exact generated file on a validated private Vercel Blob host. Cleanup targets only the generated path, including after a failed upload. Only an actual metadata Not Found result confirms removal. See [Vercel private storage](https://vercel.com/docs/vercel-blob/private-storage) and [SDK operations](https://vercel.com/docs/vercel-blob/using-blob-sdk).

The run is limited to three attempts/site/15 minutes and each provider call has an eight-second timeout within a 60-second route budget. Closing the page does not deliberately abort server cleanup, but function termination, delayed uploads or provider failure can still leave the tiny diagnostic file. A failed or interrupted test is not a pass. For unconfirmed cleanup, inspect only `_diagnostics/storage/{runId}.txt` in the correct store; never delete `quarantine/` or collector files as diagnostic cleanup. Results are transient, not a durable monitoring or audit system.

## Separate Preview Before Workflow QA

The currently listed Blob connection includes both Production and Preview; existing Redis configuration also spans those environments. Do not assume a Preview deployment is isolated. Before tests that submit/approve/revoke reports, connect separate Preview Redis and private Blob stores with separate owner password, MFA and session secrets. Verify the target identities privately in Vercel; never paste credentials or dumps into chat. Do not use production discoveries as test data.

The storage diagnostic above is intentionally safe for an owner-authorized production check because it only uses its own benign diagnostic file. It does not replace isolated workflow QA.

## Set Up Turnstile

Production uses the owner's existing site key `0x4AAAAAAEp4P0nETpWGpEVE`. Do not create a replacement widget, rotate its secret or change pre-clearance. The [Cloudflare Spin existing-widget flow](https://developers.cloudflare.com/turnstile/spin/prompt.md) was fetched and reviewed. Automatic secret recovery was stopped because no approved Wrangler 4.109+ installation was available; the owner instead used Vercel's normal secret-management interface. No Cloudflare credential, secret getter or widget metadata mutation was used.

The owner separately approved persisting the canonical Spin bundle at `.claude/skills/turnstile-spin/SKILL.md`. Cloudflare's `persist-skill.sh` was downloaded outside the project, its SHA-256 verified against the hosted prompt (`4fea0bcda9fded16dd63f77dad196474d3c15c1fe93ac4718b50517fa834330c`), inspected, then run in the existing Ubuntu runtime. It installed the canonical instructions, framework references and helper scripts. The skill validator and shell syntax checks pass. No authentication, widget-creation or secret-retrieval helpers were run. Do not run the saved project-local helpers with credentials on a later task; follow the hosted guide's external-tool trust checks.

The shared report form uses action `discovery` and POST `/api/trackers/[slug]/submission-session`. That existing backend calls Siteverify before issuing a one-hour, exact-card report permission. Upload and report persistence remain separate protected handlers. Nothing is automatically approved. The owner subsequently confirms the widget completed; that is a frontend confirmation, not a recorded backend success/replay result.

| Application setting | Source |
| --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Widget site key, intentionally public |
| `TURNSTILE_SECRET_KEY` | Matching server-only secret |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Exact comma-separated domains, without schemes or paths |

Production now has `NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAEp4P0nETpWGpEVE` and `TURNSTILE_ALLOWED_HOSTNAMES=mtgtrackers.com,www.mtgtrackers.com`. The existing Cloudflare widget must authorize these domains too; its dashboard metadata has not been independently inspected. Preview needs its own explicit hostname and widget. Rebuild after changing the public site key because it is included at build time. Never put a secret in a `NEXT_PUBLIC_` setting.

The server requires strict `success === true`, exact hostname and action `discovery`, with a bounded uncached request and no redirects. Missing/invalid configuration fails closed, including wildcard/URL/IP host entries and localhost in Production or hosted Preview. Only non-deployed development can explicitly allow localhost/127.0.0.1. Tokens are bounded to 2,048 characters. The form retains its widget ID and resets that widget after every verification attempt, including network failures, invalid JSON and rejection; expired/error/timeout callbacks clear stale tokens. Valid card-bound report permissions can still be reused for uploads and report retries.

Adding Turnstile enables report-session intake. It does not certify screening readiness: unscanned images remain private and cannot be previewed or approved; source-linked approvals still require Web Risk; notes-only reports need owner review. Complete isolated scanner and workflow verification before broad intake/promotion. A storage-test pass alone is not an end-to-end intake pass.

Hosted Turnstile acceptance: use a fresh real challenge on the custom domain, send it to the existing submission-session handler once (expect 200), then replay the same challenge token (expect 403). Do not call Siteverify from the browser, print tokens, bypass the challenge, or create a test discovery in Production. This check only creates a short-lived permission and consumes rate-limit budget. If a human challenge or domain configuration prevents it, leave validation pending. A mocked token rejection alone does not prove that the real site key and secret match.

`scripts/check-turnstile-live.mjs` performs that bounded two-request check without intercepting the SDK or backend. It keeps tokens in browser memory and prints only status/issuance booleans. It makes no upload or submit request. With Playwright and Edge available, set `TURNSTILE_INTERACTIVE=1` to let the owner complete a real challenge in a temporary visible browser; otherwise it uses headless mode. A missing token exits as pending, not success. Pass a Playwright package path as the first argument when using a bundled runtime.

## Screening And Release Gates

The existing integrations require Cloudmersive Virus Scan, Azure AI Content Safety and Google Web Risk settings listed in docs/EVIDENCE_SECURITY.md. Review account costs, processing regions and retention before activating them. These are owner/provider setup steps, not services created by this code change.

In an isolated environment, verify benign image upload, private pending access denial, successful safety checks, owner approval, public approved access and revocation. Also test failures/timeouts, challenge expiry/replay, and image integrity. Use benign fixtures and simulated threat results for negative cases; do not collect actual malware or pornography for QA. Complete real backup/restore and retention work before broad promotion.

Malware/link screening does not establish card authenticity, and Web Risk does not classify adult content on linked pages. Human review remains required. No manual scanner bypass or automatic approval has been added.

## Local Verification

This change passes 398 tests across 30 files, lint and a production build. The storage checks use mocked provider responses, including write/read failures, bad content, unexpected destinations, anonymous successes/redirects, failed deletion and non-authoritative metadata errors. Route coverage includes real owner/same-origin guards, exact bounded confirmation, request budgets and OIDC configuration without manually passing an identity token. Existing quarantined-image and approval tests remain enabled.

The subsequent Turnstile integration passes 436 tests across 31 files, lint and a production build. Additional tests cover strict configuration, response validation, outage handling, token bounds and replay/expiry rejection. `scripts/check-turnstile-ui.mjs` uses only intercepted local SDK/API fixtures at 320, 390 and 1,440 pixels to check network/HTTP/JSON retries, explicit same-widget resets, token expiry/error recovery, card changes and cached report permissions. Screenshots were inspected for overflow/overlap. This is not a real Cloudflare pass; hosted validation remains a separate acceptance check above.

A production request with an empty challenge token returned 400 without issuing a report permission. That verifies missing-token rejection and configured runtime parsing, not successful Siteverify with the real widget. No production upload, report, discovery or approval was created during these checks.

Headless Edge/Playwright fixtures pass at 320, 390 and 1,440 pixels: missing configuration disables testing; cancellation makes no request; incomplete cleanup stays visible; a later complete check clears the warning; logout and expired access remove results. Screenshots were inspected for overflow and overlapping content. Provider requests and owner credentials in these local browser tests are fixtures, not real cloud verification. The owner subsequently reported a successful hosted storage diagnostic as recorded above. Real screening-provider tests and the complete isolated evidence lifecycle remain pending.
