# Production Deployment Checkpoint

## Released

The owner updated Vercel environment variables. The five application commits were still local, so the earlier environment-only redeploy did not include the owner dashboard. The agent pushed `main` from `92ff6a7` to `7ad9ceb`, triggering the existing Vercel Git integration. No manual production data migration, seed, approval, import, restore or provider configuration change was performed.

- Source: `7ad9cebc04fdf2b0dd538cd8ca69874f833be9c5`.
- GitHub Verify passed: https://github.com/tafokints/mtgtracker/actions/runs/34007880570.
- Vercel deployment: `dpl_BQgNxV2ZEG1VjVRwZ8yNKMapfKHe`, Ready, Production.
- Custom domain verified against this deployment: https://mtgtrackers.com.
- Owner entry: https://mtgtrackers.com/admin.

The follow-up smoke-test/documentation commit does not change application behavior. The local folder was linked to the existing Vercel project using ignored `.vercel` metadata; no environment values were pulled. GitHub verification and Vercel deployments run from the existing integration. This does not establish that GitHub checks block promotion; branch/deployment protection settings still need explicit verification.

## Verified

- The refreshed production smoke suite passes 62 checks, covering public pages, catalog/printing pages, feeds, sitemap, selected tracker slot arrays and the owner boundary. Seven checks explicitly cover the admin privacy headers, mandatory-MFA anonymous status and private API denial. Some of the existing smoke checks inspect source files; this count is not 62 independent security tests.
- Health returns exactly `{ok: true}`, without old environment diagnostics or public write/delete probes.
- Anonymous inbox/configuration/submissions/export/reconciliation reads return 401. Admin page responses are private/no-store/noindex/no-referrer, with a production CSP that excludes unsafe-eval.
- Real hosted browser checks at 390 and 1440 pixels show the password/authenticator form without overflow or runtime errors. No credentials were entered by the agent.
- Hosted submission UI at 390 pixels displays the security-setup notice and disables both upload and submit. No production report was created.
- Local follow-up checks: 338 tests / 27 files, lint, production build, dependency audit (no known vulnerabilities). The existing missing TypeScript dependency source-map warning remains non-blocking.

## Configuration Still Needed

Read-only Vercel environment-name listing confirms the Production Redis and owner credential variables exist. Values were neither retrieved nor validated. The owner reports successful authenticator enrollment. A successful owner login/logout test is still needed; report only success or the error text, never a password, seed or rotating code.

Production currently lacks:

| Service | Required variables |
| --- | --- |
| Private Vercel Blob | `BLOB_READ_WRITE_TOKEN` for a private store |
| Cloudflare Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTNAMES` |
| Malware screening | `CLOUDMERSIVE_API_KEY` |
| Sexual-content screening | `AZURE_CONTENT_SAFETY_ENDPOINT`, `AZURE_CONTENT_SAFETY_KEY` |
| Source reputation | `GOOGLE_WEB_RISK_API_KEY` |

Preview currently lacks owner ID/TOTP configuration. Use separate isolated stores/credentials for provider lifecycle QA; do not copy production secrets into tests. Configure and test private upload/read/scan/approve/revoke/delete in isolation before enabling intake broadly. Complete encrypted backup activation and a hosted restore drill separately. The GitHub backup workflow's configuration/execution is not verified by checking website variables. See docs/EVIDENCE_SECURITY.md and docs/SECURITY_OPERATIONS.md.
