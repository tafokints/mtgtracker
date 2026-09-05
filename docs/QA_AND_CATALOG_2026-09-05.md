# Upload, CRUD, And Catalog Audit

Date: 2026-09-05. Scope: standalone MTG Trackers, not the parent Golden Chocobo repository. Zero production discoveries is acceptable. No fixture discovery was created or approved in production.

## Conclusions

- Production file upload is currently **not configured**: an empty multipart request to the live upload endpoint returned 503, `Image uploads are not configured`. No file was sent/stored. Connect Vercel Blob and redeploy before claiming this feature works live.
- Automated route tests exercise create, public/private read, all existing admin edits, review states, export, and restore. They use isolated Redis/Blob fixtures, not production credentials. This is not a full production CRUD sign-off.
- No record hard-delete or automatic orphan-Blob cleanup exists. Rejecting a report, detaching a form image, and logging out are not physical record/file deletion. Audited removal and retention are still TODOs.
- The catalog now has set, treatment, and exact-printing pages. Released English printings have reporting paths except Golden Chocobo, whose separate migration remains deferred.

## Coverage Snapshot

The checked-in Scryfall search snapshot contains **298 serialized printings**: **291 English**, comprising **290 released and one announced**; seven non-English reference variants. These belong to **22 treatments in 17 release groups**. These are printing counts, not individual numbered copies or discovered cards.

Hierarchy:

1. `/sets`: release groups.
2. `/sets/[set]`: treatments and searchable card printings, English by default.
3. `/serialized-mtg-catalog/[slug]`: treatment, quantities, distribution, sources, and printing list.
4. `/serialized-mtg-catalog/[slug]/[card]`: exact printing, language, release, numbered total, reference art, and relevant affiliate links.
5. `/trackers/[slug]`: numbered slots and serial details, linked to the corresponding report form.

There are **268 new generated single-printing trackers** and three existing live featured trackers. Together they cover **289 distinct released English printings**. Golden Chocobo has a reference page but no newly activated reporting. Existing One Ring, Edgar Markov, and LOTR poster records are reused. The existing One Ring overlap inside the poster tracker still needs a separately reviewed canonical-identity migration.

| Treatment | English Printings | Numbered Total Per Printing | Evidence |
| --- | ---: | --- | --- |
| Mirrored Viscera Seer | 1 | 100 | Scryfall printing; primary distribution source still needed |
| Secret Lair 295 | 5 | 295 | Scryfall and [Magic Librarities](https://www.magiclibrarities.net/1548-rarities-secret-lair-drop-series-promos-english-cards-secret-lair-295-serialized-promos-2023.html); primary source still needed |
| BRO retro schematic artifacts | 63 | 500 | [Wizards BRO collecting](https://magic.wizards.com/en/news/feature/whats-inside-the-brothers-war-boosters) |
| MOM Multiverse Legends | 65 | 500 | [Wizards MOM collecting](https://magic.wizards.com/en/news/feature/collecting-march-of-the-machine) |
| MOM serialized Praetors | 5 | 500 | Same MOM source |
| LOTR serialized Sol Rings | 0 (3 Quenya references) | 300 Elven / 700 Dwarven / 900 Human | [Wizards LOTR collecting](https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth) |
| Unique One Ring | 0 (1 Quenya reference) | 1 | Same LOTR source |
| Doctor Who Doctors | 13 | 501 through 513, by Doctor | [Wizards Doctor Who collecting](https://magic.wizards.com/en/news/feature/collecting-magic-the-gathering-doctor-who) |
| LOTR Realms and Relics | 30 | 100 | LOTR collecting, holiday release |
| LOTR poster cards | 20 | 100 | LOTR collecting, holiday release |
| Ravnica Remastered retro | 64 | 500 | [Wizards RVR collecting](https://magic.wizards.com/en/news/feature/collecting-ravnica-remastered) |
| MKM Ravnica City | 7 | 250 | [Wizards MKM collecting](https://magic.wizards.com/en/news/feature/collecting-murders-at-karlov-manor) |
| Fallout bobbleheads | 7 | 500 | [Wizards Fallout collecting](https://magic.wizards.com/en/news/feature/collecting-magic-the-gathering-fallout) |
| MH3 concept Eldrazi | 3 | 250 | [Wizards MH3 collecting](https://magic.wizards.com/en/news/feature/collecting-modern-horizons-3) |
| Assassin's Creed historical figures | 1 (3 other-language references) | 500 | [Wizards ACR collecting](https://magic.wizards.com/en/news/feature/collecting-assassins-creed), [language explanation](https://magic.wizards.com/en/news/making-magic/creed-is-good) |
| Edgar Markov | 1 | 500 | [Wizards INR collecting](https://magic.wizards.com/en/news/feature/collecting-innistrad-remastered) |
| The Aetherspark | 1 | 500 | [Wizards Aetherdrift](https://magic.wizards.com/en/products/aetherdrift) |
| Mox Jasper | 1 | 500 | [Wizards Tarkir: Dragonstorm](https://magic.wizards.com/en/products/tarkir-dragonstorm) |
| Traveling Chocobo | 1 | 77 | [Wizards Final Fantasy collecting](https://magic.wizards.com/en/news/feature/collecting-final-fantasy); reporting migration deferred |
| Bitterbloom Bearer | 1 | 500 | [Wizards Lorwyn Eclipsed](https://magic.wizards.com/en/products/lorwyn-eclipsed) |
| Emeritus of Ideation | 1 | 500 | [Wizards Secrets of Strixhaven](https://magic.wizards.com/en/products/secrets-of-strixhaven) |
| Bloodline Recollector | 1 announced | 500 | [Wizards Reality Fracture collecting](https://magic.wizards.com/en/news/feature/collecting-reality-fracture); release 2026-10-02 |

[Draftsim's list](https://draftsim.com/mtg-serial-number-cards/) was a discovery checklist, checked against Wizards and the [Scryfall serialized-printing search](https://scryfall.com/search?q=is%3Aserialized+lang%3Aany&unique=prints). Corrections include 20 LOTR posters (not ten), exact Doctor quantities, English-only Mary Read and Anne Bonny among the historical figures, Mox Jasper in April 2025, and already released 2026 headliners. The holiday Realms and Relics serialized release is November 3, 2023, overriding the summer date inherited by those Scryfall records.

Nonserialized headliners, ordinary versions of these card names, and unrelated numbered merchandise are excluded. Language means the printing's card language, not which countries' boosters can contain it. This is a dated inventory, not a guarantee that future announcements are already included. Unknown new sets fail the sync for human classification instead of inheriting a guessed /500 total.

## Tested Behavior

The expanded suite passed 214 tests across 20 files at this checkpoint:

| Area | Checks | Environment / Limit |
| --- | --- | --- |
| Upload parsing | Real PNG/JPEG/WebP; invalid bytes, SVG, MIME mismatch, empty/duplicate files, oversized or malformed multipart | Real image decoding; mocked Blob |
| Privacy and resource limits | EXIF removal, orientation, output pixels retained, 25 MP cap, streamed body limit without Content-Length | Real Sharp image processing |
| Upload failures | Missing token, Blob failure, IP/site upload limits, fail-closed limiter | Route tests; live missing-token check |
| Discovery create/read | Correct card/serial, pending state, public response projection, authenticated review queue, duplicate reports | Isolated Redis fixture |
| Review/update | Approve/reject/needs-info/duplicate/cannot-verify; image/price/grading/history; concurrent approve/edit; invalid payloads | Isolated Redis fixture |
| Backup/restore | Full upload-to-review-to-edit-to-export/restore journey, 2,000-slot poster roundtrip, all slots retained, generated tracker isolation | Isolated Redis fixture |
| Restore validation | Numeric IDs, immutable slot identity, unique report IDs, nested evidence/prices/grading, bad URLs | Invalid backups rejected before replacement |
| Persistence scripts | Raw JSON read, actual CAS conflict, restore, activity index, wrong-type index failure without partial writes | Actual Upstash SDK + Lua in local fakeredis/Lupa, not hosted Upstash |
| Catalog | Snapshot counts, unique printing/route IDs, all released English eligibility, exclusions, Doctor/Sol totals, source-backed dates, sitemap coverage | Automated tests |
| Affiliates | All configured printing/tracker/serial links retain attribution and relevant query terms; generic TCGplayer stays generic | URL validation, not commission verification |
| Browser | Set/card navigation, Mox Amber report options, search/no-results, ACR English/all-language switch, reference images, desktop/mobile width | Browser inspection at desktop and 390x844 |

Reproduction: `npm test`, `npm run lint`, `npm run build`, `npm run links:validate`. For actual Lua checks, start `scripts/redis-test-server.py` as documented in README, run `npm run test:redis`, then stop the fixture. No production secrets are used. Release build, link, and deployment outcomes are recorded in the task handoff.

Final local checks: 214 tests passed; lint and TypeScript/build passed (357 pre-rendered pages, generated tracker routes rendered on demand); full dependency audit found zero vulnerabilities. `node scripts/check-catalog-pages.mjs` checked all 1,120 set/printing/generated-tracker/report/stats pages for successful HTML and headings. Local smoke passed with only the Redis health probe explicitly skipped because the preview has no database credentials. Feed fallbacks in that preview are not evidence of cloud persistence. The actual Redis SDK/Lua fixture check passed separately. A benign missing TypeScript dependency source-map warning remains in test output.

URL validation passed for 819 configured links, 1,740 boundary-serial links, 66 treatment links, and 894 printing links. Live destination checks sampled featured/default links: Amazon and TCGplayer passed; five eBay checks returned 403 and remain manual-review.

## Affiliate And Operational Limits

All printing reference pages and numbered tracker pages show prominent affiliate disclosures above shopping links, with repeat disclosures near lower marketplace sections. eBay searches include the card and set; numbered links add the exact serial. Amazon uses the actual parent booster product, including LOTR Special Edition, with a clearly labelled generic fallback for promos. TCGplayer remains `https://partner.tcgplayer.com/DyJ25G` as requested.

Attribution values remain eBay campaign `5339113954` and Amazon tag `meleeitonme0a-20`. Their presence in a URL is necessary but does not prove site approval, order eligibility, cookie attribution, or payment. eBay bot-blocked HTTP checks still require manual review. Merchant dashboards are the source of truth for credited orders and commissions.

Before claiming full infrastructure readiness: connect and test real Blob storage in an isolated preview, implement retention/audited removal, unify the pre-existing One Ring identity overlap, add scheduled backups and a hosted isolated restore drill, and finish telemetry cost/retention limits. Broader mobile populated/admin browser regression and distinct tracker aesthetics remain queued.
