# Affiliate Account Verification

Date: 2026-09-06 (America/Los_Angeles).

Scope: inspect the owner's signed-in merchant dashboards, match the site's public attribution identifiers, and register MTG Trackers with explicit owner approval. No payment settings, credentials, existing properties or affiliate destinations were changed.

## Observed Account State

| Merchant | Configuration matched | Domain result |
| --- | --- | --- |
| eBay Partner Network | Campaign `5339113954` is Active and appears in an official Link Generator sample. | `https://mtgtrackers.com` saved as Website media property "MTG Trackers". No separate ownership-verification badge was observed. |
| Amazon Associates | Store ID `meleeitonme0a-20` matches the configured tag. | `https://mtgtrackers.com` saved in the website list; Amazon displayed "Websites and Mobile Apps updated." The owner answered the required under-13 audience question before confirmation. |
| TCGplayer / Impact | TCGplayer application shows Approved in account `6334129`; the dashboard's existing link matches `https://partner.tcgplayer.com/DyJ25G`. | Meta-tag ownership flow completed; `mtgtrackers.com` shows Connected, including after a page reload. |

The pre-existing Golden Chocobo Impact property remains Pending and was left unchanged. Existing eBay and Amazon properties were also preserved. Registration and a program application status are not blanket approval of every future placement or traffic source.

## Impact Ownership Tag

- `src/app/layout.tsx` contains the public, owner-authorized `impact-site-verification` tag in `<head>`.
- Preserve Impact's exact `value` attribute, not the conventional meta `content` attribute. The tag contains a public ownership marker, not an API key or authentication secret.
- This is passive HTML, not an added tracking script. Do not replace it with account credentials or a third-party script.
- The exact tag was checked in raw locally rendered and production homepage HTML before clicking Add Website. Impact then returned Connected.
- The existing homepage assertion in `scripts/smoke-check.mjs` checks the exact tag to catch accidental removal during later releases.

## Release Evidence

Application release `87fa824` was pushed through GitHub -> Vercel and confirmed Ready on `https://mtgtrackers.com`.

- 514 tests across 35 files passed; lint and production build passed.
- GitHub Verify run `34076796754` completed successfully.
- All 63 production smoke checks passed, including homepage markup, public data and anonymous admin denial checks.
- Offline affiliate checks passed for 819 configured, 1,740 boundary-serial, 66 catalog and 894 printing URLs. These check configuration, not live merchant acceptance or earnings.
- Existing affiliate URLs and top-of-page disclosures were unchanged.

## Remaining Limits

- Keep prominent affiliate disclosures before the first affiliate link, including on mobile. The owner requires this because of earlier eBay compliance feedback.
- Preserve the generic TCGplayer destination and label; it is not a card-specific deep link.
- The eBay generator sample used `toolid=10001`; the existing builder uses `20012`. The campaign matched. This difference alone was not evidence of failed attribution, and no URL parameters were changed during this account-registration task. Recheck against merchant guidance before any future builder change.
- Reconcile merchant-reported clicks, qualifying orders, reversals and commissions with site telemetry and operating costs. A connected property or well-formed URL does not establish commission credit or profitability.
- No purchases, payment changes, revenue claims, new contract acceptance or private evidence operations were performed as part of these checks.
