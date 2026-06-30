# Architecture

## App Shape

The app uses Next.js App Router with an umbrella homepage and nested tracker pages.

```text
src/app/page.tsx                         MTG Trackers homepage
src/app/trackers/page.tsx                tracker directory
src/app/trackers/[slug]/page.tsx         dynamic tracker page
src/app/trackers/[slug]/stats/page.tsx   dynamic tracker stats
src/app/trackers/[slug]/submit/page.tsx  dynamic hidden report form
src/app/api/trackers/[slug]/*            generic tracker API routes
src/app/api/health/route.ts              Redis/runtime health check
src/components/Tracker*Client.tsx        shared client tracker views
src/components/*                         shared tracker controls/details/admin UI
src/lib/trackers.ts                      tracker directory configuration
src/lib/serialized-catalog.ts            researched serialized-card scaffold catalog
src/lib/tracker-data.ts                  generic tracker storage helpers
src/lib/types.ts                         shared card schema
src/lib/redis.ts                         lazy Redis client factory
```

## Tracker Directory

`src/lib/trackers.ts` is the top-level registry. Each tracker should define the collection identity, serialized quantity, theme, and affiliate links. It currently contains:

- `one-ring`: live
- `golden-chocobo`: planned placeholder

Future single-card trackers should start as entries there. Live tracker pages, stats pages, submit forms, API routes, and sitemap entries resolve by slug from this config.

`src/lib/serialized-catalog.ts` is a broader research catalog of MTG serialized treatments. It includes single-card trackers that fit the current data model and multi-card treatments that need card-plus-serial support before launch.

Tracker config fields include:

- `slug`, `title`, `subtitle`, `description`
- `setName`, `releaseName`, `cardType`
- `total`
- `theme`
- `affiliateLinks`
- `referenceImage`

## Data Model

The live One Ring tracker stores cards as one array at Redis key `one_ring_cards`.
Crowd-sourced discovery reports are stored separately at `one_ring_submissions`.

Each card has:

- `id` and `serialNumber`
- `found`
- `verificationStatus`: `unverified`, `source-linked`, or `confirmed`
- optional discovery source fields: `foundBy`, `dateFound`, `link`, `sourceType`, `notes`
- optional market fields: `price`, `priceDate`, `priceHistory`
- optional grading fields: `grading`
- optional `image`, defaulting to the Scryfall reference image
- optional `pendingReports`, computed at read time from pending submissions

## API Shape

The UI uses the platform-shaped tracker API namespace:

- `GET /api/trackers/[slug]/cards`
- `POST /api/trackers/[slug]/submit`
- `POST /api/trackers/[slug]/update-price`
- `POST /api/trackers/[slug]/add-price-history`
- `POST /api/trackers/[slug]/update-image`
- `POST /api/trackers/[slug]/update-grading`
- `GET /api/trackers/[slug]/submissions?status=pending`
- `POST /api/trackers/[slug]/submissions`

All tracker API routes resolve storage keys, serial formatting, and totals from `src/lib/trackers.ts`.

## Serialized Catalog

The serialized catalog drives the scaffold queue on `/trackers` and is documented in `docs/SERIALIZED_MTG_CATALOG.md`.

Catalog tracking modes:

- `single-card`: current data model can support this after adding tracker config/routes.
- `multi-card-treatment`: needs a selected card plus serial number.
- `variant-card`: one card name with multiple serialized variants and totals.
- `promo-series`: related promo cards that may need extra source verification.

## Submission Review Flow

1. A user reports a discovered serial at `/trackers/[slug]/submit`.
2. The report is written to the tracker submissions Redis key with status `pending`.
3. `/api/trackers/[slug]/cards` includes pending report counts per serial.
4. An admin opens the hidden admin panel and uses the `Review` tab.
5. Approving a report updates `one_ring_cards` and marks the report `approved`.
6. Rejecting a report marks it `rejected` without changing the public card state.

## Deployment Notes

The API routes call `getRedis()` inside handlers instead of at module import time. This lets local and Vercel builds compile before runtime env vars are available.

Required admin runtime env vars:

```bash
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

Redis runtime env vars can use either naming pair:

```bash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

or:

```bash
KV_REST_API_URL
KV_REST_API_TOKEN
```

Use a write-capable token, not the read-only token. `/api/health` verifies that the deployed runtime can write, read, and delete a temporary Redis key without exposing secrets.
