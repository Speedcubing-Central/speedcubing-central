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
every event, settings, beta gating, and **Battle Mode** (lobby and live rooms,
at feature parity with the web page).

The Timer's bottom strip is a **draggable stats panel** (`features/timer/
StatsPanel.tsx`), not a footer. Collapsed it shows the last solve with its
penalty buttons and ao5 / ao12 / best; dragged up it becomes the full statistics
table and the whole solves list without leaving the Timer. The pushed Statistics
and Solves screens remain, for browsing. Read section 6 before redesigning it and
section 3 before changing how it is positioned.

Battle Mode has the same shape, deliberately (`navigation/BattleStack.tsx`, a
lobby and a room). The room's column *is* the Timer's column, and its right-hand
desktop stack (your stats, the leaderboard, chat, your round history) is a
draggable panel, `features/battle/BattlePanel.tsx`. Two things there were forced
by measurement rather than chosen, and section 3 has both: the cube is dropped
while the penalty controls are up, and the panel's figures row is dropped at the
tightest density.

**Stubs** (render a "not in this build" panel, `components/StubScreen.tsx`):
Calculator, Reconstruction, Results. Algorithms and Relays are partial: they
render real state but no gameplay.

Navigation is a bottom tab bar with **no Home tab** (`navigation/RootNavigator.tsx`).
A sidebar needs a landing slot; a tab bar doesn't. Timer is the initial route.

The bar carries Timer, Calculator, Algorithms and Settings. The web's other four
destinations (Battle, Relays, Reconstruction, Results) open as a second row
above the bar from the three-dot More button, drawn by a hand-rolled bar
(`navigation/BottomBar.tsx`) because the stock one can hide a tab but has
nowhere to put one. Icons are the web sidebar's own, per destination.

Two things there are load bearing. The extra row is a `Modal`, not a view
anchored above the bar: a child drawn outside its parent's bounds gets no
touches on Android, and growing the bar itself would shrink the scene and
reflow the Timer every time it opened. And the bar is drawn *again* inside that
overlay, because the backdrop would otherwise dim the real one and eat every
press aimed at it.

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

### Recording a solve does not wait for the server

The solve is inserted into the list the instant the timer stops, under a
temporary id, and the POST goes out behind it. Everything downstream used to
wait on that round trip: the stats panel kept showing the previous solve and the
previous ao5, the PB overlay held back, and `inputBlocked` stayed true so the
next attempt could not start. On a phone talking to production that is a few
hundred milliseconds of the app looking like it missed the solve, at exactly the
moment a cuber reaches to start the next one.

Three things make that safe, and all three are load bearing:

- **`pendingCreates`** maps the temporary id to the in-flight request, and every
  mutation resolves its id through it before sending. A +2 tapped on a solve
  whose create has not landed waits for that create and then patches the real
  id. Entries are never deleted, because React applies the id swap on its own
  schedule and the UI can still be holding the temporary id for a moment after.
- **A failed create removes the solve again** and says why, and `whenSaved` lets
  the Timer put back the scramble that attempt used, but only if no new attempt
  has started in the meantime.
- **`reload` keeps pending solves**, since they are not in the server's response
  yet and dropping them would make a just-finished solve disappear.

### The next scramble's image is built before the solve ends

Turning a scramble into something react-native-svg will draw is two steps, and
both are plain JS on the thread running the timer: `renderScrambleImage`
(0.35ms for a 3x3, 1.05ms for a 7x7, measured) and then parsing the result,
which is the expensive half because it yields 81 elements for a 3x3 and 313 for
a 7x7, each becoming a native view.

None of that has to happen when the timer stops, and it used to. `useScrambler`
now announces whatever reaches the front of its prefetch queue, seconds ahead of
time, and `lib/scrambleDrawing` prepares it after interactions, in the stretch
where the solver is reading the time they just got. `ScrambleNet` reads the
prepared answer **during render**, not in an effect, so the new cube arrives in
the same commit as the new text rather than a frame after it.

Two things here are easy to undo by accident:

- **`advance()` swaps straight to a prefetched scramble.** It used to clear the
  display first and fetch afterwards, which tore the cube down and rebuilt it on
  every solve. The clearing exists for a real reason, kept in the cold path: a
  scramble left up after a solve reads as the next one, people apply it, and
  they have to undo a scramble they should never have seen. Replacing it with
  the genuine next scramble serves that better than a placeholder does. Do not
  "simplify" the two paths back into one.
- **`preparedScrambleDrawing` is a pure lookup** and must stay one, because it is
  called during render. It deliberately does not touch the LRU on the way past;
  the entry on screen is always the second newest, so it is never near eviction.

`ScrambleView` and `StatsPanel` are memoised and the Timer keeps their callback
props stable with `useCallback`. That is not decoration: one solve pushes about
eight state changes through `TimerScreen`, and an arrow function created in
render defeats the memo completely.

### A Battle participant is owned by exactly one socket

Server-side (`socket.ts`), but a phone is what makes it matter, so it belongs
here too.

A dropped connection does not remove a player immediately: `RECONNECT_GRACE_MS`
(12s) gives them time to come back and resume the same row with the same points.
The hazard is that the server can take up to `PING_TIMEOUT_MS` (90s) to notice
the old connection is dead, and the client reconnects long before that. So for a
minute and a half the participant has two connections, and when the dead one is
finally reaped its disconnect would schedule a cleanup for a player who is
sitting there connected.

That is the bug testers hit: two players, a scramble, and about twelve seconds
later the room reverts to "next round starting" and stays there, because
dropping below two players resets the room to WAITING and only a join ever
starts a round.

`participantOwner` (participantId -> socket.id) fixes it: a disconnect only
cleans up if that socket is still the owner. **A phone hits this far more than a
browser does**, because locking the screen or backgrounding the app drops the
websocket every time and reconnects on resume, so it is not an edge case here,
it is the normal path.

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

Live example, and the reason this trap is still one edit away: `StatsPanel`'s
body is `flex: 1`, and that works only because the panel itself has a definite
height (`expandedH`, derived from the measured column). Give the panel an
auto height "to hug its content" and the body silently becomes zero tall.

### React Native leaves `flexShrink` at 0

Auto-height siblings never give way. Whatever *is* flexible becomes the only
thing that can shrink, and it shrinks to nothing. Floors (`minHeight`) are what
stop this, and the ones in `TimerScreen.tsx` and `StatsPanel.tsx` are not
decorative.

The stats footer no longer competes for a flex share, which is where most of
this trap history came from. The panel is `position: absolute` and the column
reserves its collapsed rectangle with a plain spacer. What remains in the flex
flow is two children, deliberately: the cube image (`IMAGE_FLEX` 1, floored at
`scrambleImageHeight` and capped at `IMAGE_MAX_GROWTH`) and the timer tile
(`TIMER_FLEX` 2.2). They share the leftover height because the digits cannot
absorb it, being limited by the screen's width at that size, so surplus given to
the timer alone becomes a gap above and below the digits rather than a bigger
number. Three consequences to keep in mind:

- `TIMER_MIN_H` in `TimerScreen.tsx` is now a **diagnostic** floor. A shortfall
  has nowhere to go, so if it binds the column overflows and the Yoga harness
  fails its explicit overflow assertion. The real relief valves are
  `ScrambleView`'s content-length font ladder and `density` dropping content.
- The spacer's height comes from the panel measuring itself and reporting up
  (`onCollapsedHeight`). That single number is what keeps the timer's tap
  target and the panel from overlapping. If it is ever wrong or unreported, a
  tap meant for the timer lands on the panel.
- The image box stays mounted while the next scramble loads, and only the
  drawing inside it comes and goes. Unmounting the box collapses a flex child,
  so the timer and the scramble jump up and back down on every solve.

### The Timer column cannot host a text input

The column does not scroll, and on iOS the keyboard is drawn over the screen
without shifting anything under it, so a `TextInput` anywhere in the column is a
control that disappears the moment you use it. Manual entry hit exactly this: the
field was behind the keyboard on every iPhone modelled once the scramble ran past
a line or two.

**A `KeyboardAvoidingView` is not the fix**, and neither is bottom padding. Both
work by taking height away from the column, and every other child there is
auto-height with `flexShrink` 0 (trap 3), so the only thing that can give is the
timer tile, and past that the column overflows a screen that cannot scroll back.
A `translateY` lift avoids that (it changes no layout at all) and was in fact
built, iOS-only, since Android's window resizes on its own. It worked, and it
was still the wrong shape: a workaround for having asked for the keyboard.

So manual entry has its own keypad (`features/timer/Keypad.tsx`) and the Timer
never opens the OS keyboard at all. If you add a text field to this column, you
inherit the whole problem again. Put it in a `Sheet` instead, which is
positioned against the bottom edge and can move without touching the column.

The keypad itself is a `Sheet`, raised by tapping the readout. Its first shape
was a keypad living permanently in the timer tile, which is worth knowing about
because it is the obvious build and it does work: it needed the tile to claim a
`minHeight` sized from the keys, so that Yoga would make the cube give way to
them on a short screen rather than the reverse, and it fitted on every device
modelled (worst case an SE on a 7x7, by 3pt, with the readout down at 15pt).
What it could not fix is that 12 targets is a lot of column to hold open for a
control you touch for a few seconds per solve, and the tile stopped looking like
a timer. As a sheet it costs the column nothing, the readout goes back to being
the same size as the touch timer's digits, and the scramble stays visible above
it while you type.

### Hiding the Timer's chrome by unmounting it costs the frame you stop on

The chrome goes away during an attempt, and the obvious way to write that is
`{!immersive && <>…</>}`. It reads well and it is wrong, because everything it
removes has to be rebuilt at the single worst moment in the app: the frame the
timer stops.

The expensive one is the cube. Unmounting throws away `ScrambleNet`'s rendered
image, so coming back meant a spinner where the cube goes, a cubing.js render,
an SVG parse of a few hundred elements, and two relayouts of the column, all on
the JS thread, on top of the solve being recorded. It reads as the screen taking
a beat to come back, and it starves anything else that needs JS in that moment,
which is how the tab bar could still be missing after the timer had stopped: its
fade-in cannot start until JS is free to start it.

Use `display: 'none'` instead. Yoga drops a display-none node from layout
exactly as if it were absent, so the timer still gets the whole column, but the
subtree stays mounted and keeps its state. The cost of leaving an attempt is
then a layout pass.

Keeping the subtree mounted was necessary and, on its own, was not sufficient:
`advance()` set the scramble to an empty string before fetching, so `ScrambleNet`
cleared its image anyway and the cube was still torn down and rebuilt every
solve. Mounted-but-blanked looks exactly like unmounted. That is fixed
separately (see "The next scramble's image is built before the solve ends"), and
it is worth knowing the two have to hold together: either one alone leaves the
cost in place.

The same reasoning is why the tab bar and the stats panel are never unmounted
either. Anything that has to reappear the instant a solve ends should already
exist.

### Two sheets that can be open at once must be nested, not siblings

A `Sheet` is a React Native `Modal`. On iOS a Modal presents itself from
`reactViewController`, which walks the **UIResponder chain** to the first view
controller above it (`UIView+React.m`). Two sibling modals therefore both find
the root view controller, so the second one asks a controller that is already
presenting to present again, and UIKit refuses. No error reaches JS. The sheet
just never appears.

That is what "the event picker does nothing when creating a room" was.

Fabric mounts a modal's children into its **own**
`RCTFabricModalHostViewController` (`mountChildComponentView` in
`RCTModalHostViewComponentView.mm`), so a Sheet rendered *inside* another
Sheet's children walks up to that controller instead, which is presenting
nothing and can present it. `Modal` is `position: absolute`, so nesting one
costs the parent no layout.

Sheets that are merely **mutually exclusive** are fine as siblings, which is why
the host's copy of the same picker in the Battle room always worked, and why
every sheet on the Timer screen does. The rule is about sheets that can be open
*simultaneously*.

Nesting has one consequence to handle: closing the outer sheet unmounts the
inner one without its own `onClose` running, so reset the inner sheet's flag
when the outer one closes or it will be up again on reopen.

### A Battle room cannot show the cube and the penalty controls at once

Not a preference. Measured in Yoga across five devices, seven events and three
text sizes: with both present the room column overflowed on **every device
modelled** for the deep-scramble events, and on an iPhone SE even for a 3x3. The
screen does not scroll, so overflow does not mean cramped, it means the penalty
buttons are off the bottom of the display and the round cannot be submitted at
all. That exact failure reached a tester on the Timer once already.

So the cube goes `display: 'none'` the moment a solve is stopped (`solveOver` in
`BattleRoomScreen`). It is the right thing to lose anyway: once you have stopped
the timer the cube answers a question you are done with.

Two smaller consequences of the same squeeze, both also measured:

- The room sizes its cube **one density tier tighter** than the column reports.
  The room carries a header the Timer has no equivalent of and must keep space
  for controls that appear mid-round. Without it an SE on a square-1 scramble
  overflowed by 10pt, square-1 being the one puzzle whose artwork is taller than
  it is wide.
- `BattlePanel` drops its three-figure row at `minimal` density and moves the
  points into the row above, so the strip is one row instead of two.

Recreate the harness (`scratchpad`, same approach as the Timer's) before
changing this column. It is the only thing between an edit here and a tester who
cannot submit a time.

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

The column to model is now five nodes: header, scramble (text and its control
row, auto height), the cube image (`IMAGE_FLEX`, floored and capped), the timer
tile (`TIMER_FLEX`, floored at `TIMER_MIN_H`), and a spacer holding the
collapsed panel's height. The panel is out of the flex flow, so model it as that
spacer and assert separately that `expandedH` leaves `MIN_TIMER_VISIBLE_H`.

Assert three things, not one. The column does not overflow (nothing auto-height
can shrink to absorb a shortfall). The timer keeps usable height at every
scramble depth. And the image stays at or above its legibility floor, since it
is now the other claimant on the same surplus and is the one that gives way
first.

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
  them says "this is one thing among several", which is the wrong reading. The
  phase colour is carried by the whole screen instead, mixed into the background
  at 12% (`screenTint`, and `mix` in `theme.ts`): a Stackmat's mat is the field
  of view, not a widget in it. Red under your hands, green when it will start.
- The scramble is **text on the page**, not a panel. It is something you read,
  not a control you operate. Its image sits directly under it, because it
  answers a question about the scramble.
- One surface at the bottom, the stats panel: the last solve beside the penalty
  buttons that act on it, then three figures (ao5, ao12, best). Dragging it up
  reveals the full statistics and the solves list.
- Everything except the digits hides during an attempt.
- Manual entry is the same screen, not a different one: the same tile, showing
  the time you are entering instead of the time you just did. Tapping it raises
  the keypad from the bottom, so the keys exist only while you are using them.
  Digits only, shifting in from the right the way cstimer does (1,2,3,4 is
  12.34), which is exactly how `parseTimeInput` already reads a run of digits on
  both platforms. Penalties are not on the keypad: they belong to a solve that
  exists, and the panel puts OK / +2 / DNF against the last one the moment it
  lands, which is also why adding a time closes the keypad: the solve you just
  entered, and the buttons that fix it, are what the sheet was covering.

The panel replaced three separate boxes glued into a fake single card with
corner-radius surgery. It is also what brings the web layout's right-hand column
back within thumb reach: on desktop the stats table and solves list live
permanently beside the timer, and making them pushed screens meant checking your
ao12 cost you the screen you were using.

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
  current look is approved. Next lever, if asked to go further: the scramble
  controls still carry more chrome than the agreed direction.
- **The Timer does not work offline**, despite that being the stated reason for
  bundling the scramble images (section 2). `lib/scramble.ts` drops web's
  `scrambow` fallback and retries the server forever with capped backoff, so
  with no network you get an image you cannot use and a timer stuck on
  "Scrambling…" with no error and no way to record a solve. Each decision is
  defensible alone; the combination is not. Resolving it means either shipping a
  local generator or telling the user plainly that a scramble cannot be fetched.
- **`shared/` has three require cycles** (`index → averaging → index`, same for
  `timerStats` and `copy`). Harmless today, visible as a Metro warning on every
  start, and the kind of thing that becomes "undefined is not a function" after
  an innocent import change.
- **Long session names still ellipsize in the Timer header**, though no longer
  by being squeezed: the compact event badge and collapsing three icon buttons
  into one overflow returned about 76pt to the name, and it now takes the
  header's spare width and truncates deliberately at one line. Only worth
  revisiting if a tester complains again.
- **Stub tabs**: Calculator, Reconstruction, Results. Algorithms and Relays
  need gameplay.
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
