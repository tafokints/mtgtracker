# Architecture

## App Shape

The app uses Next.js App Router with an umbrella homepage and nested tracker pages.

```text
src/app/page.tsx                         MTG Trackers homepage
src/app/trackers/page.tsx                tracker directory
src/app/trackers/one-ring/page.tsx       The One Ring tracker
src/app/trackers/one-ring/stats/page.tsx The One Ring stats
src/app/trackers/one-ring/submit/page.tsx hidden report form
src/app/api/trackers/one-ring/*          namespaced One Ring API routes
src/components/*                         shared tracker controls/details/admin UI
src/lib/trackers.ts                      tracker directory configuration
src/lib/ring-data.ts                     One Ring seed and reference constants
src/lib/types.ts                         shared card schema
src/lib/redis.ts                         lazy Redis client factory
```

## Tracker Directory

`src/lib/trackers.ts` is the top-level registry. Each tracker should define the collection identity, serialized quantity, theme, and affiliate links. It currently contains:

- `one-ring`: live
- `golden-chocobo`: planned placeholder

Future trackers should start as entries there, then get a nested route and storage key.

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

The UI uses the platform-shaped One Ring API namespace:

- `GET /api/trackers/one-ring/cards`
- `POST /api/trackers/one-ring/submit`
- `POST /api/trackers/one-ring/update-price`
- `POST /api/trackers/one-ring/add-price-history`
- `POST /api/trackers/one-ring/update-image`
- `POST /api/trackers/one-ring/update-grading`
- `GET /api/trackers/one-ring/submissions?status=pending`
- `POST /api/trackers/one-ring/submissions`

Most thin namespaced route files currently re-export the original One Ring handlers; the submission review route is implemented directly in the namespace. When the second tracker is migrated, the next step is to extract those handlers into a generic storage helper keyed by tracker config.

## Submission Review Flow

1. A user reports a discovered serial at `/trackers/one-ring/submit`.
2. The report is written to `one_ring_submissions` with status `pending`.
3. `/api/trackers/one-ring/cards` includes pending report counts per serial.
4. An admin opens the hidden admin panel and uses the `Review` tab.
5. Approving a report updates `one_ring_cards` and marks the report `approved`.
6. Rejecting a report marks it `rejected` without changing the public card state.

## Deployment Notes

The API routes call `getRedis()` inside handlers instead of at module import time. This lets local and Vercel builds compile before runtime env vars are available.

Required runtime env vars:

```bash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```
