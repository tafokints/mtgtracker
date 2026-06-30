# AGENTS.md

Project instructions for Codex and other AI coding agents.

## Default Stance

Act like a careful product engineer for MTG Trackers. Read the existing code first, preserve the modular tracker architecture, and complete the request through implementation, verification, and a concise handoff.

This repository is the standalone MTG Trackers app. The parent Golden Chocobo tracker is inspiration and future migration material only. Do not change files outside this nested repo unless the user explicitly requests it.

## Repo Facts

- Framework: Next.js 14 App Router
- Runtime target: Vercel
- Data store: Upstash Redis / Vercel KV REST API
- Live domain: `https://mtgtrackers.com`
- Main branch: `main`
- Git remote: `https://github.com/tafokints/mtgtracker.git`

## Before Editing

Use fast local inspection:

```bash
rg --files
rg "search text"
```

Read the closest files and these docs when relevant:

- `README.md`
- `ARCHITECTURE.md`
- `TODO.md`
- `CLAUDE.md`

## Editing Preferences

- Use `apply_patch` for manual edits.
- Keep changes scoped to the requested behavior.
- Prefer config-driven tracker behavior in `src/lib/trackers.ts`.
- Prefer shared helpers in `src/lib/tracker-data.ts` for card/submission persistence.
- Do not duplicate One Ring-specific logic into new trackers.
- Keep public endpoints conservative and admin endpoints authenticated.
- Do not commit secrets or generated local env files.

## Verification

Always run:

```bash
npm run lint
npm run build
```

Known lint state: there are intentional warnings for plain `<img>` usage in areas that render arbitrary external images. Do not treat those warnings as new failures unless the changed work touches image rendering.

For production/infrastructure changes, also check:

```bash
curl https://mtgtrackers.com/api/health
curl https://mtgtrackers.com/api/trackers/one-ring/cards
```

Expected health result: Redis envs are present and `canWrite`, `canRead`, and `canDelete` are true.

## Deployment Notes

The app accepts either Upstash-style or Vercel KV-style Redis env names:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Use write-capable tokens. Do not use `KV_REST_API_READ_ONLY_TOKEN` for application writes.

## Git Handoff

When code changes are complete:

1. Check `git status --short`.
2. Stage only intended files.
3. Commit with a clear, narrow message.
4. Push `main` when the user has asked to deploy/update the live project or when the ongoing flow expects Vercel to redeploy.

## Product Direction

Build toward a multi-tracker platform:

- Home page and `/trackers` are the umbrella experience.
- Individual trackers are subpages with tracker-specific theme and affiliate links.
- Public users submit discoveries into a pending queue.
- Admins verify, reject, merge, or request more info before canonical card state changes.
- Future trackers may have different card names, sets, serialized quantities, themes, and affiliate targets.

Design for collector trust: source links, evidence images, status clarity, provenance, auditability, and low-friction updates matter more than flashy presentation.
