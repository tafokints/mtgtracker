# Evidence Service Activation

## Current Checkpoint

- Owner confirms successful production password/TOTP login, logout and re-login after `0058bc3`.
- Owner confirms `mtgtracker-blob` is private and connected to `mtgtracker`, and reports a successful production Test storage run after release `7b664b9`. The diagnostic's success requires all four checks: private upload, exact read-back, anonymous denial and cleanup. Vercel independently confirms that release is Ready at `mtgtrackers.com`; the test result is owner-reported. No secret values were retrieved or copied.
- The application supports that connection's SDK-managed OIDC authentication as well as the existing static-token alternative. A configured connection is not proof of a working private store.
- Turnstile, Cloudmersive, Azure Content Safety and Google Web Risk are not configured in the last Production environment-name check. No real provider scans or complete hosted report lifecycle have been run.

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

Create a separate widget for each tested environment through Cloudflare Turnstile, Add widget. Use Managed mode, a descriptive name and the exact intended hostnames. Pre-clearance is not required by this application. Keep the returned secret private. See [Cloudflare widget setup](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

| Application setting | Source |
| --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Widget site key, intentionally public |
| `TURNSTILE_SECRET_KEY` | Matching server-only secret |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Exact comma-separated domains, without schemes or paths |

For Production the intended hostname list is `mtgtrackers.com,www.mtgtrackers.com`. Preview needs its own explicit hostname and widget. Configure Preview first and rebuild: the public site key is included at build time. Never put a secret in a `NEXT_PUBLIC_` setting. The server checks challenge success, hostname and action `discovery`; do not replace that verification with a frontend-only check.

Adding Turnstile enables report-session intake, so complete isolated scanner and workflow verification before enabling it broadly in Production. A storage-test pass alone is not permission to open intake.

## Screening And Release Gates

The existing integrations require Cloudmersive Virus Scan, Azure AI Content Safety and Google Web Risk settings listed in docs/EVIDENCE_SECURITY.md. Review account costs, processing regions and retention before activating them. These are owner/provider setup steps, not services created by this code change.

In an isolated environment, verify benign image upload, private pending access denial, successful safety checks, owner approval, public approved access and revocation. Also test failures/timeouts, challenge expiry/replay, and image integrity. Use benign fixtures and simulated threat results for negative cases; do not collect actual malware or pornography for QA. Complete real backup/restore and retention work before broad promotion.

Malware/link screening does not establish card authenticity, and Web Risk does not classify adult content on linked pages. Human review remains required. No manual scanner bypass or automatic approval has been added.

## Local Verification

This change passes 398 tests across 30 files, lint and a production build. The storage checks use mocked provider responses, including write/read failures, bad content, unexpected destinations, anonymous successes/redirects, failed deletion and non-authoritative metadata errors. Route coverage includes real owner/same-origin guards, exact bounded confirmation, request budgets and OIDC configuration without manually passing an identity token. Existing quarantined-image and approval tests remain enabled.

Headless Edge/Playwright fixtures pass at 320, 390 and 1,440 pixels: missing configuration disables testing; cancellation makes no request; incomplete cleanup stays visible; a later complete check clears the warning; logout and expired access remove results. Screenshots were inspected for overflow and overlapping content. Provider requests and owner credentials in these local browser tests are fixtures, not real cloud verification. The owner subsequently reported a successful hosted storage diagnostic as recorded above. Real screening-provider tests and the complete isolated evidence lifecycle remain pending.
