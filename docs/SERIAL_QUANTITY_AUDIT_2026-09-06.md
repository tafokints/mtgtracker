# Serialized Quantity Audit

Reviewed 2026-09-06 against the repository's 2026-09-05 snapshot: **298 exact printings in 22 treatment families**. This checks numbered print runs, not discoveries, surviving copies, marketplace inventory, nonserialized treatments, or completeness of future announcements.

## Findings

- All configured per-printing denominators match the reviewed source evidence below. No serial ranges, printing IDs, storage keys, or existing discoveries were changed.
- The unique One Ring is **LTR #0, 001/001**. `/trackers/one-ring` intentionally tracks **LTR #748z, the separate borderless poster edition /100**. Preserve that route's existing physical-copy identity and shared LOTR-poster records. Its subtitle, description, FAQ, and reference link now explain the distinction.
- Golden Traveling Chocobo is **FIN #551f, /77**. Its catalog page remains available; the separate Golden Chocobo tracker and deferred migration are unchanged.
- Fixed an actual statistics denominator bug: the 20-card LOTR poster view used its per-card default of 100 rather than its aggregate **2,000** slots. A fixture with 200 located copies must show **200/2000, 10.0%**, not 200/100, 200%.
- Corrected the unique Ring's display language from Quenya to **Black Speech**. Wizards describes Black Speech using Tengwar. Scryfall's source language code `qya` is preserved; the three Sol Ring variants remain labeled Quenya.

## Reviewed Runs

"Cards" means distinct serialized printings in this catalog; the run is **per printing**, not per set. Publisher articles/product pages are the primary sources except where explicitly noted. Family membership is cross-checked with the exact Scryfall set/collector-number snapshot.

| Family / Printing | Cards | Numbered Run | Evidence |
| --- | ---: | --- | --- |
| Mirrored Viscera Seer, SLD #VS | 1 | 1-100 | [Card reference](https://scryfall.com/card/sld/VS/viscera-seer); image visibly stamped #77 of 100. Publisher distribution documentation still unlocated. |
| Brothers' War retro schematic artifacts | 63 | 1-500 each | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/whats-inside-the-brothers-war-boosters) |
| Secret Lair /295, SLD #713-717 | 5 | 1-295 each | [Swords to Plowshares reference](https://scryfall.com/card/sld/713/swords-to-plowshares); inspected all five reference images, each stamped /295. Publisher distribution documentation still unlocated. |
| Multiverse Legends | 65 | 1-500 each | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-march-of-the-machine) |
| March of the Machine Praetors, MOM #338-342 | 5 | 1-500 each | [Wizards treatment description](https://magic.wizards.com/en/news/feature/collecting-march-of-the-machine); separately inspected all five Scryfall reference stamps /500. |
| Unique One Ring, LTR #0 | 1 | 001/001 | [Wizards LOTR guide](https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth) |
| Elven / Dwarven / Human Sol Rings, LTC #408z / #409z / #410z | 3 | 300 / 700 / 900 respectively | [Wizards LOTR guide](https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth) |
| LOTR borderless posters, including One Ring #748z | 20 | 1-100 each | [Wizards LOTR guide](https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth) |
| LOTR Realms and Relics | 30 | 1-100 each | [Wizards LOTR guide](https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth) |
| Doctor Who Doctors, WHO #552z-564z | 13 | 501 through 513, by Doctor | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-magic-the-gathering-doctor-who) and [official stamped examples](https://media.wizards.com/2023/images/daily/en_1jt44TVJTHPz.jpg); inspected all 13 Scryfall reference stamps. |
| Ravnica Remastered retro frames | 64 | 1-500 each | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-ravnica-remastered) |
| Murders at Karlov Manor Ravnica City showcase | 7 | 1-250 each | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-murders-at-karlov-manor) |
| Fallout bobbleheads | 7 | 1-500 each | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-magic-the-gathering-fallout) |
| Assassin's Creed historical figures | 4 | 1-500 each | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-assassins-creed); includes the three non-English reference printings. |
| Modern Horizons 3 concept Eldrazi | 3 | 1-250 each | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-modern-horizons-3) |
| Edgar Markov, INR #491 | 1 | 1-500 | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-innistrad-remastered) |
| The Aetherspark, DFT #376 | 1 | 1-500 | [Wizards product page](https://magic.wizards.com/en/products/aetherdrift) |
| Mox Jasper, TDM #419 | 1 | 1-500 | [Wizards product page](https://magic.wizards.com/en/products/tarkir-dragonstorm) |
| Golden Traveling Chocobo, FIN #551f | 1 | 1-77 | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-final-fantasy) |
| Bitterbloom Bearer, ECL #352 | 1 | 1-500 | [Wizards product page](https://magic.wizards.com/en/products/lorwyn-eclipsed) |
| Emeritus of Ideation, SOS #306 | 1 | 1-500 | [Wizards product page](https://magic.wizards.com/en/products/secrets-of-strixhaven) |
| Bloodline Recollector, FRA #402 | 1 | 1-500, announced | [Wizards collecting guide](https://magic.wizards.com/en/news/feature/collecting-reality-fracture); remains future/announced, with reporting closed. |

## Evidence Limits

The six Secret Lair printings have directly inspected numbered card images, not newly located publisher distribution statements. Their existing `needs-verification` catalog flags and public documentation caveats remain. Do not claim the promotion/distribution details were fully publisher-verified. Scryfall's HTML pages returned 403 to the research fetcher; the snapshot's reference images loaded in the browser and their stamps were visually inspected.

The Doctor table is not a serial range starting at 501: the First Doctor is numbered **1-501**, Second **1-502**, continuing through Thirteenth **1-513**. Nonfoil Sol Ring quantities of 3,000/7,000/9,000 are not serialized and are not included. A reference image showing one stamp is not a submitted or verified discovery.

## Regression Coverage

- `tests/serialized-quantities.test.ts` keeps independent, source-reviewed expectations for all 22 families and all 298 printings. New families require a reviewed rule rather than silently inheriting a generic /500 assumption.
- Every live tracker definition must resolve to its exact printing and match its reviewed denominator. First/last valid serials and out-of-range boundaries are checked, including offsets within multi-card views.
- One Ring /1 versus /100 identities, Chocobo /77, the 2,000-slot poster aggregate, and Black Speech versus Quenya display labels have explicit guards.
- `scripts/check-serial-quantities-ui.mjs` uses local intercepted data only. It checks the poster tracker label, related unique-printing link, populated aggregate statistics, /1 /77 /100 /513 /900 reference pages, actual reference-art loading, and mobile/desktop overflow.
- No production test submissions, storage migration, new tracker activation, affiliate-account changes, or security-policy changes are part of this audit.

## Verification Status

- 475 tests across 33 files pass, including 25 new quantity-audit tests. Lint and the production build pass. The existing missing TypeScript dependency source-map warning is nonfatal.
- The dedicated quantity browser suite passes at 320, 390, and 1440px, with no page errors or horizontal overflow. Reference artwork loaded for all five representative denominator cases.
- The existing collector browser suite also passes at all three widths: single/multi-card pagination, filtered URLs, details, mocked upload/retry, private receipt, and outage handling. Affiliate disclosures still precede marketplace links.
- Visually inspected local screenshots of the poster header, unique Ring reference and corrected populated statistics. Browser evidence fixtures never reached a production submission endpoint.
- Release uses the existing GitHub-to-Vercel pipeline. These local results alone do not claim a deployed release; verify CI, deployment readiness, live labels and read-only production smoke checks after pushing.
