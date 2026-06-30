# CLAUDE.md

Guidance for Claude Code and other AI coding agents working on MTG Trackers.

## Project Identity

MTG Trackers is a Vercel-hosted Next.js App Router site for community-maintained Magic: The Gathering serialized card trackers.

Live site: https://mtgtrackers.com

Current live tracker:

- `/trackers/one-ring` - The One Ring serialized tracker, 001/100 through 100/100

Planned tracker:

- `/trackers/golden-chocobo` - future migration from the separate Golden Chocobo tracker

Important boundary: this app lives in `mtg-serial-tracker` and is intentionally separate from the parent Golden Chocobo repo. Do not edit the parent tracker unless explicitly asked.

## Commands

Run from the `mtg-serial-tracker` folder:

```bash
npm install
npm run dev
npm run lint
npm run build
```

Production smoke checks:

```bash
curl https://mtgtrackers.com/api/health
curl https://mtgtrackers.com/api/trackers/one-ring/cards
```

`/api/health` should return `ok: true` and confirm Redis can write, read, and delete.

## Environment

Required in Vercel Production:

```bash
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

Redis can use either naming pair:

```bash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

or:

```bash
KV_REST_API_URL
KV_REST_API_TOKEN
```

Use the normal Redis REST token, not the read-only token. The app must write initial tracker slots, public submissions, admin approvals, and health-check probes.

Known launch issue: Vercel env values may accidentally be pasted with wrapping quote characters. The app normalizes wrapping quotes, but the Vercel value should still be stored without quotes.

## Architecture Map

- `src/lib/trackers.ts` - tracker registry and per-tracker configuration
- `src/lib/tracker-data.ts` - generic card/submission Redis helpers
- `src/lib/types.ts` - shared data schema
- `src/lib/redis.ts` - Redis env resolution and client factory
- `src/lib/admin-auth.ts` - signed admin cookie auth
- `src/lib/rate-limit.ts` - public submission rate limiting
- `src/lib/submission-validation.ts` - server validation for crowd reports
- `src/app/api/trackers/[slug]/*` - dynamic tracker APIs
- `src/components/AdminPanel.tsx` - hidden admin panel and review queue
- `src/components/AffiliateLinks.tsx` - tracker-aware affiliate link rendering
- `TODO.md` - current roadmap
- `ARCHITECTURE.md` - system overview

## Work Loop

1. Read `TODO.md`, `ARCHITECTURE.md`, and the files near the requested change.
2. Keep edits scoped. Prefer existing tracker config/helpers over new one-off logic.
3. For tracker-specific behavior, start in `src/lib/trackers.ts`.
4. For shared data behavior, update `src/lib/tracker-data.ts` and the generic `/api/trackers/[slug]/*` routes.
5. Preserve the public-submission-to-admin-review flow. Public users should not directly mutate canonical card state.
6. Run `npm run lint` and `npm run build` before finishing.
7. If deployment behavior changed, smoke check `/api/health` and the relevant cards API.
8. Update `TODO.md` when roadmap items are completed or new follow-up work is discovered.

## Data And Security Rules

- Never commit real env values, passwords, tokens, cookies, or Redis data dumps.
- Keep admin routes protected with `requireAdmin`.
- Keep public submissions validated and rate-limited.
- Do not expose raw Redis errors to ordinary public endpoints.
- Avoid destructive Redis operations unless the user explicitly asks for reset/import/restore work.
- Prefer additive schema changes and normalization helpers because Redis may already contain older records.

## Tracker Addition Pattern

To add a new serialized tracker:

1. Add config in `src/lib/trackers.ts`.
2. Choose unique Redis keys for cards and submissions.
3. Define total quantity, serial padding, theme, reference image, set metadata, and affiliate links.
4. Add route pages under `src/app/trackers/[tracker-slug]` or refactor pages to a reusable dynamic route first.
5. Smoke test `GET /api/trackers/[slug]/cards`.
6. Confirm submission and admin approval flows work for the new slug.

## UX Direction

This is a collector utility, not a marketing page. Prioritize fast scanning, clean status states, source provenance, image evidence, market history, and mobile usability.

Each tracker page can have its own aesthetic, but keep the controls familiar and consistent across trackers. Use theme config for visual differences instead of duplicating whole interaction patterns.

## Current Priorities

- Improve admin review history and duplicate handling.
- Choose and implement image storage for evidence uploads.
- Add backup/export and import/restore tooling.
- Make tracker directory cards show live counts.
- Prepare the Golden Chocobo migration after the generic tracker path is solid.
