---
name: mtg-trackers
description: Use when developing, debugging, deploying, or planning the MTG Trackers Next.js app for serialized Magic: The Gathering card tracking, crowd-sourced discoveries, admin review, Redis storage, Vercel deployment, tracker theming, affiliate links, and future tracker additions.
---

# MTG Trackers Skill

This skill guides work on the MTG Trackers project at `mtg-serial-tracker`.

## When To Use

Use this skill for tasks involving:

- The One Ring tracker
- New serialized-card trackers
- Crowd-sourced discovery submissions
- Admin verification/review queues
- Upstash Redis / Vercel KV data issues
- Vercel deployment and environment variables
- Tracker themes, affiliate links, and directory pages
- Roadmap planning in `TODO.md`

## Project Principles

MTG Trackers is a collector trust tool. Optimize for:

- accurate status
- clear evidence
- source provenance
- admin-review safety
- modular tracker configuration
- fast scanning on desktop and mobile

Do not turn public submissions into immediate canonical card updates. The queue is intentional.

## Core Files

- `src/lib/trackers.ts` - tracker registry, themes, affiliate links, Redis keys
- `src/lib/tracker-data.ts` - generic card/submission storage helpers
- `src/lib/submission-validation.ts` - public report validation
- `src/lib/admin-auth.ts` - admin login/session protection
- `src/lib/rate-limit.ts` - submit rate limiting
- `src/lib/redis.ts` - Redis env resolution/client factory
- `src/app/api/trackers/[slug]/*` - generic tracker API routes
- `src/app/api/health/route.ts` - production Redis health check
- `src/components/AdminPanel.tsx` - admin review/update UI
- `TODO.md` - roadmap and work queue
- `ARCHITECTURE.md` - app/system overview
- `CLAUDE.md` and `AGENTS.md` - agent guidance

## Standard Engineering Loop

1. Inspect `TODO.md`, `ARCHITECTURE.md`, and the nearby implementation files.
2. Identify whether the change is tracker-specific, shared platform behavior, or deployment/infrastructure.
3. Prefer changing tracker config for tracker-specific content.
4. Prefer shared helpers/routes for cross-tracker behavior.
5. Keep admin-only mutations protected.
6. Keep public submission validation and rate limiting intact.
7. Run:

```bash
npm run lint
npm run build
```

8. For live deployment or Redis changes, check:

```bash
curl https://mtgtrackers.com/api/health
curl https://mtgtrackers.com/api/trackers/one-ring/cards
```

9. Update `TODO.md` when completing or discovering roadmap work.
10. Commit and push when the user wants the live site updated.

## Redis And Env Rules

The app supports both env naming styles:

```bash
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
KV_REST_API_URL
KV_REST_API_TOKEN
```

Use a write-capable token. Do not wire the app to a read-only token.

`/api/health` intentionally reports env presence and Redis read/write/delete status without exposing secrets.

## Adding A Tracker

1. Add the tracker to `src/lib/trackers.ts`.
2. Give it unique Redis card/submission keys.
3. Set `total`, serial padding, reference image, set/release/card metadata, theme, and affiliate links.
4. Reuse generic APIs under `/api/trackers/[slug]`.
5. Add or refactor route pages so the tracker gets a public page, stats page, and submit flow.
6. Verify card initialization, submission creation, pending counts, admin approval, and affiliate fallback behavior.

## Review Queue Design

Submission statuses should support a review lifecycle. Current flow:

- `pending`
- `approved`
- `rejected`

Planned improvements:

- `needs_more_info`
- `duplicate`
- `cannot_verify`
- merge evidence from multiple submissions
- audit trail for reviewer and reviewed date

Keep canonical card state separate from submitted evidence until approval.

## Image Storage Direction

Current evidence can use external image URLs. Future work should support uploads through a durable provider such as Vercel Blob, S3, or Cloudinary.

When adding uploads:

- store submitted evidence images with the report
- let admins choose the canonical card image during approval
- preserve source/provenance for every image
- avoid relying on user-hosted images as the only long-term record

## Common Gotchas

- Preview `*.vercel.app` URLs may show manifest CORS errors if Vercel Deployment Protection redirects to SSO. The public domain is the real smoke target.
- Redis URL values pasted with quote characters can break Upstash. `src/lib/redis.ts` normalizes wrapping quotes, but the env values should still be clean in Vercel.
- The app lives in a nested repo. Keep git commands in `mtg-serial-tracker`.
- The first card API request seeds initial card slots in Redis.
