# Speedcubing Central

A full-stack speedcubing platform: timer, algorithm trainer, WCA results & rankings,
real-time Battle Mode, and a 3D scramble/solution reconstruction viewer.

## Stack

| Layer      | Technology                                                        |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | React 18 + TypeScript + Vite                                      |
| Styling    | Tailwind CSS (dark mode default, `#0f1117` / `#1e2130` / `#2b72ff`) — see Themes below |
| State       | Zustand (auth, settings, toasts, ui) + TanStack Query (server state) |
| Backend    | Node.js + Express + TypeScript (ESM / NodeNext)                   |
| Database   | PostgreSQL via Prisma ORM                                         |
| Realtime   | Socket.io (Battle Mode)                                           |
| Auth       | WCA OAuth 2.0 + JWT email/password fallback (httpOnly cookies)    |
| Scrambles  | `cubing.js` random-state (TNoodle-quality) server-side, `scrambow` fallback |
| 3D cube    | `cubing.js` (`<twisty-player>`) for reconstruction & alg diagrams |
| Puzzle icons | `@cubing/icons` CSS icon library (`<span className="cubing-icon event-333">`) |

This is an **npm workspaces monorepo** with three packages: `shared`, `server`, `client`.

## Directory structure

```
.
├── client/                 # React + Vite SPA
│   └── src/
│       ├── components/      # Layout, nav, toasts, CubeDiagram, ScramblePanel, Modal, shared settings UI
│       ├── data/           # Hardcoded alg sets (OLL/PLL/F2L/COLL/ZBLL + 2×2 OrtegaOLL/PBL/CLL/EG-1/EG-2)
│       ├── features/       # One folder per feature (see Routes below)
│       ├── lib/            # axios api client, scramble helper, cstimer import, time-input parsing, move metrics
│       ├── store/          # Zustand stores: auth, settings, toast, ui
│       ├── types/          # Ambient module declarations (cubing.js)
│       ├── App.tsx          # Router + route guards
│       └── main.tsx
├── server/                 # Express API + Socket.io
│   └── src/
│       ├── auth/           # jwt helpers, requireAuth/optionalAuth
│       ├── routes/         # auth, sessions, solves, wca, profile, battle, alg, algSolves,
│       │                   # scramble, reconstructions, cubingContests
│       ├── util/dto.ts     # Prisma model -> DTO mappers
│       ├── cache.ts        # Redis-or-in-memory cache for the WCA proxy
│       ├── scramble.ts     # cubing.js (worker) + scrambow wrappers
│       ├── socket.ts       # Battle Mode realtime server
│       ├── app.ts          # Express app (helmet, cors, compression, rate-limit, error handler)
│       └── index.ts        # HTTP server + Socket.io bootstrap
├── shared/                 # Types + averaging logic shared by client & server
│   └── src/
│       ├── index.ts        # DTOs, WCA event list, socket event types, time formatting
│       └── averaging.ts    # WCA trimmed average + mean (drop best/worst, DNF rules)
├── prisma/schema.prisma    # Database schema
├── scripts/                # start-embedded-pg.mjs (no-Docker local Postgres)
├── docker-compose.yml      # Local Postgres convenience
└── .env.example
```

## Getting started

```bash
# 1. Install (also builds shared/ and generates the Prisma client)
npm install

# 2. Start Postgres — pick ONE:
npm run db:up                # (a) Docker: docker compose up -d
# --- or, if you don't have Docker (e.g. Windows) ---
npm run db:embedded:init     # (b) one-time: download + init an embedded Postgres
npm run db:embedded          #     then run this in its own terminal to keep it up

# 3. Configure environment
cp .env.example .env         # then fill in WCA_CLIENT_ID / SECRET for OAuth (optional)

# 4. Create the schema + seed demo data
npm run db:setup             # prisma db push + seed
#   (or: npm run prisma:migrate  to create versioned migrations — the project
#    doesn't currently use them; schema changes are applied via `db push`)

# 5. Run both server (:3001) and client (:5173)
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/socket.io` to the
backend, so no CORS setup is needed in development.

### Seeded accounts

| Role  | Email                        | Password    |
| ----- | ----------------------------- | ----------- |
| User  | `demo@speedcubing.central`    | `demo1234`  |

There is no admin account or admin role — see Roles below.

## Key commands

| Command                  | Description                                       |
| ------------------------ | -------------------------------------------------- |
| `npm run dev`            | Run server + client concurrently                   |
| `npm run dev:server`     | Server only (tsx watch)                            |
| `npm run dev:client`     | Client only (vite)                                 |
| `npm run build`          | Build shared, server, then client                  |
| `npm run typecheck`      | `tsc --noEmit` across all three packages            |
| `npm run db:up`          | Start the Postgres container                        |
| `npm run db:setup`       | `prisma db push` + seed                             |
| `npm run prisma:migrate` | Create/apply a versioned migration (unused so far)  |
| `npm run prisma:push`    | `prisma db push` only                               |
| `npm run prisma:studio`  | Open Prisma Studio                                  |
| `npm run prisma:seed`    | Seed demo data                                      |

## Routes (client)

| Path                                                       | Feature                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `/`                                                         | Landing (logged out) / Dashboard (logged in)                     |
| `/timer`                                                    | Timer — spacebar/touch or manual entry, inspection, live Ao5/12/50/100, sessions, cstimer import, bulk delete |
| `/calculator`                                                | Average / mean calculator (Ao5…Ao100, Mo3, MoX) + target-time solver |
| `/algorithms`, `/algorithms/:tab`, `/algorithms/:tab/:puzzle`, `/algorithms/:tab/:puzzle/:setId` | Algorithm Trainer — puzzle picker (3×3 + 2×2); Library (browse/study) and Trainer (drill with timing, spaced repetition, per-case stats) tabs; 3×3: OLL/PLL/F2L/COLL/ZBLL; 2×2: OrtegaOLL/PBL/CLL/EG-1/EG-2 |
| `/algorithms/trainer/:puzzle/:setId/stats`                   | Per-case stats/PB view for one algorithm set                     |
| `/alg-trainer`                                               | Redirects to `/algorithms` (legacy path)                          |
| `/battle`, `/battle/:code`                                   | Real-time head-to-head Battle Mode (Socket.io)                    |
| `/reconstruction`, `/reconstruction/:id`                     | 3D scramble+solution playback (cubing.js), shareable by id        |
| `/results`, `/results/:wcaId`                                | WCA competitor lookup + results history + official/unofficial (CubingContests) results |
| `/settings`                                                  | Appearance (light/dark, color themes, accent), Account, password change, session |
| `/login`                                                     | WCA OAuth + email/password                                        |

## Conventions & notes

- **Module system:** server & shared are ESM (`"type": "module"`, NodeNext). Relative
  imports in the server use explicit `.js` extensions. `scrambow` is CommonJS and is
  imported via a default-interop shim in `server/src/scramble.ts`.
- **Auth:** access (15 min) + refresh (7 day) JWTs in httpOnly cookies. The axios client
  (`client/src/lib/api.ts`) auto-refreshes on a 401 and replays the request once.
- **Roles:** only `GUEST` (not logged in — timer/calculator/trainers work; solves saved
  to `localStorage` only) and `USER` (full access, server-persisted). There is no admin
  role in the current schema.
- **Themes:** `client/src/store/settings.ts` has 6 preset dark-mode palettes (Default,
  Violet, Forest, Crimson, Amber, Slate), each bundling background/card/border/accent
  colors as CSS custom properties (`--color-*`) that `tailwind.config.js` reads via
  `rgb(var(--color-x) / <alpha-value>)`, so switching themes needs no rebuild. Light mode
  has its own separate hardcoded overrides and isn't affected by these presets.
- **Averaging** lives in `shared/averaging.ts` so the client and server compute identical
  Ao5/mean values (trim best + worst; >1 DNF in the trimmed set ⇒ DNF). Average/solve
  lists (`AverageDetail`, its clipboard copy) render in chronological order (first solve
  first) even though the underlying solves array is stored newest-first.
- **WCA API** is *only* called server-side, through `cache.ts` (1-hour TTL; Redis when
  `REDIS_URL` is set, otherwise in-memory node-cache). The client never calls WCA (or
  CubingContests) directly — `/results` proxies both through `/api/wca/*` and `/api/cc/*`.
- **Scrambles** use cubing.js `randomScrambleForEvent` (random-state, the same family as
  TNoodle, run server-side via `worker_threads`) with a synchronous `scrambow` fallback,
  both client- and server-side. The timer prefetches a small queue of upcoming scrambles
  (`useScrambler`) to hide generation latency (can be a couple of seconds for square-1,
  4x4+, and megaminx); the timer/manual entry/touch input are all blocked while the
  active scramble is still loading so a solve can't be recorded against a stale one.
  Square-1 scrambles legitimately end with a trailing `/` on some (not all) generations —
  `sq1Pairs` in `client/src/lib/scramble.ts` preserves that per-scramble rather than
  assuming it's always present or always absent.
- **Alg data** is hardcoded in `client/src/data/` (full OLL 57, PLL 21, F2L 41, COLL 40,
  ZBLL subset; 2×2: OrtegaOLL 7, PBL 6, CLL 42, EG-1 42, EG-2 42). Spaced repetition uses
  SM-2, persisted per user at `/api/alg/review`. Per-case attempt history/PBs persist via
  `/api/alg-solves` (or localStorage for guests).
- **Alg diagrams** use `cubing.js` `<twisty-player>` with `experimentalSetupAlg = 'x2 ' + invertAlg(moves)`
  to display the unsolved case from above. `puzzle` prop supports `'3x3x3'` and `'2x2x2'`.
  `AlgCase.diagramPrefix` can prepend extra moves to the setup alg for orientation
  corrections (e.g. EG-1 AS 1 uses `diagramPrefix: 'x2'`). F2L cases have `slotAlts` (per-slot
  orientation tabs: Front Right / Front Left / Back Left / Back Right). All diagram
  components live in `client/src/components/CubeDiagram.tsx`.
- **Puzzle icons** use `@cubing/icons` (`import '@cubing/icons'`), rendered as
  `<span className="cubing-icon event-222" />`. The Algorithm Trainer landing shows 3×3
  and 2×2 as available; other puzzles aren't offered there yet.
- **Battle Mode**: `useTimerEngine` (shared with the Timer page) drives both keyboard and
  manual entry, gated on `enabled` (round active, not awaiting a penalty choice, correct
  entry mode). Inspection display for both count directions is capped at the same +2/DNF
  thresholds the engine uses internally when the solve actually starts.
- **Security:** helmet, gzip `compression`, per-IP rate limiting on `/api`, CORS locked to
  `FRONTEND_URL`, and a central error handler that never leaks stack traces to clients.
- **No BLD trainer, daily challenge, or goals/rankings pages.** These existed as backend
  scaffolding (`bld.ts`, `daily.ts`, `UserGoal`, WCA `/rankings` + `/competitions` proxy
  endpoints) with no client UI ever calling them, and have been removed. `profile.ts` now
  only handles the display-name update actually used by `/settings`; `wca.ts` only the
  competitor lookup/search actually used by `/results`. If reviving one of these, it'll
  need to be built from scratch — there's nothing partially-there to resume.

## Environment variables

See `.env.example`. `WCA_CLIENT_ID` / `WCA_CLIENT_SECRET` are only needed for WCA OAuth —
email/password auth and all client-side tools work without them. `REDIS_URL` is optional.
