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

This is an **npm workspaces monorepo** with four packages: `shared`, `server`, `client`,
and `mobile` (Expo / React Native, targeting iOS + Android; see Mobile app below).

## Directory structure

```
.
├── client/                 # React + Vite SPA
│   └── src/
│       ├── components/      # Layout, nav, toasts, CubeDiagram, ScramblePanel, Modal, shared settings UI
│       ├── data/           # Hardcoded alg sets (OLL/PLL/F2L/COLL + 2×2 OrtegaOLL/PBL/CLL/EG-1/EG-2)
│       ├── features/       # One folder per feature (see Routes below)
│       ├── lib/            # axios api client, scramble helper, cstimer import, time-input parsing, move metrics
│       ├── store/          # Zustand stores: auth, settings, toast, ui
│       ├── types/          # Ambient module declarations (cubing.js)
│       ├── App.tsx          # Router + route guards
│       └── main.tsx
├── server/                 # Express API + Socket.io
│   └── src/
│       ├── auth/           # jwt helpers, requireAuth/optionalAuth, betaGate
│       ├── routes/         # auth, sessions, solves, wca, profile, battle, alg, algSolves,
│       │                   # scramble, reconstructions, cubingContests
│       ├── util/dto.ts     # Prisma model -> DTO mappers
│       ├── cache.ts        # Redis-or-in-memory cache for the WCA proxy
│       ├── scramble.ts     # cubing.js (worker) + scrambow wrappers
│       ├── socket.ts       # Battle Mode realtime server
│       ├── app.ts          # Express app (helmet, cors, compression, rate-limit, error handler)
│       └── index.ts        # HTTP server + Socket.io bootstrap
├── mobile/                 # Expo (React Native) app for iOS + Android
│   └── src/
│       ├── components/     # Screen shell, sheets, ScrambleView, shared settings UI
│       ├── features/       # One folder per tab (timer/ is the only fully built one)
│       ├── lib/            # api (bearer axios), tokens (expo-secure-store), socket, beta
│       ├── navigation/      # Bottom tab bar + Timer/More stacks
│       ├── store/          # Zustand: auth, settings, serverConfig
│       └── App.tsx         # Beta gate + themed NavigationContainer
├── shared/                 # Types + logic shared by client, server & mobile
│   └── src/
│       ├── index.ts        # DTOs, WCA event list, socket event types, time formatting
│       ├── averaging.ts    # WCA trimmed average + mean (drop best/worst, DNF rules)
│       └── timerStats.ts   # Rolling/best averages, BPA/WPA/target, PB detection
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
| `npm run dev`            | Run server + client + mobile (Expo) concurrently    |
| `npm run dev:server`     | Server only (tsx watch)                            |
| `npm run dev:client`     | Client only (vite)                                 |
| `npm run dev:mobile`     | Mobile only (`expo start`)                          |
| `npm run build`          | Build shared, server, client, then mobile           |
| `npm run build:web`      | Build shared, server, client only (the deploy build) |
| `npm run build:mobile`   | `expo export` for iOS + Android                     |
| `npm run typecheck`      | `tsc --noEmit` across all four packages              |
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
| `/algorithms`, `/algorithms/:tab`, `/algorithms/:tab/:puzzle`, `/algorithms/:tab/:puzzle/:setId` | Algorithm Trainer — puzzle picker (3×3 + 2×2); Library (browse/study) and Trainer (drill with timing, spaced repetition, per-case stats) tabs; 3×3: OLL/PLL/F2L/COLL; 2×2: OrtegaOLL/PBL/CLL/EG-1/EG-2 |
| `/algorithms/trainer/:puzzle/:setId/stats`                   | Per-case stats/PB view for one algorithm set                     |
| `/alg-trainer`                                               | Redirects to `/algorithms` (legacy path)                          |
| `/battle`, `/battle/:code`                                   | Real-time multiplayer Battle Mode, up to 10 players per room (Socket.io) |
| `/reconstruction`, `/reconstruction/:id`                     | 3D scramble+solution playback (cubing.js), shareable by id        |
| `/results`, `/results/:wcaId`                                | WCA competitor lookup + results history + official/unofficial (CubingContests) results |
| `/settings`                                                  | Appearance (light/dark, color themes, accent), Account, password change, session |
| `/login`                                                     | WCA OAuth + email/password                                        |
| `/relays`, `/relays/run`, `/relays/share/:id` | Multi-event relays — solo/custom, on the main site |
| `/relays/team`, `/relays/team/:code` | Real-time team relay (Socket.io) — **beta-only**, see Beta site below |

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
- **Alg data** is hardcoded in `client/src/data/` (full OLL 57, PLL 21, F2L 41, COLL 40;
  2×2: OrtegaOLL 7, PBL 6, CLL 42, EG-1 42, EG-2 42). Spaced repetition uses
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
- **Mobile app** (`mobile/`, Expo SDK 54 / React Native, iOS + Android). See
  **`mobile/HANDOFF.md`** before working on it: development history, the
  decisions that are load bearing, layout traps that each reached a tester
  once, and what is still open. This section says what the app is; that says
  how it got here and what not to undo. Pinned to SDK
  54, not the current Expo release, because Apple's App Store review has been holding
  up new Expo Go builds since SDK 55 (its App Store listing was stuck on 54 as of this
  writing), so a project on a newer SDK than that gets "Project is incompatible with
  this version of Expo Go" from Expo Go with no fix available client-side, since there
  is no newer build in the App Store to install. Bumping past 54 for Expo Go testing
  needs one of: `eas go` (build your own Expo Go client, needs an Apple Developer
  Program membership), the public Expo Go TestFlight beta (free, but capacity-limited
  and not always open), or a custom dev client via EAS/`expo run`. Re-check whether
  Apple's review has cleared before assuming SDK 54 is still the ceiling; if it has,
  bumping back up is a normal `npx expo install expo@<newer>` + `npx expo install --fix`,
  the same mechanism used to pin here. Talks to the
  same server and database as the web client, so a user's solves, sessions and
  reconstructions are identical on both, and a Battle room created on one platform is
  joinable from the other. Feature *logic* is shared, never reimplemented: anything
  both clients compute (averaging, the Timer's whole stats table, scramble/alg types,
  socket event types) lives in `shared/`; `shared/src/timerStats.ts` was moved out of
  `client/src/features/timer/stats.ts` for exactly this reason, and that old path is now
  a re-export so no web import changed.
  The *interface* is deliberately not a port of the desktop layout: navigation is a
  bottom tab bar (Timer / Algorithms / Battle / Relays / More) with **no Home tab**
  (a sidebar needs a landing slot, a tab bar doesn't), and the desktop Timer's
  permanently-visible stats table and solves list became pushed sub-screens
  (`navigation/TimerStack.tsx`), leaving only the last solve and current Ao5 on screen
  while solving. Beyond the Timer, tabs are stubs.
  - **Auth is bearer-token, not cookie.** A native client has no cookie jar, so it
    sends `X-Auth-Mode: bearer` to `/api/auth/{login,register,refresh}` and gets the
    JWT pair in the response body, stores it in `expo-secure-store` (which is
    encrypted, unlike `AsyncStorage`), and sends `Authorization: Bearer <access>`. Socket.io
    handshakes pass the same token via `socket.handshake.auth.token`. Both are
    additive fallbacks checked *after* the cookie, minted by the same
    `signAccessToken`/`signRefreshToken` with the same TTLs and `tokenVersion`
    semantics. It is a second transport for one credential, not a second auth path. The
    web client sends neither header and is byte-for-byte unaffected.
  - **Beta gating** mirrors web's two layers (see Beta site below) rather than
    inventing a third scheme: `mobile/src/lib/beta.ts` composes "is this the beta
    deployment" with "does this account have `betaAccess`". The one necessary
    difference is detecting the former: a single binary can't be "the beta build"
    the way a Vite build can, so it asks `GET /api/auth/config` (`betaSite`) instead
    of reading a compile-time constant.
  - **Metro monorepo resolution was verified, not assumed**: Expo's default config
    already auto-detects the npm workspace (every workspace in `watchFolders`, root
    `node_modules` in `resolver.nodeModulesPaths`), so `@scc/shared` resolves from
    `mobile/` with no extra `watchFolders`/`nodeModulesPaths` config needed,
    confirmed by finding shared's own event data inside the built Hermes bundle. It
    resolves to `shared/dist`, same as the web client, so `build:shared` (or
    `postinstall`) must have run. One gotcha: because Metro's server root is the
    workspace root, the dev bundle URL is `/mobile/index.bundle?…`, not
    `/index.bundle?…`.
  - **`metro.config.js` is still required**, though, for a different reason: a
    duplicate-React bug. npm hoists any workspace dependency with no version
    conflict to the monorepo root regardless of whether that dependency is
    React-instance-sensitive: `zustand`, `@react-navigation/core`, and
    `@react-navigation/routers` all ended up there. Metro's default resolver walks
    UP from wherever the *requesting* package physically sits before consulting its
    explicit `nodeModulesPaths`, so a hoisted package finds the repo root's React
    (`client`'s React 18) via that walk before ever reaching mobile's own React 19,
    producing two React instances in one bundle ("Invalid hook call", "Cannot read
    property 'useCallback' of null"). `resolver.disableHierarchicalLookup = true`
    closes this but is too blunt: it also breaks legitimate uses of the same
    walk-up, like `expo` resolving its own privately-nested `expo/node_modules/
    expo-asset`. The actual fix in `mobile/metro.config.js` is a
    `resolver.resolveRequest` override that forces only the specific
    singleton-sensitive names (`react`, `react-native`, `scheduler`,
    `use-sync-external-store`, matched including subpath imports like
    `react/jsx-runtime`) to resolve as if requested from inside `mobile/`, leaving
    Metro's default resolution (walk-up included) untouched for everything else.
    Verified by parsing a live dev bundle's module registrations directly: exactly
    one `react/index.js` module exists in the graph, and every consumer that
    matters — including packages physically hoisted to the repo root, like
    `zustand/react.js` and `use-sync-external-store`'s own internal `require('react')`
    — depends on that same module ID.
  - `npm run build` includes `expo export`. Deploys that only need the server and web
    client should use **`npm run build:web`** to skip it.
- **Beta site**: `beta.speedcubingcentral.com` is a second hosted instance of
  this exact app (same repo/branch, `npm run build && npm start`), sharing the
  main site's production database — not a separate deployment pipeline or a
  divergent branch, deliberately, since this repo's `start` script runs
  `prisma db push` on every boot and two branches with different schemas
  pointed at one database could otherwise drop each other's tables/columns.
  The `start` script intentionally omits `--accept-data-loss` (added after a
  data-loss incident where a boot silently dropped columns/tables): a
  destructive schema diff now makes `db push` exit non-zero and the boot
  fails loudly instead of silently applying it. If a deploy ever fails to
  start with a data-loss warning from `db push`, that means beta/main have
  drifted out of schema sync (or a genuinely destructive schema change needs
  a manual, reviewed migration), so investigate before forcing it through;
  do not just re-add the flag. Two flags gate the beta-only pieces instead: `BETA_SITE`
  (server env var, `server/src/env.ts`) / `VITE_BETA_SITE` (matching client build-time
  var, read via `client/src/lib/betaSite.ts`'s `IS_BETA_SITE`) is true only
  on the beta-hosted service and controls which features exist there at all
  (currently: Team Relay — its room endpoints in `relays.ts`, the Socket.io
  relay handlers, the `/relays/team*` routes, and the "Team Relay" button on
  `/relays` are all absent/hidden unless this is set; solo/custom relays
  ship on both sites). `User.betaAccess` (Prisma boolean)
  controls *who* can use the beta site once reached — checked fresh from the
  database on every request (`server/src/auth/betaGate.ts`, applied globally
  in `app.ts` right after the `/api/auth` mount, plus inside Socket.io's
  shared `io.use()`) rather than trusted from the JWT, so revoking access is
  immediate. Gating is whole-site, not per-feature, matching "only certain
  users have access to the beta site" — `/login` stays reachable either way.
  There's no admin UI for granting `betaAccess`; toggle it per-account via
  `npm run prisma:studio` against the shared database, same as any other
  manual admin-less edit in this project.
- **No BLD trainer, daily challenge, or goals/rankings pages.** These existed as backend
  scaffolding (`bld.ts`, `daily.ts`, `UserGoal`, WCA `/rankings` + `/competitions` proxy
  endpoints) with no client UI ever calling them, and have been removed. `profile.ts` now
  only handles the display-name update actually used by `/settings`; `wca.ts` only the
  competitor lookup/search actually used by `/results`. If reviving one of these, it'll
  need to be built from scratch — there's nothing partially-there to resume.

## Environment variables

See `.env.example`. `WCA_CLIENT_ID` / `WCA_CLIENT_SECRET` are only needed for WCA OAuth —
email/password auth and all client-side tools work without them. `REDIS_URL` is optional.
`BETA_SITE` / `VITE_BETA_SITE` should only ever be set (to `true`) on the beta-hosted
service — see Beta site above.
