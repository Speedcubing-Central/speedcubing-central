import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  detectNewPBs,
  formatMoveCount,
  formatTime,
  getEvent,
  normalizeScramble,
  SUBSET_EVENTS,
  TIMER_ONLY_EVENT_IDS,
  type PbHit,
  type Penalty,
  type SolveAverage,
} from '@scc/shared';
import { apiError } from '../../lib/api';
import { parseTimeInput } from '../../lib/timeInput';
import { eventBadge, scrambleImageHeight, scrambleImageWidth } from '../../lib/scramble';
import { prewarmScrambleDrawing } from '../../lib/scrambleDrawing';
import { densityFor, useRhythm, useScreenScale } from '../../lib/scale';
import { usePalette, useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { IconButton, MONO_BOLD, Muted } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ScrambleView } from '../../components/ScrambleView';
import { ScrambleNet, hasScrambleNet } from '../../components/ScrambleNet';
import { PbCelebration } from './PbCelebration';
import { EventPickerSheet } from '../../components/EventPickerSheet';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolveDetailSheet } from './SolveDetailSheet';
import { EditScrambleSheet } from './EditScrambleSheet';
import { ScrambleImageSheet } from './ScrambleImageSheet';
import { TimerMenuSheet, type TimerMenuItem } from './TimerMenuSheet';
import { StatsPanel } from './StatsPanel';
import { KeypadSheet } from './Keypad';
import { useTimerDataContext } from './TimerDataContext';
import { useScrambler } from './useScrambler';
import { useTimerEngine, type TimerPhase } from './useTimerEngine';
import { TimerDigits } from './TimerDigits';
import type { TimerStackParamList } from '../../navigation/TimerStack';
import { font, mix, radius, space } from '../../theme';

// ── The mobile Timer ──────────────────────────────────────────────────────
//
// The web Timer is a two-column desktop layout: scramble, timer and last-solve
// on the left, a permanently-visible statistics table and the full solves list
// on the right. That is roughly 40 numbers and an unbounded list competing with
// the timer for a phone screen.
//
// The direction here is "Focus": the timer is an instrument, not a card in a
// grid. So the column is only ever four things:
//
//   header      the event, the session it scopes, and one overflow
//   scramble    text on the page, with its controls beneath, then the cube
//   timer       the digits, on no surface at all, taking everything left over
//   panel       a strip you glance at, which drags up into everything else
//
// The timer slot has two forms, and they are deliberately the same shape. Touch
// entry is the digits, and the tile is the tap target that starts a solve.
// Manual entry is the same tile showing the time you are entering, and tapping
// it raises a keypad from the bottom (Keypad.tsx). Switching entry mode changes
// what a tap does, not what the screen is.
//
// The keypad is a sheet rather than part of the column for two reasons. The
// screen never has to ask for the OS keyboard, which on a column that cannot
// scroll would simply cover whatever it lands on; and the column does not have
// to carry 12 targets for a control you touch for a few seconds per solve.
//
// The panel (StatsPanel.tsx) is the substantive change from the previous pass,
// which had three separate boxes at the bottom glued into a fake single card
// with corner-radius surgery. It is also what brings the web layout's
// right-hand column back within thumb reach: the pushed Statistics and Solves
// screens are still there for browsing, but checking your ao12 no longer means
// leaving the screen you are using.
//
// Every number here comes from @scc/shared, the same functions the web client
// calls, so nothing displayed is computed a second way. The underlying
// behaviour is unchanged throughout: same engine phases, same WCA inspection
// penalties, same scramble prefetching, same input blocking while solves and
// scrambles load, same PB detection, same server round-trips.
type Props = NativeStackScreenProps<TimerStackParamList, 'TimerHome'>;

const SUBSET_NAME: Record<string, string> = Object.fromEntries(SUBSET_EVENTS.map((e) => [e.id, e.name]));

// How the column's leftover height is split between the cube image and the
// timer. Both are real siblings in a definite-height container, which is the
// only place a flex share means anything (HANDOFF trap 2).
//
// The timer takes the larger share, and the image barely grows at all.
//
// An earlier pass had this the other way round, to stop the timer turning
// surplus into dead space around its centred digits. That fixed the spacing and
// broke something more important: the timer tile IS the tap target, so every
// point the image gained came straight out of the area you can hit to start a
// solve, and the cube ended up dominating a screen whose whole job is being
// easy to press.
//
// The spacing is handled by TIMER_CONTENT_BIAS below instead, which is the
// right tool for it: it moves the digits within the tile rather than shrinking
// the tile.
const IMAGE_FLEX = 1;
const TIMER_FLEX = 2.2;

// Ceiling on the image's growth, as a multiple of its natural size. Small on
// purpose: the image is sized for legibility by scrambleImageHeight and there is
// nothing to gain past that, so this only takes the edge off a roomy screen.
const IMAGE_MAX_GROWTH = 1.25;

// How far up the timer tile its content sits, as a fraction of the free space
// that would otherwise be split evenly above and below it.
//
// 0 is strict centring, which is what produced the void the cube used to float
// above: in a tall tile a centred block leaves half the surplus as a gap under
// the cube. Biasing upward closes that gap while the whole tile stays tappable,
// so the space it keeps ends up below the hint, where it reads as breathing room
// before the panel rather than as a hole. Optically the digits still read as
// centred, since a strictly centred block in a tall box reads as low.
const TIMER_CONTENT_BIAS = 0.65;

// A floor on the timer tile, and deliberately a DIAGNOSTIC one. The old
// arrangement had the floor on the footer and let the timer absorb any
// shortfall; now the timer holds the floor and a shortfall has nowhere to go,
// because the scramble is auto-height and React Native leaves flexShrink at 0.
// So if this binds, the column overflows, and the Yoga harness fails on its
// explicit overflow assertion rather than a clipped screen reaching a phone.
// The real relief valves are ScrambleView's content-length font ladder and
// `density` dropping content.
const TIMER_MIN_H = 140;

// Granularity the cube's measured box is reported at. See `setImageBoxH`: below
// this the drawing is resized for a change too small to see, and resizing it is
// the one operation whose cost grows with the number of stickers.
const IMAGE_BOX_STEP = 8;


export default function TimerScreen({ navigation }: Props) {
  const p = usePalette();
  const { s: sc, fontScale, maxFontMultiplier, width } = useScreenScale();
  const settings = useSettings();
  const {
    inspection,
    inspectionDirection,
    inspectionVoice,
    holdToStart,
    holdDuration,
    entryMode,
    timerUpdate,
    solvePrecision,
    startSound,
    celebratePBs,
  } = settings;
  const { user } = useAuth();

  const event = settings.currentEvent;
  // Shared with the Stats / Solves / Sessions sub-screens, see TimerDataContext.
  const data = useTimerDataContext();
  // A session scoped to a 3x3 practice subset (LSLL/LL/CLS) pulls scrambles from
  // that subset's scramble type instead of the raw event; eventId stays '333'
  // throughout. Same rule as the web Timer.
  const currentSession = data.sessions.find((s) => s.id === data.currentId);
  const scrambleEventId = currentSession?.subset || event;
  // Builds the scramble image for whatever is next in the prefetch queue, which
  // is known well before the current solve ends. Without this, rendering and
  // parsing a few hundred SVG elements landed in the frame the timer stopped,
  // alongside recording the solve and bringing the chrome back.
  const scr = useScrambler(scrambleEventId, data.currentId, prewarmScrambleDrawing);

  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditScramble, setShowEditScramble] = useState(false);
  const [showScrambleImage, setShowScrambleImage] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // Measured, not assumed. The column's own height is what density is decided
  // from: the window height would be wrong by the safe area and the tab bar,
  // and those differ per device by more than the gap between two tiers.
  const [columnH, setColumnH] = useState(0);
  // Measured for the same reason: the timer tile's height is whatever the flex
  // split leaves after a scramble of unknown depth, and the digits have to be
  // sized to it. adjustsFontSizeToFit cannot do this job, since it fits text to
  // its WIDTH only, so on a short tile the glyphs kept full height and were
  // sliced by the tile's clipped edge, top and bottom.
  const [timerTileH, setTimerTileH] = useState(0);
  // How much of the column the collapsed panel occupies. Reported by the panel
  // from its own measurement, and reserved here by a spacer so the timer's tap
  // target and the panel never overlap.
  const [panelCollapsedH, setPanelCollapsedH] = useState(0);
  // The image box's flex-resolved height, so the drawing can fill whatever
  // share it won. Measuring is safe here and cannot loop: the box's height
  // comes from the flex split against the timer, which does not depend on the
  // drawing inside it.
  // Quantised as it is measured, not where it is used, so a re-render caused by
  // anything else cannot smuggle a new value through.
  //
  // The box's height comes from the flex split, so it moves by a point or two
  // whenever the scramble above it wraps to a different number of lines. Passed
  // straight through, every one of those changed the drawing's height prop, and
  // changing the root <Svg>'s size makes react-native-svg re-lay out every
  // element inside it: 81 for a 3x3, 313 for a 7x7. That is the one part of
  // showing a cube whose cost scales with the puzzle, and it was being paid for
  // a difference nobody can see.
  const [imageBoxH, setImageBoxHRaw] = useState(0);
  const setImageBoxH = useCallback((h: number) => {
    // Floor rather than round: the drawing has to stay inside the box it was
    // given, and rounding up would let it exceed it by a few points.
    setImageBoxHRaw(Math.floor(h / IMAGE_BOX_STEP) * IMAGE_BOX_STEP);
  }, []);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pbHits, setPbHits] = useState<PbHit[] | null>(null);
  // The panel's figures open the same sheets the Stats and Solves screens use,
  // rather than navigating away: you tapped a number on the timer screen, so the
  // answer belongs over the timer screen.
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  // FMC's whole flow (countdown, move entry, solution checking) is Timer-only on
  // web and isn't part of this pass; the event is still selectable but routes to
  // manual entry rather than pretending to run an attempt.
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);

  // Same gate as the web Timer's `inputBlocked`: a solve cannot start until the
  // session's history and the next scramble have both actually landed, so it's
  // impossible to record two solves against the same scramble or to solve
  // against stale stats.
  const inputBlocked = data.solvesLoading || scr.loading || submitting;

  // The engine's phase, readable from callbacks that outlive the render they
  // were made in. `engine` is created below (it takes onComplete, so it cannot
  // come first), and this is only ever read at call time, never at definition.
  const phaseRef = useRef<TimerPhase>('idle');

  const onComplete = useCallback(
    async (timeMs: number, penalty: Penalty, plusTwoCount: number) => {
      setSubmitting(true);
      // The scramble this attempt used, captured before the display moves on.
      const used = scr.scramble;
      // Ahead of the save, not after it, and deliberately not awaited.
      //
      // The next scramble is already prefetched (useScrambler keeps a queue of
      // three in flight), so the seconds between finishing a solve and seeing a
      // new scramble were almost entirely the save's network round trip, spent
      // with the solved scramble still on screen. Nothing about picking the next
      // scramble depends on the save succeeding, so the two run together.
      scr.advance();
      try {
        let sessionId = data.currentId;
        if (!sessionId) {
          const created = await data.createSession(`${getEvent(event)?.name ?? event} Session`);
          sessionId = created.id;
        }
        const prevSolves = data.solves;
        // Lands in the list immediately and goes to the server behind us, so
        // everything below happens at the speed of the phone rather than of the
        // network. See useTimerData's note on recording a solve.
        const solve = await data.addSolve(timeMs, penalty, plusTwoCount, used, sessionId);
        if (solve && celebratePBs) {
          const hits = detectNewPBs(prevSolves, solve);
          // The overlay owns its own dismissal timing, so no timeout here.
          if (hits.length > 0) setPbHits(hits);
        }
        if (solve) {
          // A failed save must never silently advance the scramble: the one the
          // attempt used goes back up, so the retry is against that and not a
          // new one. The hook has already removed the solve and reported the
          // failure by the time this rejects; the scramble is what is ours.
          //
          // Unless another attempt is under way, which is possible now that the
          // save resolves in its own time. Nothing may change the scramble out
          // from under a live attempt, so a late failure gives up its undo
          // rather than take that risk.
          data.whenSaved(solve.id).catch(() => {
            if (phaseRef.current === 'idle' || phaseRef.current === 'stopped') scr.restore(used);
          });
        }
        return true;
      } catch (e) {
        // Only the session create reaches here now, and it is the one failure
        // that means there is nowhere to put the solve at all.
        scr.restore(used);
        Alert.alert('Solve not saved', apiError(e, 'Failed to save solve, try again'));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [data, scr, event, celebratePBs],
  );

  // Which of the two timer surfaces this event and setting resolve to. FMC has
  // no attempt to run in this pass, so it takes the manual one whatever the
  // entry-mode setting says. Read by the cube's sizing and the tile's floor as
  // well as by the branch itself, so the three cannot disagree about which
  // screen is being laid out.
  const manualEntry = entryMode !== 'keyboard' || isFmc;

  // Guard 3 of the three that keep the panel and the timer from fighting over a
  // touch (see StatsPanel's header for the other two). The engine already
  // cancels an in-flight attempt when `enabled` goes false, so opening the panel
  // mid-attempt reuses a tested path rather than needing new machinery.
  const engineEnabled =
    !isFmc &&
    entryMode === 'keyboard' &&
    !showEventPicker &&
    !showMenu &&
    !showEditScramble &&
    !showScrambleImage &&
    !showKeypad &&
    !panelOpen &&
    !inputBlocked;

  const engine = useTimerEngine({
    inspection,
    inspectionDirection,
    inspectionVoice,
    holdToStart,
    holdDuration,
    startSound,
    enabled: engineEnabled,
    onComplete,
  });
  phaseRef.current = engine.phase;

  // What a digit means in this event. FMC results are stored as a move count,
  // not a duration (`formatMoveCount` prints solve.time verbatim), so its digits
  // are whole moves: at the timer's precision "28" would have been read as 0.28
  // and saved as 280 moves.
  const manualPrecision = isFmc ? 0 : solvePrecision;
  // Enough for 99:99.99 at two decimals, and three digits of moves for FMC
  // (the WCA's own limit is 80). Past this the digits shifting in from the
  // right would push the minutes into hours, which this input cannot express.
  const maxTypedDigits = isFmc ? 3 : manualPrecision + 4;

  const pressDigit = useCallback(
    (digit: string) => {
      setTyped((prev) => {
        // Leading zeros are dropped rather than counted: they are invisible in
        // the readout (0.00 either way) and would otherwise spend the budget
        // above on nothing.
        const next = (prev + digit).replace(/^0+(?=\d)/, '');
        return next.length > maxTypedDigits ? prev : next;
      });
    },
    [maxTypedDigits],
  );

  // Reached only with something typed: the keypad's submit key is disabled
  // while the entry is empty. (It used to double as "skip this scramble" when
  // the field was blank, which was undiscoverable next to the scramble's own
  // refresh button doing the same thing in plain sight.)
  //
  // A successful add closes the keypad, so the solve you just entered is the
  // next thing you see: the stats panel and its penalty buttons are behind the
  // sheet, and they are where you go if that solve was a +2. A failure leaves
  // the keypad up with the entry still in it, so nothing has to be retyped.
  const addTyped = useCallback(async () => {
    const parsed = parseTimeInput(typed, manualPrecision);
    if (!parsed) return;
    // The sheet starts closing NOW, before the solve is recorded rather than
    // after it. This is the whole of the wait in typing mode: `onComplete` was
    // awaited first, so the keypad sat there for the round trip through
    // recording and only then began a 200ms exit, and a Sheet's exit is JS
    // driven (see Sheet.tsx on why it cannot use the native driver inside a
    // Modal), so it was also competing for the thread doing the recording.
    // Closing first lets the two overlap instead of queueing.
    setShowKeypad(false);
    const saved = await onComplete(parsed.time, parsed.penalty, parsed.plusTwoCount);
    if (saved) {
      // Cleared only on success, so a failed save still has the entry waiting
      // in the keypad rather than making you type it again.
      setTyped('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } else {
      setShowKeypad(true);
    }
  }, [typed, manualPrecision, onComplete]);

  // The entry as it will be recorded, formatted by the same functions that
  // print a saved solve, so what you read while typing is what lands in the
  // list. Runs through parseTimeInput for the same reason: one reading of a
  // digit string, not a preview that approximates it.
  const manualDisplay = (() => {
    if (!typed) return isFmc ? '0' : formatTime(0, 'NONE', solvePrecision);
    const parsed = parseTimeInput(typed, manualPrecision);
    if (!parsed) return typed;
    return isFmc
      ? formatMoveCount(parsed.time, 'NONE', 0, parsed.plusTwoCount)
      : formatTime(parsed.time, 'NONE', solvePrecision, parsed.plusTwoCount);
  })();

  const newest = data.solves[0];

  const runningStr = (ms: number) => {
    if (timerUpdate === 'hidden') return 'solving…';
    if (timerUpdate === 'seconds') return formatTime(Math.floor(ms / 1000) * 1000, 'NONE', 0);
    if (timerUpdate === 'deciseconds') return formatTime(Math.floor(ms / 100) * 100, 'NONE', 1);
    return formatTime(Math.floor(ms / 10) * 10, 'NONE', 2);
  };

  const fmt = (ms: number | null, penalty: Penalty = 'NONE', plusTwoCount = 0): string => {
    if (ms === null) return '—';
    return isFmc
      ? formatMoveCount(ms, penalty, 0, plusTwoCount)
      : formatTime(ms, penalty, solvePrecision, plusTwoCount);
  };

  // What the digits show when nothing is ticking. The live value is owned by
  // TimerDigits, which subscribes to the engine, so this deliberately does NOT
  // depend on elapsed: that dependency is what re-rendered the whole screen 60
  // times a second.
  const restingText = useMemo(() => {
    const phase = engine.phase;
    if (phase === 'stopped') return formatTime(Math.round(engine.stoppedElapsed), 'NONE', solvePrecision);
    if ((phase === 'holding' || phase === 'ready') && !inspection) return formatTime(0, 'NONE', solvePrecision);
    if (newest) return fmt(newest.time, newest.penalty, newest.plusTwoCount);
    return formatTime(0, 'NONE', solvePrecision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.phase, engine.stoppedElapsed, newest, inspection, solvePrecision, isFmc]);

  const digitColor = (() => {
    const phase = engine.phase;
    if (phase === 'ready') return p.green;
    if (phase === 'holding') return inspection ? p.yellow : p.red;
    return p.text;
  })();

  // A Stackmat tells you where you are in the attempt by colour before you read
  // anything: red under your hands, green when it will start. The screen borrows
  // that, so the state is legible from the edge of your vision at the moment
  // your eyes are on the cube rather than the phone.
  //
  // The whole screen, not the timer's own box. As a rounded rectangle inset from
  // the edges it read as a panel that had changed colour, which is a smaller,
  // later signal than the thing it is imitating: a Stackmat's mat is the field
  // of view, not a widget in it. Full bleed also removes the odd tension of a
  // coloured tile sitting on a differently coloured page.
  //
  // Mixed into the background rather than layered over it, because this is the
  // background: see `mix` in theme.ts for why a translucent overlay cannot
  // reach the whole screen. Held at 12% so it stays a tint, not a fill; at full
  // strength it would compete with the digits on top of it.
  const screenTint = (() => {
    const phase = engine.phase;
    if (phase === 'ready') return mix(p.bg, p.green, 0.12);
    if (phase === 'holding') return mix(p.bg, inspection ? p.yellow : p.red, 0.12);
    if (phase === 'running') return mix(p.bg, p.accent, 0.08);
    return p.bg;
  })();

  // While an attempt is live the screen goes immersive: chrome hidden so nothing
  // but the digits is on screen (and nothing but the digits is touchable) at the
  // moment your hands are leaving the phone for the cube.
  const immersive =
    engine.phase === 'inspecting' || engine.phase === 'holding' || engine.phase === 'ready' || engine.phase === 'running';

  // Tell the root navigator to pull its tab bar while an attempt is live. The
  // Timer hides its own chrome directly, but the bar belongs to the navigator
  // above it, and it is a custom bar, so React Navigation's own
  // `tabBarStyle: { display: 'none' }` never reaches it.
  //
  // Cleared on unmount as well as on leaving the phase: navigating away
  // mid-attempt would otherwise leave the app with no tab bar and no way to get
  // it back.
  // Also publishes the phase colour, not just the flag. The tint is this
  // screen's background, so it stops at this screen's edge, and the tab bar sits
  // outside it: without the colour the bar's area stayed plain while the rest of
  // the display went yellow, green or accent, leaving a band along the bottom.
  const setTimerImmersion = useUi((s) => s.setTimerImmersion);
  useEffect(() => {
    setTimerImmersion(immersive, immersive ? screenTint : null);
  }, [immersive, screenTint, setTimerImmersion]);
  useEffect(() => () => setTimerImmersion(false, null), [setTimerImmersion]);

  // One decision, read by the header and the panel, so they cannot disagree
  // about how much room there is.
  const density = columnH > 0 ? densityFor(columnH, fontScale) : 'comfortable';
  const rhythm = useRhythm(density);

  // Sized per puzzle, because every NxN from 4x4 up is drawn into the same
  // 1.600 viewBox and differs only in how many stickers are packed into it: one
  // constant that suits a 9-row 3x3 leaves a 21-row 7x7 unreadable. Scaled by
  // the screen and then by density, so it is the events that need the room that
  // spend the timer's height, and a 3x3 keeps its digits at their ceiling.
  const imageHeight = scrambleImageHeight(scrambleEventId, density, width);
  const imageWidth = scrambleImageWidth(scrambleEventId, width);

  // Raised well past the old 64: that ceiling was set when the timer was a
  // bordered card competing with four others, and it left the digits at ~53pt
  // inside a 320pt surface. With the card gone the time is the screen, so the
  // ceiling is the width of the phone rather than an arbitrary point size, and
  // the measured-tile share still governs on short screens.
  // adjustsFontSizeToFit handles the long values ("1:23.45" is seven characters
  // where "25.05" is five).
  const digitCeiling = sc(immersive ? 128 : 104);
  // 0.60 of the tile, up from 0.46. The tile is shorter now that the cube is a
  // flex sibling taking a share of the surplus, and at 0.46 the digits shrank
  // with it: on a 14/15 Pro they fell from the 104pt ceiling to about 85, which
  // traded the focal point away to fix the spacing. 0.60 restores them to the
  // ceiling in the same tile, so the gap closes and the digits do not move.
  // The hint below them still clears: at 0.60 the content comes to roughly
  // 0.66 * tile + 29, which fits every case the harness models.
  const digitFontSize = timerTileH > 0 ? Math.max(sc(30), Math.min(digitCeiling, timerTileH * 0.6)) : digitCeiling;

  // Padding at the bottom of the timer's content box, which shifts the digits up
  // by half of it. Derived from the free space the tile actually has, so a tile
  // barely taller than its content is left alone and only a roomy one is lifted.
  //
  // Never during an attempt. The lift exists to close the gap between the cube
  // and the digits, and once the attempt starts there is no cube: the chrome
  // unmounts and the tile becomes nearly the whole column, so the free space it
  // is a fraction of becomes enormous and the same rule pins the digits to the
  // top of the screen. With nothing above them, centred is simply correct.
  const timerContentLift = (() => {
    if (immersive || timerTileH <= 0) return 0;
    const contentH = digitFontSize * 1.1 + space.md + sc(18);
    return Math.round(Math.max(0, timerTileH - contentH) * TIMER_CONTENT_BIAS);
  })();

  const hint = (() => {
    switch (engine.phase) {
      case 'idle':
        return inspection ? 'Tap to inspect' : 'Hold, then release';
      case 'inspecting':
        return 'Hold to get ready';
      case 'holding':
        return 'Keep holding…';
      case 'ready':
        return 'Release to start';
      case 'running':
        return 'Tap anywhere to stop';
      case 'stopped':
        return 'Solve saved';
      default:
        return '';
    }
  })();

  // ── Stable identities for the two heavy children ──
  //
  // ScrambleView and StatsPanel are memoised, and an arrow function created in
  // this render defeats that completely. It matters here more than usual: a
  // single solve pushes about eight state changes through this component (the
  // phase, the submit flag, the scramble, the solves list, two measured heights,
  // a PB), and each one used to rebuild both subtrees, one of which owns the
  // solves list.
  const openScrambleImage = useCallback(() => setShowScrambleImage(true), []);
  const openEditScramble = useCallback(() => setShowEditScramble(true), []);
  const refreshScramble = useCallback(() => {
    void scr.refresh();
  }, [scr]);
  const copyScramble = useCallback(() => {
    void Clipboard.setStringAsync(normalizeScramble(scr.scramble));
  }, [scr.scramble]);
  const openStatsScreen = useCallback(() => navigation.navigate('Stats'), [navigation]);
  const openSolvesScreen = useCallback(() => navigation.navigate('Solves'), [navigation]);

  const sessionLabel = currentSession
    ? `${currentSession.name}${currentSession.subset ? ` (${SUBSET_NAME[currentSession.subset] ?? currentSession.subset})` : ''}`
    : 'No session';

  const menuItems: TimerMenuItem[] = [
    {
      key: 'stats',
      label: 'Statistics',
      hint: 'Every average, current and best',
      icon: 'chart',
      onPress: () => navigation.navigate('Stats'),
    },
    {
      key: 'solves',
      label: 'Solves',
      hint: 'Browse, sort and delete this session',
      icon: 'list',
      onPress: () => navigation.navigate('Solves'),
    },
    {
      key: 'sessions',
      label: 'Sessions',
      hint: 'Switch, rename or start a new one',
      icon: 'book',
      onPress: () => navigation.navigate('Sessions'),
    },
    {
      key: 'settings',
      label: 'Timer settings',
      hint: 'Inspection, hold to start, precision',
      icon: 'gear',
      onPress: () => navigation.navigate('TimerSettings'),
    },
  ];

  return (
    // The phase colour lives here, on the screen itself, so it runs edge to edge
    // and under the status bar (a View's background covers its padding, which is
    // what the safe-area inset is).
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenTint }}>
      <View
        style={{ flex: 1, paddingHorizontal: space.md }}
        onLayout={(e) => setColumnH(e.nativeEvent.layout.height)}
      >
        {/* ── The chrome, hidden during an attempt but NEVER unmounted ──
            `display: 'none'` rather than a conditional render. Yoga drops a
            display-none node from layout exactly as if it were not there, so
            the timer still takes the whole column during an attempt, but the
            subtree stays mounted and keeps its state.

            That state is the point. Unmounting threw away ScrambleNet's
            rendered image every attempt, so stopping the timer meant remounting
            it with nothing to draw: a spinner where the cube goes, a cubing.js
            render, an SVG parse of a few hundred elements, and two relayouts of
            the column, all on the JS thread in the frame you stop. That is what
            made the screen feel slow to come back, and it is also what starved
            the tab bar's fade-in, which cannot begin until JS is free to start
            it (hence the bar sometimes still being gone afterwards).

            Kept mounted, coming out of an attempt costs a layout pass. The new
            scramble's image still has to be drawn, but that happens off the
            critical path with the previous drawing held in place meanwhile,
            which is what ScrambleNet was already written to do. */}
        <>
          {/* ── Header ──
                Event first, then the session it scopes: a session belongs to an
                event (the Sessions screen is titled "3x3 Sessions"), so reading
                left to right goes broad to narrow. The event keeps the filled
                pill because it's the primary selector, and the session sits
                beside it as plain text so the pair doesn't read as two
                competing buttons.

                Three identical grey icon buttons used to follow. Three
                same-weight glyphs in a row read as noise rather than as three
                choices, and they squeezed the session name badly enough that
                HANDOFF lists the truncation as an open issue. One overflow
                returns about 76pt to the name. */}
            <View
              style={{
                display: immersive ? 'none' : 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                gap: rhythm.tight,
                marginBottom: rhythm.section,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change event"
                onPress={() => setShowEventPicker(true)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingVertical: 6,
                  paddingLeft: 11,
                  paddingRight: 7,
                  borderRadius: radius.pill,
                  backgroundColor: p.cardHover,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {/* The badge, not the full name: "3x3 Blindfolded" is fifteen
                    characters and left the session beside it with room for
                    about three. The picker this opens lists every event by
                    name, so nothing is lost. */}
                <Text
                  maxFontSizeMultiplier={maxFontMultiplier}
                  style={{ color: p.accent, fontFamily: font.sansBold, fontSize: sc(14) }}
                >
                  {eventBadge(event)}
                </Text>
                {/* Down, not right: this opens a sheet up from the bottom. */}
                <Icon name="chevronDown" size={14} color={p.accent} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change session"
                onPress={() => navigation.navigate('Sessions')}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  // Takes the spare width itself instead of a separate spacer
                  // doing it. minWidth 0 is what actually lets a flex child
                  // narrow enough to ellipsize instead of overflowing.
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: 8,
                  paddingHorizontal: 2,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={maxFontMultiplier}
                  style={{ color: p.textMuted, fontFamily: font.sansSemi, fontSize: sc(13), flexShrink: 1 }}
                >
                  {sessionLabel}
                </Text>
              </Pressable>

              <IconButton name="more" accessibilityLabel="Timer menu" onPress={() => setShowMenu(true)} />
            </View>

            {/* Dropped at the tightest tier rather than shrunk: on a short
                screen this line costs the digits more than it is worth. */}
            {!user && density === 'comfortable' && (
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontMultiplier}
                style={{
                  display: immersive ? 'none' : 'flex',
                  color: p.textMuted,
                  fontFamily: font.sans,
                  fontSize: sc(11),
                  textAlign: 'center',
                  marginBottom: rhythm.item,
                }}
              >
                Not signed in. Solves are saved on this device only.
              </Text>
            )}

            <View style={{ display: immersive ? 'none' : 'flex', marginBottom: rhythm.group }}>
              <ScrambleView
                eventId={scrambleEventId}
                scramble={scr.scramble}
                loading={scr.loading}
                onRefresh={refreshScramble}
                onGoBack={scr.goBack}
                canGoBack={scr.previous !== null && !scr.loading && (engine.phase === 'idle' || engine.phase === 'stopped')}
                onEdit={openEditScramble}
                onCopy={copyScramble}
                onOpenImage={openScrambleImage}
              />
            </View>

            {/* ── The cube ──
                A flex sibling of the timer rather than a fixed box inside the
                scramble, so the two of them share whatever the column has left
                over instead of the timer taking all of it.

                That share is the fix for the spacing: the timer centres its
                digits, so every point of surplus it wins becomes two holes, one
                above the digits and one below. The digits cannot absorb it
                either, since at this size they are limited by the screen's
                WIDTH, not its height ("15.87" at 104pt is already ~312pt wide
                in ~337pt of room). Sending the surplus here instead spends it
                on a bigger cube, which is worth having, and shortens the gap
                above the timer at the same time.

                minHeight is the legibility floor from scrambleImageHeight;
                maxHeight stops a tall screen with a short scramble handing the
                cube half the display. */}
            {hasScrambleNet(scrambleEventId) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View the scrambled cube full size"
                onPress={openScrambleImage}
                // The box stays while the next scramble is being fetched, and
                // only the drawing inside it comes and goes. Unmounting it
                // instead collapsed a flex child of the column, so every solve
                // ended with the timer and the scramble jumping up and then
                // back down again as the replacement landed.
                disabled={!scr.scramble}
                onLayout={(e) => setImageBoxH(e.nativeEvent.layout.height)}
                style={({ pressed }) => ({
                  display: immersive ? 'none' : 'flex',
                  flex: IMAGE_FLEX,
                  minHeight: imageHeight,
                  maxHeight: Math.round(imageHeight * IMAGE_MAX_GROWTH),
                  alignItems: 'center',
                  justifyContent: 'center',
                  // Section above, group below. The cube is its own block, and
                  // the scramble's margin below it already contributes `group`,
                  // so this tops it up to a section's worth: at the compact tier
                  // `group` alone resolves to 8, which read as the cube being
                  // crowded against the buttons over it.
                  marginTop: rhythm.section - rhythm.group,
                  marginBottom: rhythm.group,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                {scr.scramble ? (
                  <ScrambleNet
                    eventId={scrambleEventId}
                    scramble={scr.scramble}
                    // This event's own width budget, not the whole column. A
                    // wide puzzle given everything available is what made FTO
                    // and clock span the screen while a 3x3 sat modestly in the
                    // middle: one box reads completely differently depending on
                    // the drawing's proportions.
                    size={imageWidth}
                    // The measured box, once known. No layout jump: the box's
                    // height comes from the flex split, which does not depend on
                    // the drawing inside it, so only the drawing changes size.
                    maxHeight={imageBoxH > 0 ? imageBoxH : imageHeight}
                  />
                ) : null}
              </Pressable>
            ) : null}
        </>

        {/* ── The timer surface ──
            No fill of its own, and no longer any shape of its own either. The
            digits are the focal point of the screen, and a panel behind them
            puts a box in the way of that: a surface says "this is one thing
            among several", which is exactly the reading to avoid. The phase
            colour is the screen's (see `screenTint`), so this is only a box for
            laying out and for catching the touch.

            Overflow is still clipped, so the Pressable fills the tile exactly:
            the area you see and the area that starts a solve are the same
            rectangle, which matters more here than anywhere else. */}
        {!manualEntry ? (
          <View
            style={{
              flex: TIMER_FLEX,
              minHeight: sc(TIMER_MIN_H),
              overflow: 'hidden',
            }}
            onLayout={(e) => setTimerTileH(e.nativeEvent.layout.height)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Timer. Touch and hold, then release to start."
              onPressIn={() => {
                if (engineEnabled) engine.press();
              }}
              onPressOut={() => {
                if (engineEnabled) engine.release();
              }}
              // Centred, then pulled up by padding at the bottom. The Pressable
              // still fills the tile, so the whole rectangle starts a solve;
              // only the digits move. See TIMER_CONTENT_BIAS.
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.md,
                paddingBottom: timerContentLift,
              }}
            >
              <TimerDigits
                phase={engine.phase}
                subscribe={engine.subscribe}
                inspection={inspection}
                inspectionDirection={inspectionDirection}
                timerUpdate={timerUpdate}
                solvePrecision={solvePrecision}
                restingText={restingText}
                color={digitColor}
                fontSize={digitFontSize}
              />
              <Muted
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontMultiplier}
                style={{ textAlign: 'center', paddingHorizontal: space.lg }}
              >
                {inputBlocked ? (data.solvesLoading ? 'Loading solves…' : 'Scrambling…') : hint}
              </Muted>
              {(engine.phase === 'inspecting' || engine.phase === 'running') && (
                <Pressable
                  accessibilityRole="button"
                  onPress={engine.cancel}
                  hitSlop={12}
                  style={{ position: 'absolute', bottom: space.lg, alignSelf: 'center' }}
                >
                  <Text style={{ color: p.textMuted, fontFamily: font.sans, fontSize: 12 }}>Cancel attempt</Text>
                </Pressable>
              )}
            </Pressable>
          </View>
        ) : (
          // Manual entry, also the path FMC takes in this pass. Same tile, same
          // flex share, same sizing as the touch timer above: the time is still
          // the screen, and switching entry mode changes what a tap does rather
          // than what the screen is.
          //
          // The keys are not here. They arrive from the bottom when you tap
          // (KeypadSheet), because 12 targets is a lot of column to hold open
          // permanently for a control you touch for a few seconds per solve,
          // and keeping them out is what lets this tile go on looking like the
          // timer rather than like a form.
          <View
            style={{
              flex: TIMER_FLEX,
              minHeight: sc(TIMER_MIN_H),
              overflow: 'hidden',
            }}
            onLayout={(e) => setTimerTileH(e.nativeEvent.layout.height)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={typed ? `Edit the time you are entering, ${manualDisplay}` : 'Enter a time'}
              accessibilityHint="Opens the keypad"
              onPress={() => setShowKeypad(true)}
              disabled={inputBlocked}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.md,
                paddingBottom: timerContentLift,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                allowFontScaling={false}
                style={{
                  // Muted until there is something to read, so an untouched
                  // 0.00 does not look like a result you have already entered.
                  color: typed ? p.text : p.textMuted,
                  fontFamily: MONO_BOLD,
                  fontSize: digitFontSize,
                  lineHeight: digitFontSize * 1.1,
                  fontVariant: ['tabular-nums'],
                  paddingHorizontal: space.lg,
                }}
              >
                {manualDisplay}
              </Text>
              <Muted
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontMultiplier}
                style={{ textAlign: 'center', paddingHorizontal: space.lg }}
              >
                {inputBlocked
                  ? data.solvesLoading
                    ? 'Loading solves…'
                    : 'Scrambling…'
                  : typed
                    ? 'Tap to finish this entry'
                    : 'Tap to enter a time'}
              </Muted>
            </Pressable>
          </View>
        )}

        {/* Reserves the collapsed panel's rectangle. This is guard 1 of the
            three that keep the panel from stealing a touch meant for the timer:
            the tile's box ends exactly where this begins, so the two never
            overlap and there is no hit-test ambiguity to resolve. */}
        {!immersive && <View style={{ height: panelCollapsedH }} />}
      </View>

      {/* While the panel is open the timer above it must not start a solve, and
          there has to be an obvious way back. `engineEnabled` already handles
          the first, but a tap that silently does nothing is a worse answer than
          a tap that closes the thing covering the screen. */}
      {panelOpen && !immersive && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collapse statistics"
          onPress={() => setPanelOpen(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000059' }}
        />
      )}

      {/* Never unmounted, only hidden. It owns the measurement that sizes the
          spacer above, plus its own scroll position and whether its body has
          been built; unmounting it for the duration of every attempt would
          throw all of that away and re-measure on the way back. It goes inert
          under `immersive` on its own (see StatsPanel). */}
      <StatsPanel
        solves={data.solves}
        event={event}
        columnH={columnH}
        immersive={immersive}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onCollapsedHeight={setPanelCollapsedH}
        onUpdatePenalty={data.updatePenalty}
        onDeleteSolves={data.deleteSolves}
        onOpenAverage={setAvgView}
        onOpenSolve={setDetailIndex}
        onOpenStatsScreen={openStatsScreen}
        onOpenSolvesScreen={openSolvesScreen}
      />

      {/* Both sheets stay mounted and are driven by `visible`, so they can play
          their exit animation. Conditionally mounting them meant the parent
          unmounted the sheet the instant onClose fired, so it vanished rather
          than sliding away. */}
      <AverageDetailSheet
        view={avgView}
        event={event}
        visible={avgView !== null}
        onClose={() => setAvgView(null)}
      />
      <SolveDetailSheet
        solves={data.solves}
        index={detailIndex}
        event={event}
        visible={detailIndex !== null}
        onClose={() => setDetailIndex(null)}
        onUpdatePenalty={data.updatePenalty}
        onUpdateTime={data.updateTime}
        onUpdateComment={data.updateComment}
        onDelete={data.deleteSolve}
        onOpenAverage={(v) => {
          setDetailIndex(null);
          setAvgView(v);
        }}
      />

      <EventPickerSheet
        visible={showEventPicker}
        value={event}
        onSelect={settings.setCurrentEvent}
        onClose={() => setShowEventPicker(false)}
      />

      <TimerMenuSheet visible={showMenu} items={menuItems} onClose={() => setShowMenu(false)} />

      <EditScrambleSheet
        visible={showEditScramble}
        eventId={scrambleEventId}
        current={scr.scramble}
        onApply={scr.setCustom}
        onClose={() => setShowEditScramble(false)}
      />

      {/* The keypad, from the bottom, when the readout is tapped. Mounted
          unconditionally like the other sheets so it can play its exit
          animation: `visible` is what opens and closes it. */}
      <KeypadSheet
        visible={showKeypad}
        onClose={() => setShowKeypad(false)}
        display={manualDisplay}
        empty={typed.length === 0}
        // The same gate the touch timer uses: nothing is recorded until this
        // session's solves and the current scramble have both landed.
        disabled={inputBlocked}
        onDigit={pressDigit}
        onBackspace={() => setTyped((prev) => prev.slice(0, -1))}
        onClear={() => setTyped('')}
        onSubmit={addTyped}
      />

      <ScrambleImageSheet
        visible={showScrambleImage}
        eventId={scrambleEventId}
        scramble={scr.scramble}
        onClose={() => setShowScrambleImage(false)}
      />

      {/* Last child, so it draws over everything, and absolutely positioned so
          it takes no space in the column: a PB no longer shoves the panel down
          the screen. */}
      {pbHits && (
        <PbCelebration
          hits={pbHits}
          precision={solvePrecision}
          isFmc={isFmc}
          onDone={() => setPbHits(null)}
        />
      )}
    </SafeAreaView>
  );
}
