# Mobile app: development history and handoff

Written for whoever picks this up next. `CLAUDE.md` (repo root) describes what
the mobile app *is*; this describes how it got here, which decisions are load
bearing, what has already been tried and rejected, and what is still open.

Read the "Traps" section before touching the Timer layout. Most of it was
learned by shipping something wrong to a real tester first.

---

## 1. What exists

Expo SDK 54 / React Native, iOS + Android, in the `mobile/` npm workspace
alongside `shared/`, `server/`, `client/`. Same server and database as the web
client, so solves, sessions and Battle rooms are shared across platforms.

**Complete:** auth (email/password + native WCA), the Timer tab and its
sub-screens (Statistics, Solves, Sessions, Timer settings), scramble images for
every event, settings, beta gating.

**Stubs** (render a "not in this build" panel, `components/StubScreen.tsx`):
Calculator, Reconstruction, Results. Algorithms, Battle and Relays are partial:
they render real state but no gameplay.

Navigation is a bottom tab bar with **no Home tab** (`navigation/RootNavigator.tsx`).
A sidebar needs a landing slot; a tab bar doesn't. Timer is the initial route.

---

## 2. Architecture decisions that are load bearing

### Logic lives in `shared/`, never reimplemented

Anything both clients compute is in `shared/`: averaging, the whole Timer stats
table (`timerStats.ts`), clipboard formatting (`copy.ts`), scramble/alg types,
socket event types. `client/src/features/timer/stats.ts` and `copy.ts` are now
re-exports from `shared/` so no web import changed when they moved.

If you find yourself writing a calculation on mobile, check `shared/` first. The
whole point is that the same solve cannot display two different numbers.

### Auth is bearer-token, not cookie

A native client has no cookie jar. The app sends `X-Auth-Mode: bearer` to
`/api/auth/{login,register,refresh}` and gets the JWT pair in the response body,
stores it in `expo-secure-store` (encrypted; **not** `AsyncStorage`), and sends
`Authorization: Bearer`. Socket.io passes the same token via
`socket.handshake.auth.token`.

Both are additive fallbacks checked *after* the cookie, minted by the same
`signAccessToken`/`signRefreshToken` with the same TTLs and `tokenVersion`. The
web client sends neither header and is byte-for-byte unaffected.

### Native WCA sign-in polls; it does not deep-link

`POST /wca/start` returns `{ flowId, authorizeUrl }`; the app opens the URL in
the system auth browser and polls `POST /wca/poll` (202 while pending, then the
token pair, once).

**Do not "simplify" this back to a custom-scheme redirect.** That was built
first and reverted. Two reasons: the app must supply the return URL (it differs
between a standalone build and Expo Go), which makes it an open-redirect
surface guarding a session credential; and Expo Go owns no custom scheme, so
testing against a deployed server needed a standing env-var exception. Polling
removes the redirect target entirely and works identically in Expo Go, a dev
client and a store build.

### Scramble images are bundled cubing.js, not a server call

`lib/cubingSvg.ts` renders scramble images using cubing.js's own 2D artwork, so
the picture matches the web client exactly and every side event works (megaminx,
pyraminx, skewb, square-1, clock, FTO, kilominx, redi).

Bundled deliberately: the Timer must work with no network. Costs ~0.58 MB. Only
`cubing/puzzles` is imported. `cubing/scramble` is the part carrying WASM and
Web Workers, and scrambles already come from the server.

A hand-written NxN facelet simulator (`lib/cubeNet.ts`) preceded this and was
deleted. cubing.js covers a strict superset.

### WCA Regulation 9f rounding

Singles are **truncated** to the hundredth; averages and means are **rounded**,
and are computed from the *truncated* singles, not raw milliseconds. Five solves
of exactly 10.005s average to 10.00, not 10.01.

`formatTime` truncates; `averaging.ts` rounds. One rule in `formatTime` covers
both because an average arrives already rounded to an exact hundredth, so
truncating it is a no-op. **Deliberately not implemented:** 9f's rule that
results over 10 minutes report to the nearest second. This is a practice timer
and hundredths stay useful on a 12-minute 7x7.

---

## 3. Traps

Each of these was a real bug that reached a tester. They are cheap to
reintroduce.

### `adjustsFontSizeToFit` fits WIDTH only

It will not stop text being too tall. On a short tile the glyphs keep full
height and are sliced by a clipped edge. Adding `flexShrink` makes it *worse*:
the box shrinks while the glyph doesn't, which is what produces the slicing.

The fix used throughout: measure the container with `onLayout` and derive the
font size from the measured height. See `timerTileH` in `TimerScreen.tsx`.

### `flex: 1` inside an auto-height parent collapses to zero

`flex: 1` means `flexBasis: 0`. A flexBasis-0 child of a content-sized parent
contributes nothing to its parent's height and has no free space to grow into,
so it resolves to **zero height**. This hid the scramble image and stats
entirely once, and the timer swallowed the space they vacated.

Flex shares belong on the element that is a real sibling in a definite-height
container, not on the thing you happen to want sized.

### React Native leaves `flexShrink` at 0

Auto-height siblings never give way. Whatever *is* flexible becomes the only
thing that can shrink, and it shrinks to nothing. Floors (`minHeight`) are what
stop this; several exist in `TimerScreen.tsx` and they are not decorative.

### OS text scaling is not optional

iOS Dynamic Type at max multiplies labels ~1.35x. Text whose size the layout
depends on must cap it (`maxFontSizeMultiplier`, see `maxFontMultiplier` in
`lib/scale.ts`) or opt out entirely (the timer digits use
`allowFontScaling={false}` because they are sized from a measured box).

### Metro strips JSX comments

`{/* … */}` does not survive into the bundle; `//` comments do. Do not use a JSX
comment as a marker to verify a change shipped: it will look stale when it
isn't. Grep for code instead (a distinctive call or literal).

### react-native-svg drops one `<g>` per net

On an NxN or megaminx net exactly one face rendered blank, and *which* face
changed depending on unrelated markup. The SVG we produce is provably sound
(well-formed, all faces, no duplicate ids, everything inside the viewBox).
`flattenBareGroups` in `lib/cubingSvg.ts` unwraps the attribute-less face
groups, which removes the renderer's group handling from the picture. It
deliberately keeps `<g>` elements that carry attributes: 3x3's
`<g id="puzzle" transform="…">` holds the whole drawing's positioning.

### Metro's file watcher can go stale

After a long session (especially with tunnel flapping) Metro can report
`Bundled 47ms (1 module)` and serve a bundle without your edits. `npx expo start
--clear` fixes it. Verify a change reached the bundle by grepping the *served*
bundle for code, not by trusting the log.

---

## 4. Testing approach

There is no simulator on the development machine (Windows), so layout is
verified with **Yoga, React Native's actual layout engine**, via the
`yoga-layout` npm package. The Timer column is built node-for-node and measured
across 5 devices x 4 scramble depths x 3 font scales x penalty present or not.

That harness lives in the scratchpad, not the repo. **Recreate it before
changing the Timer layout**. It is the only thing that catches "fits on my
phone, clips on an SE". Model the column, then assert the timer keeps usable
height and the stats row survives; asserting "it fits" alone is nearly
tautological because flex children absorb by definition.

Other suites written during development (also scratchpad, recreate as needed):
bearer auth and web-cookie non-regression, Timer stats parity against the live
web UI cell for cell, beta gating on both transports, cross-platform Battle room
join, cube-simulator correctness, WCA 9f rounding, clipboard format.

---

## 5. Environment gotchas

- **Expo SDK is pinned to 54** because Apple's App Store review has been holding
  up new Expo Go builds since SDK 55. A project on a newer SDK gets "Project is
  incompatible with this version of Expo Go" with no client-side fix. Re-check
  whether that cleared before assuming 54 is still the ceiling.
- **`metro.config.js` is required** for a duplicate-React bug: npm hoists
  React-instance-sensitive packages to the repo root, and Metro's default
  resolver walks up from the requesting package before consulting
  `nodeModulesPaths`, finding the root's React 18 instead of mobile's React 19.
  The fix forces only `react`, `react-native`, `scheduler` and
  `use-sync-external-store` to resolve from `mobile/`.
- **`@scc/shared` resolves to `shared/dist`**, so `build:shared` (or
  `postinstall`) must have run.
- **The dev bundle URL is `/mobile/index.bundle`**, not `/index.bundle`, because
  Metro's server root is the workspace root.
- **`EXPO_PUBLIC_API_URL`** picks the server (see `.env.example`). `localhost` is
  the *phone* from the app's perspective; use the machine's LAN IP for local dev,
  or `https://speedcubingcentral.com` for production data.
- **WCA sign-in only works against the deployed server.** The authorize URL
  carries whatever `WCA_REDIRECT_URI` that server is configured with, and WCA
  rejects any redirect URI not registered on the OAuth application ("The
  requested redirect URI is malformed or doesn't match the client redirect
  URI"). A dev server's default is `http://localhost:3001/...`, which is both
  unregistered and, from a phone, the phone itself. `/api/auth/wca/start` now
  refuses to start a flow whose callback host isn't the host the app reached it
  on, so this reports itself in the app instead of dead-ending on WCA's site.
  The native flow needs that equality anyway: the flow lives in one server
  process's memory, so the callback has to come back to the same process the app
  is polling.
- **`npm run build` includes `expo export`.** Server/web deploys should use
  `npm run build:web`.

---

## 6. Design direction

Agreed with the owner after two rejected attempts. The direction is **"Focus"**:
the Timer is an instrument, not a card grid.

- The timer digits are the focal point, on **no surface at all**. A fill behind
  them says "this is one thing among several", which is the wrong reading.
- The scramble is **text on the page**, not a panel. It is something you read,
  not a control you operate.
- One card at the bottom: the last solve beside the penalty buttons that act on
  it, then three figures (Ao5, Ao12, best).
- Everything except the digits hides during an attempt.

**What was rejected and why:** copying the web client's card vocabulary onto a
phone. The website uses cards because a desktop grid has room; on a phone it
became five stacked bordered boxes of equal visual weight, and nothing read as
important because everything did.

Only three figures are on the Timer. Six took as much height as the timer
itself, making the screen read as two equal halves. Ao100, mean and solve count
are session totals and live on the Statistics screen.

`lib/scale.ts` holds the responsive rules: a screen-size multiplier bounded
0.82–1.10 (taking the *smaller* of the height and width ratios, so text never
outgrows the tight axis) and a `Density` tier that **drops** content in a fixed
order rather than shrinking everything until something clips.

---

## 7. Open items

- **The visual design is not settled.** The owner rejected two passes. The last
  one landed but has not been confirmed as liked. Ask before assuming the
  current look is approved. Next levers, if asked to go further: the header and
  the scramble controls still carry more chrome than the agreed direction.
- **`shared/` has three require cycles** (`index → averaging → index`, same for
  `timerStats` and `copy`). Harmless today, visible as a Metro warning on every
  start, and the kind of thing that becomes "undefined is not a function" after
  an innocent import change.
- **Session names truncate in the Timer header** on narrow screens. Partly
  mitigated by the compact event badge. A real fix needs a design decision about
  what gives way.
- **Stub tabs**: Calculator, Reconstruction, Results. Battle, Algorithms and
  Relays need gameplay.
- **Alg diagrams**: investigated, not built. `pg().get3d()` returns cubing.js's
  3D geometry headlessly (stickers with `coords`/`color`/`orbit`/`ord`/`ori`),
  and `stickeringMask()` works too, so the web `PG3D` diagrams could be
  reproduced by projecting to `react-native-svg` without WebGL. Not prototyped.
- **iOS store builds need an Apple Developer account.** Deliberately deferred;
  it is also what a dev client would need.

---

## 8. Working with the owner

- They test on a real device via Expo Go, often relaying feedback from a second
  tester. Screenshots are the main signal.
- Iteration is over an Expo **tunnel** (`--tunnel`, `@expo/ngrok`), so fixes
  reach testers by reload without a new link. The tunnel flaps; a 503 usually
  self-heals within seconds. Restarting the dev server mints a **new URL**.
- They ask for commits and pushes without being prompted.
- **No em dashes** anywhere: code, comments, UI copy, commit messages. Rewrite
  with a comma, period or parentheses. The one exception is the bare `'—'`
  string used as the empty-value placeholder in stats cells, which matches the
  web client's own glyph and must stay.
