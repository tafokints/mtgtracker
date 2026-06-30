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

| Date | Tracker | Set | Numbered | Found In | Notes |
| --- | --- | --- | --- | --- | --- |
| 2021-11 | Mirrored Viscera Seer | SLD | 1-100 | Phyrexian Praetors: Compleat Edition bonus card | First serialized MTG-context card series; verify primary Secret Lair source before launch. |
| 2023-06 | The One Ring 001/001 | LTR | 001/001 | LOTR Collector Boosters | Unique Quenya One Ring. |
| 2023-11 | The One Ring poster | LTR | 1-100 | LOTR Holiday Release Collector Boosters | Already live as `/trackers/one-ring`. |
| 2025-01 | Edgar Markov | INR | 1-500 | Innistrad Remastered Collector Boosters | Headliner. |
| 2025-02 | The Aetherspark | DFT | 1-500 | Aetherdrift Collector Boosters | Headliner. |
| 2025-02 | Mox Jasper | TDM | 1-500 | Tarkir: Dragonstorm Collector Boosters | Headliner. |
| 2025 | Traveling Chocobo | FIN | 1-77 | Final Fantasy product | Golden Chocobo future migration target. |
| 2026 | Emeritus of Ideation // Ancestral Recall | SOS | 1-500 | Secrets of Strixhaven product | Recheck before launch. |
| 2026 | Bitterbloom Bearer | ECL | 1-500 | Lorwyn Eclipsed product | Announced/future product; recheck before launch. |
| 2026 | Bloodline Recollector // Ancestral Craving | FRA | 1-500 | Reality Fracture product | Announced/future product; recheck before launch. |

## Multi-Card Or Variant Treatments

These need card-plus-serial support before they should become live trackers:

| Date | Treatment | Set | Cards | Numbered | Found In |
| --- | --- | --- | ---: | --- | --- |
| 2022-11 | The Brothers' War retro schematic artifacts | BRR | 63 | 1-500 | The Brothers' War Collector Boosters |
| 2023-02 and later | Secret Lair serialized classic cards | SLD | 5 | 1-295 | MagicCon visitor gifts |
| 2023-04 | Multiverse Legends | MUL | 65 | 1-500 | March of the Machine Collector Boosters |
| 2023-04 | March of the Machine serialized Praetors | MOM | 5 | 1-500 | March of the Machine Collector Boosters |
| 2023-06 | Serialized Sol Rings | LTC | 3 variants | 300 Elven, 700 Dwarven, 900 Human | LOTR Collector Boosters |
| 2023-10 | Doctor Who serialized Doctors | WHO | 13 | 501-513 by Doctor | Doctor Who Collector Boosters |
| 2023-11 | Realms and Relics | LTC | 30 | 1-100 | LOTR Holiday Release Collector Boosters |
| 2023-11 | LOTR poster cards | LTR | 20 | 1-100 | LOTR Holiday Release Collector Boosters |
| 2024-01 | Ravnica Remastered retro serials | RVR | 64 | 1-500 | Ravnica Remastered Collector Boosters |
| 2024-02 | Murders at Karlov Manor Ravnica City serials | MKM | 7 | 1-250 | Murders at Karlov Manor Collector Boosters |
| 2024-03 | Fallout Bobbleheads | PIP | 7 | 1-500 | Fallout Collector Boosters |
| 2024-06 | Modern Horizons 3 concept Eldrazi | MH3 | 3 | 1-250 | Modern Horizons 3 Collector Boosters |
| 2024-07 | Assassin's Creed historical figures | ACR | 4 | 1-500 | Assassin's Creed Collector Boosters |

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
