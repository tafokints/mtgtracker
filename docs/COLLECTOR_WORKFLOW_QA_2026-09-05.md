# Collector Workflow And Browsing

## Scope

Owner-requested return to reporting, moderation, potential-find visibility, and tracker usability. Screening-service account setup is deferred. This release does not change authentication, storage providers, private evidence gates, canonical copy identity, affiliate account IDs, or the separate Golden Chocobo repository.

## Behavior

- A collector selects an exact card/serial, obtains existing bot-verified permission, and uploads evidence privately. An error retains form data and attachments; an accepted report shows its private receipt and return-to-serial link.
- Located copies expose a later-sighting/update report action. Existing owner inbox approval, rejection, needs-information and retraction actions retain their authenticated, atomic backend workflow.
- Public open-report counts include pending and needs-information reports. A potential find is Under Review, not located. A located copy retains its approved status while new reports remain visibly under review. Private report details and held images are not published.
- Tracker filters have explicit labels, contextual status counts, exact stamped-number/denominator search and inclusive serial ranges. Internal cross-card slot IDs are not mistaken for stamped numbers.
- At most 48 results render at once. Search, card, status, sort and page are shareable URL state; changing a filter resets the result page. Opening details no longer overwrites card/search filters. Native modal details support Escape, focus containment/restoration and previous/next matching serials.
- Serial browsing precedes the long informational sections. Card activity is optional/collapsed. Top affiliate links are compact but retain original attributed destinations and a visible full disclosure before the first affiliate link. Redundant generic marketplace placements no longer interrupt filtered results.

## Verification

Result: 450 automated tests across 32 files pass, with successful lint and production build. Collector, owner-dashboard and historical-workflow browser suites all pass at 320/390/1440px. Screenshots were inspected for layout and actual reference-art rendering. The local TypeScript installation emits a missing source-map warning during tests; it does not fail tests or the build.

The automated suite covers actual route handlers with isolated Redis/Blob/scanner fixtures, including valid image decode/re-encode, upload -> pending -> private review -> public approval, rejection, needs-information -> private reply -> approval, atomic review, safe failures and evidence revocation. New assertions cover public count transitions and absence of private receipt/reviewer material.

`scripts/check-collector-ui.mjs` exercises local browser fixtures at 320, 390 and 1440 pixels: single-card and 2,000-slot trackers, page reloads, next/previous pages, numeric/card filters, URL/back behavior, modal navigation and keyboard focus, pending updates, image upload, submission failure/retry, confirmation, private receipt and data outage. It checks top disclosure placement and sponsored-link markup. This script uses intercepted API responses and a local test challenge; it does not call real screening services or submit production discoveries.

Existing `scripts/check-owner-dashboard-ui.mjs` covers isolated owner sign-in, approval, held-image denial, filters, outages, expired access and logout across the same widths. `scripts/check-workflow-ui.mjs` covers correction review, grading/price observations and private follow-up.

Screenshots are local, ignored test artifacts under `node_modules/.cache/collector-*.png`. Read-only live smoke checks are a separate post-deployment check, not proof of hosted CRUD.

## Release Check

Application commit `fb76009` was pushed to `main`. GitHub Local verification passed tests, lint, build and dependency audit. Vercel deployment `mtgtracker-hzypboof0-daniellee912-gmailcoms-projects.vercel.app` is Ready with the `mtgtrackers.com` alias. All 62 live smoke checks pass after replacing the obsolete source assertion requiring the intentionally removed `tracker-filtered-cta` placement with pagination/disclosure assertions.

Read-only live browser checks at 390/1440px pass on `one-ring`, `lotr-poster-cards`, and generated `card-brr-98z`: second-page restoration, bounded 48-card rendering, exact serial filters, modal open/Escape, loaded reference artwork, no horizontal overflow, and top eBay disclosure preceding sponsored links. These checks blocked non-GET/HEAD browser requests. No production report, upload, review or scanner request was made. Offline affiliate checks pass for 819 configured, 1,740 serial-boundary, 66 catalog and 894 printing links; they do not prove merchant commission credit.

## Still Required

- Configure the deferred screening accounts; do not approve or expose unscanned images in the meantime.
- Isolate Preview Redis/Blob and owner credentials before real hosted end-to-end lifecycle tests. Current shared connections are not a sandbox.
- Verify real hosted Turnstile token acceptance and replay denial; a successful widget alone does not prove this.
- Separate moderator identities before inviting other reviewers. Current `/admin` is the configured owner account.
- Future backend scaling: indexed report/event records and server-side result paging. This release bounds browser rendering, not the existing full card-response payload.
