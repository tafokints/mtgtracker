# MTG Trackers

A Vercel-ready umbrella site for Magic: The Gathering serialized card trackers.

The first tracker is `The One Ring` at `/trackers/one-ring`. The existing Golden Chocobo tracker stays untouched for now and can be migrated later as `/trackers/golden-chocobo`.

## Routes

- `/` - platform homepage
- `/trackers` - tracker directory
- `/trackers/one-ring` - The One Ring tracker
- `/trackers/one-ring/stats` - The One Ring stats
- `/trackers/one-ring/submit` - hidden submit flow target

## Features

- Directory model for multiple serialized-card trackers
- Public tracker grid for serials `001/100` through `100/100`
- Progress, search, located/confirmed/source-linked filters, and sorting
- Hidden report flow with source type, evidence level, price, image URLs, and notes
- Admin review queue before crowd-sourced discoveries become public tracker updates
- Hidden admin panel with price, image, grading, and price-history updates
- Upstash Redis storage for Vercel deployment

## Local Setup

```bash
cd mtg-serial-tracker
npm install
copy .env.example .env.local
npm run dev
```

Set these env vars in `.env.local` and in Vercel:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Deploying On Vercel

1. Import the repository in Vercel.
2. Set the project root to `mtg-serial-tracker`.
3. Add an Upstash Redis database.
4. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
5. Deploy.

The first `/api/trackers/one-ring/cards` request initializes Redis with all 100 One Ring serial slots. Public reports are stored in `one_ring_submissions` until approved.

## Hidden Workflows

- Report form: enter the Konami code on `/trackers/one-ring` to reveal the `Report a Find` link.
- Admin panel: press `Ctrl + Alt + A` on `/trackers/one-ring`.
- Review queue: use the admin panel `Review` tab to approve or reject pending reports.

## References

- Scryfall reference printing: https://scryfall.com/card/ltr/748z/the-one-ring
- Wizards product context: https://magic.wizards.com/en/products/the-lord-of-the-rings-tales-of-middle-earth
