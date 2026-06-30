# Serialized MTG Catalog

Last researched: 2026-06-30

Primary working query: https://scryfall.com/search?q=is%3Aserialized&unique=prints&order=set

Secondary collector reference: https://draftsim.com/mtg-serial-number-cards/

Scryfall currently returns 298 serialized print records for `is:serialized`. This document groups those records into tracker-friendly product/treatment buckets.

Draftsim's serialized-card guide is useful as a companion source for treatment-level summaries, collector context, and print-run notes. Do not copy its article text or tables into the app. Use it to cross-check our machine-readable catalog, then verify live tracker details against Scryfall and official Wizards product/collecting pages where possible.

## How To Read This

The current tracker model works best for one card with one serial range, for example The One Ring poster card numbered `001/100` through `100/100`.

Many MTG serialized releases are not one card. They are multi-card treatments, such as 63 retro artifacts with 500 serials each. Those should not be forced into the current one-dimensional model. They need a two-dimensional queue:

- card selection
- serial number selection

## Immediate Single-Card Scaffold Candidates

These can be scaffolded with the current model after verifying quantity and aesthetics:

| Tracker | Set | Qty | Notes |
| --- | --- | ---: | --- |
| The One Ring poster | LTR | 100 | Already live as `/trackers/one-ring`. |
| The One Ring 001/001 | LTR | 1 | Unique Quenya One Ring. |
| Viscera Seer | SLD | 100 | Verify with primary Secret Lair source before launch. |
| Edgar Markov | INR | 500 | Innistrad Remastered serialized movie poster card. |
| The Aetherspark | DFT | 500 | Aetherdrift serialized headliner. |
| Mox Jasper | TDM | 500 | Tarkir: Dragonstorm serialized headliner. |
| Traveling Chocobo | FIN | 77 | Golden Chocobo future migration target. |
| Emeritus of Ideation // Ancestral Recall | SOS | 500 | Secrets of Strixhaven serialized headliner. |
| Bitterbloom Bearer | ECL | 500 | Announced/future product; recheck before launch. |
| Bloodline Recollector // Ancestral Craving | FRA | 500 | Announced/future product; recheck before launch. |

## Multi-Card Or Variant Treatments

These need card-plus-serial support before they should become live trackers:

| Treatment | Set | Cards | Qty |
| --- | --- | ---: | --- |
| The Brothers' War retro schematic artifacts | BRR | 63 | 500 each |
| Secret Lair serialized classic cards | SLD | 5 | 295 each |
| Multiverse Legends | MUL | 65 | 500 each |
| March of the Machine serialized Praetors | MOM | 5 | 500 each |
| Serialized Sol Rings | LTC | 3 variants | 300 Elven, 700 Dwarven, 900 Human |
| LOTR poster cards | LTR | 20 | 100 each |
| Realms and Relics | LTC | 30 | 100 each |
| Doctor Who serialized Doctors | WHO | 13 | approx. 500 each; verify per-card totals |
| Ravnica Remastered retro serials | RVR | 64 | 500 each |
| Murders at Karlov Manor Ravnica City serials | MKM | 7 | 250 each |
| Fallout Bobbleheads | PIP | 7 | 500 each |
| Assassin's Creed historical figures | ACR | 4 | 500 each |
| Modern Horizons 3 concept Eldrazi | MH3 | 3 | 250 each |

## Implementation Implications

### Current One-Dimensional Model

`SerializedRingCard` currently represents a serial slot:

```text
serialNumber -> found/source/price/image/grading
```

That works when the tracker is for a single physical card printing.

### Needed Multi-Card Model

For BRR, MUL, RVR, and similar treatments, a report must identify:

```text
trackedCardId + serialNumber -> found/source/price/image/grading
```

Recommended next schema additions:

- `TrackedCardDefinition`: card identity, set code, collector number, image, Scryfall URL, total serials
- `SerializedDiscoverySlot`: `trackedCardId`, `serialNumber`, status fields
- submission validation that requires both a valid card and serial
- admin queue filters for card, set, serial, source type, and duplicate reports

## Machine-Readable Catalog

The current curated catalog lives in:

```text
src/lib/serialized-catalog.ts
```

Use it to drive:

- planned tracker directory cards
- future scaffold scripts
- dynamic card pickers in submission flows
- per-treatment implementation priority

## Sources

- Scryfall serialized query: https://scryfall.com/search?q=is%3Aserialized&unique=prints&order=set
- Scryfall API card search: https://scryfall.com/docs/api/cards/search
- Draftsim, The Complete List of Serialized Cards in Magic: the Gathering: https://draftsim.com/mtg-serial-number-cards/
- Wizards, What's Inside The Brothers' War Boosters: https://magic.wizards.com/en/news/feature/whats-inside-the-brothers-war-boosters
- Wizards, Collecting The Lord of the Rings: Tales of Middle-earth: https://magic.wizards.com/en/news/feature/collecting-the-lord-of-the-rings-tales-of-middle-earth
- Wizards article and collecting pages should be checked per treatment before moving a tracker from planned to live.
