import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  bestSingleIndex,
  currentAverage,
  detectNewPBs,
  makeAverageView,
  type AvgSize,
  type SolveAverage,
  type PbHit,
  formatMoveCount,
  formatTime,
  getEvent,
  mean,
  singleStats,
  SUBSET_EVENTS,
  TIMER_ONLY_EVENT_IDS,
  type Penalty,
} from '@scc/shared';
import { apiError } from '../../lib/api';
import { parseTimeInput } from '../../lib/timeInput';
import { eventBadge } from '../../lib/scramble';
import { densityFor, useScreenScale } from '../../lib/scale';
import { usePalette, useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { IconButton, MONO, MONO_BOLD, Muted } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ScrambleView } from '../../components/ScrambleView';
import { ScrambleNet, hasScrambleNet } from '../../components/ScrambleNet';
import { PbCelebration } from './PbCelebration';
import { EventPickerSheet } from '../../components/EventPickerSheet';
import { PenaltyRow } from './PenaltyRow';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolveDetailSheet } from './SolveDetailSheet';
import { useTimerDataContext } from './TimerDataContext';
import { useScrambler } from './useScrambler';
import { useTimerEngine, formatInspectionDisplay } from './useTimerEngine';
import type { TimerStackParamList } from '../../navigation/TimerStack';
import { font, radius, space } from '../../theme';

// ── The mobile Timer ──────────────────────────────────────────────────────
//
// The web Timer page is a two-column desktop layout: scramble + timer +
// last-solve on the left, and a permanently-visible Statistics table
// (single/mo3/ao5/ao12/ao50/ao100/ao1000 x Current/Best/BPA/WPA/Target) plus the
// full Solves list on the right. That's roughly 40 numbers and an unbounded list
// competing with the timer for a phone screen, so the phone layout is organised
// around what you look at between attempts instead, in the shape the established
// mobile timers (CubeTime, Twisty Timer) converged on:
//
//   header      session and event, plus the three sub-screen entry points
//   scramble    the text, with previous/new controls
//   timer       the digits, taking every pixel left over
//   footer      scramble image beside a compact stats block, then penalties
//
// The footer is the substantive change from the first pass, which showed only
// Last and Ao5. A scramble image matters because it's how you check your cube is
// actually scrambled right, and it can't come from web's cubing.js
// <twisty-player> (a DOM element), so it's drawn natively, see
// components/ScrambleNet.tsx. Alongside it the stats block carries Ao5, Ao12,
// Ao100, session mean, best and count, which is the set worth glancing at
// without leaving the timer. The exhaustive table stays one tap away in Stats.
//
// Every number here comes from @scc/shared, the same functions the web client
// calls, so nothing displayed is computed a second way.
//
// The underlying behaviour is unchanged: same engine phases, same WCA inspection
// penalties, same scramble prefetching, same input blocking while solves and
// scrambles load, same PB detection, same server round-trips.
type Props = NativeStackScreenProps<TimerStackParamList, 'TimerHome'>;

const SUBSET_NAME: Record<string, string> = Object.fromEntries(SUBSET_EVENTS.map((e) => [e.id, e.name]));

// How the leftover column height splits between the timer and the footer. The
// timer still gets the larger share (it's the thing you aim a thumb at), but no
// longer takes literally everything the footer doesn't claim, which is what made
// it tower over a scramble image and stats squeezed into the last ~100px.
//
// 3:1 works now that the footer has a floor (below): the share decides how
// *spare* space is split, and the floor guarantees the footer's contents fit
// regardless, so the timer can take the lion's share without squeezing the
// scramble image and stats. An earlier 2:1 without the floor was what let them
// be pushed off screen.
const TIMER_FLEX = 3;
const FOOTER_FLEX = 1;

// Width budget for the scramble net. Held to a constant rather than growing with
// the tile because the net is four faces wide: every pixel it gains horizontally
// comes out of the stats tile sharing the row.
const SCRAMBLE_NET_MAX_W = 132;

// The scramble/stats row's floor, and the footer's floor including the penalty
// tile above it.
//
// The flex split alone isn't enough. On a big cube the scramble text is long
// enough to wrap several lines, which leaves less for the timer and footer to
// share, and the footer's share can fall below what its own contents need. React
// Native leaves flexShrink at 0, so the penalty tile never gives way and the row
// is squeezed instead; on 5x5 and up that pushed the scramble image and stats
// off the bottom of a screen that deliberately doesn't scroll. Giving the footer
// a floor makes the timer absorb the shortfall instead, which it can do
// gracefully because its digits already auto-shrink to fit.
const FOOTER_ROW_MIN_H = 100;
const PENALTY_TILE_H = 56;

export default function TimerScreen({ navigation }: Props) {
  const p = usePalette();
  const { s: sc, isShort, fontScale, maxFontMultiplier } = useScreenScale();
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
  // that subset's scramble type instead of the raw event, eventId stays '333'
  // throughout. Same rule as the web Timer.
  const currentSession = data.sessions.find((s) => s.id === data.currentId);
  const scrambleEventId = currentSession?.subset || event;
  const scr = useScrambler(scrambleEventId, data.currentId);

  const [showEventPicker, setShowEventPicker] = useState(false);
  // Measured, not assumed: the footer's height comes from the flex split, which
  // depends on screen size, whether the penalty tile is present, and the safe
  // area. The net needs that number to fit itself to it. No feedback loop, since
  // the row's height is decided by flex before its contents are drawn.
  const [footerH, setFooterH] = useState(0);
  // Measured for the same reason as the footer: the timer tile's height is
  // whatever the flex split leaves after a scramble of unknown depth, and the
  // digits have to be sized to it. adjustsFontSizeToFit cannot do this job: it
  // fits text to its WIDTH only, so on a short tile the glyphs kept full height
  // and were sliced by the tile's clipped edge, top and bottom.
  const [timerTileH, setTimerTileH] = useState(0);
  // The column's own height, which is what density is decided from: the window
  // height would be wrong by the safe area and the tab bar, and those differ per
  // device by more than the gap between two tiers.
  const [columnH, setColumnH] = useState(0);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pbHits, setPbHits] = useState<PbHit[] | null>(null);
  // The stats tile's figures open the same sheets the Stats and Solves screens
  // use, rather than navigating away: you tapped a number on the timer screen,
  // so the answer belongs over the timer screen.
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  // The *current* rolling average of this size, i.e. the one ending on the most
  // recent solve, which is the figure shown in the tile.
  const openCurrentAverage = (size: AvgSize) => {
    const v = makeAverageView(data.solves, 0, size);
    if (v) setAvgView(v);
  };
  const openBestSolve = () => {
    const i = bestSingleIndex(data.solves);
    if (i !== null) setDetailIndex(i);
  };

  // FMC's whole flow (countdown, move entry, solution checking) is Timer-only
  // on web and isn't part of this pass; the event is still selectable but routes
  // to manual entry rather than pretending to run an attempt.
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);

  // Same gate as the web Timer's `inputBlocked`: a solve cannot start until the
  // session's history and the next scramble have both actually landed, so it's
  // impossible to record two solves against the same scramble or to solve
  // against stale stats.
  const inputBlocked = data.solvesLoading || scr.loading || submitting;

  const onComplete = useCallback(
    async (timeMs: number, penalty: Penalty, plusTwoCount: number) => {
      setSubmitting(true);
      try {
        let sessionId = data.currentId;
        if (!sessionId) {
          const created = await data.createSession(`${getEvent(event)?.name ?? event} Session`);
          sessionId = created.id;
        }
        const prevSolves = data.solves;
        const solve = await data.addSolve(timeMs, penalty, plusTwoCount, scr.scramble, sessionId);
        scr.advance();
        if (solve && celebratePBs) {
          const hits = detectNewPBs(prevSolves, solve);
          // The overlay owns its own dismissal timing, so no timeout here.
          if (hits.length > 0) setPbHits(hits);
        }
        return true;
      } catch (e) {
        // A failed save must never silently advance the scramble. Same
        // reasoning as the web Timer's error handling.
        Alert.alert('Solve not saved', apiError(e, 'Failed to save solve, try again'));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [data, scr, event, celebratePBs, isFmc, solvePrecision],
  );

  const engine = useTimerEngine({
    inspection,
    inspectionDirection,
    inspectionVoice,
    holdToStart,
    holdDuration,
    startSound,
    enabled: !isFmc && entryMode === 'keyboard' && !showEventPicker && !inputBlocked,
    onComplete,
  });

  const addTyped = useCallback(async () => {
    if (!typed.trim()) {
      scr.advance();
      return;
    }
    const parsed = parseTimeInput(typed, solvePrecision);
    if (!parsed) return;
    // Only clear on a successful save so a failure doesn't force a retype.
    const saved = await onComplete(parsed.time, parsed.penalty, parsed.plusTwoCount);
    if (saved) setTyped('');
  }, [typed, solvePrecision, onComplete, scr]);

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

  // Same convention as StatsScreen and the web StatsTable: an average is
  // rounded to whole milliseconds before formatting. Kept identical so a number
  // shown in two places is never rounded two different ways.
  const fmtAvg = (v: number | null): string => {
    if (v === null) return '—';
    if (!isFinite(v)) return 'DNF';
    return isFmc ? formatMoveCount(v, 'NONE', 2) : formatTime(Math.round(v), 'NONE', solvePrecision);
  };

  // The footer's stats block. Recomputed only when the solve list changes, not
  // on every timer frame; currentAverage is O(size) and the mean is O(n), but
  // the timer re-renders ~60x a second while running and none of this changes
  // mid-attempt.
  const footerStats = useMemo(() => {
    const single = singleStats(data.solves);
    const sessionMean = mean(data.solves);
    return {
      ao5: currentAverage(data.solves, 5),
      ao12: currentAverage(data.solves, 12),
      ao100: currentAverage(data.solves, 100),
      meanValue: sessionMean.isDNF ? Infinity : sessionMean.value,
      best: single.best,
      count: single.count,
    };
  }, [data.solves]);

  const display = useMemo(() => {
    const phase = engine.phase;
    if (inspection && (phase === 'inspecting' || phase === 'holding' || phase === 'ready')) {
      return formatInspectionDisplay(inspectionDirection, engine.inspectionElapsed, engine.inspectionRemaining);
    }
    if (phase === 'running') return runningStr(engine.elapsed);
    if (phase === 'stopped') return formatTime(Math.round(engine.elapsed), 'NONE', solvePrecision);
    if ((phase === 'holding' || phase === 'ready') && !inspection) return formatTime(0, 'NONE', solvePrecision);
    if (newest) return fmt(newest.time, newest.penalty, newest.plusTwoCount);
    return formatTime(0, 'NONE', solvePrecision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    engine.phase,
    engine.elapsed,
    engine.inspectionElapsed,
    engine.inspectionRemaining,
    newest,
    inspection,
    inspectionDirection,
    timerUpdate,
    solvePrecision,
    isFmc,
  ]);

  const digitColor = (() => {
    const phase = engine.phase;
    if (phase === 'ready') return p.green;
    if (phase === 'holding') return inspection ? p.yellow : p.red;
    return p.text;
  })();

  // A Stackmat tells you where you are in the attempt by colour before you read
  // anything: red under your hands, green when it will start. The timer surface
  // borrows that. The whole area you are touching carries a wash of the phase
  // colour, so the state is legible from the edge of your vision at the moment
  // your eyes are on the cube rather than the phone.
  //
  // Held at 12% so it reads as a tint on the background rather than a filled
  // panel; at full strength it would compete with the digits sitting on it.
  const surfaceTint = (() => {
    const phase = engine.phase;
    if (phase === 'ready') return `${p.green}1F`;
    if (phase === 'holding') return inspection ? `${p.yellow}1F` : `${p.red}1F`;
    if (phase === 'running') return `${p.accent}14`;
    return 'transparent';
  })();

  // While an attempt is live the screen goes immersive: chrome hidden so
  // nothing but the digits is on screen (and nothing but the digits is
  // touchable) at the moment your hands are leaving the phone for the cube.
  const immersive =
    engine.phase === 'inspecting' || engine.phase === 'holding' || engine.phase === 'ready' || engine.phase === 'running';

  // The digits take a fixed share of the tile, leaving room for the hint beneath
  // them, and never exceed the size they had when there was space to spare. The
  // floor keeps them legible on the shortest tile a long Square-1 scramble
  // leaves; below that the tile clips, which is at least visibly wrong rather
  // than silently unreadable.
  // One decision, read by the header, the footer and the stats block, so they
  // cannot disagree about how much room there is.
  const density = columnH > 0 ? densityFor(columnH, fontScale) : 'comfortable';
  // Tied to the measured footer, not to density. Density is computed from the
  // column's total height, which cannot know how much of it the scramble took:
  // by that rule an iPhone SE was 'compact' even on a 3x3, so those users never
  // saw the cube image although the footer had ~160pt to draw it in. The row's
  // own height already accounts for everything above it.
  //
  // No feedback loop: the row's height comes from the flex split, which is
  // settled before its contents draw, so including or excluding the image cannot
  // change it. Optimistic before the first measurement, so it doesn't flash in.
  const showScrambleImage = footerH === 0 || footerH >= sc(76);
  const statRows: ('primary' | 'secondary' | 'tertiary')[] =
    density === 'minimal' ? ['primary'] : ['primary', 'secondary', 'tertiary'];

  // Raised well past the old 64: that ceiling was set when the timer was a
  // bordered card competing with four others, and it left the digits at ~53pt
  // inside a 320pt surface, six times their own height in empty space. With the
  // card gone the time is the screen, so the ceiling is the width of the phone
  // rather than an arbitrary point size, and the measured-tile share still
  // governs on short screens. adjustsFontSizeToFit handles the long values
  // ("1:23.45" is seven characters where "25.05" is five).
  const digitCeiling = sc(immersive ? 128 : 104);
  // The measured-tile share still governs (it is what stopped the clipping);
  // the screen scale only lowers the ceiling, so a small phone never starts
  // from a size it has no room for.
  const digitFontSize = timerTileH > 0 ? Math.max(sc(30), Math.min(digitCeiling, timerTileH * 0.46)) : digitCeiling;

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

  const sessionLabel = currentSession
    ? `${currentSession.name}${currentSession.subset ? ` (${SUBSET_NAME[currentSession.subset] ?? currentSession.subset})` : ''}`
    : 'No session';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={{ flex: 1, paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm }}
        onLayout={(e) => setColumnH(e.nativeEvent.layout.height)}
      >
        {!immersive && (
          <>
            {/* ── Header ──
                Event first, then the session it scopes: a session belongs to an
                event (the Sessions screen is titled "3x3 Sessions"), so reading
                left to right now goes broad to narrow. The event keeps the
                filled pill because it's the primary selector, and the session
                sits next to it as plain text so the pair doesn't read as two
                competing buttons. The three sub-screens stay on the right. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
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
                  gap: 6,
                  // Takes the spare width itself instead of a separate spacer
                  // doing it. Previously a <View flex:1 /> sat between this and
                  // the icons and absorbed everything, leaving the session name
                  // to shrink to "s..". minWidth 0 is what actually lets a flex
                  // child narrow enough to ellipsize instead of overflowing.
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

              <IconButton name="chart" accessibilityLabel="Statistics" onPress={() => navigation.navigate('Stats')} />
              <IconButton name="list" accessibilityLabel="Solves" onPress={() => navigation.navigate('Solves')} />
              <IconButton
                name="gear"
                accessibilityLabel="Timer settings"
                onPress={() => navigation.navigate('TimerSettings')}
              />
            </View>

            {!user && (
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontMultiplier}
                style={{ color: p.textMuted, fontFamily: font.sans, fontSize: sc(11), textAlign: 'center' }}
              >
                Not signed in. Solves are saved on this device only.
              </Text>
            )}

            <ScrambleView
              eventId={scrambleEventId}
              scramble={scr.scramble}
              loading={scr.loading}
              onRefresh={() => scr.refresh()}
              onGoBack={scr.goBack}
              canGoBack={scr.previous !== null && !scr.loading && (engine.phase === 'idle' || engine.phase === 'stopped')}
            />
          </>
        )}

        {/* ── The timer surface ──
            In its own tile, with no padding of its own and overflow clipped to
            the radius, so the Pressable fills the tile exactly: the panel you
            see and the area that starts a solve are the same rectangle, which
            matters more here than on any other panel. */}
        {entryMode === 'keyboard' && !isFmc ? (
          <View
            style={{
              flex: TIMER_FLEX,
              overflow: 'hidden',
              borderRadius: radius.lg,
              backgroundColor: surfaceTint,
            }}
            onLayout={(e) => setTimerTileH(e.nativeEvent.layout.height)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Timer. Touch and hold, then release to start."
              onPressIn={() => {
                if (!showEventPicker && !inputBlocked) engine.press();
              }}
              onPressOut={() => {
                if (!showEventPicker && !inputBlocked) engine.release();
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.md,
              }}
            >
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                // The digits are sized from the tile they were given, so the OS
                // text setting must not scale them again on top of that: the
                // result would be a number too tall for the box it was measured
                // into, which is the clipping this replaced.
                allowFontScaling={false}
                style={{
                  color: digitColor,
                  fontFamily: MONO_BOLD,
                  fontSize: digitFontSize,
                  lineHeight: digitFontSize * 1.1,
                  fontVariant: ['tabular-nums'],
                  paddingHorizontal: space.lg,
                }}
              >
                {display}
              </Text>
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
          // Manual entry, also the path FMC takes in this pass.
          <Tile
            style={{
              flex: TIMER_FLEX,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.lg,
              padding: space.lg,
            }}
          >
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              allowFontScaling={false}
              style={{ color: p.text, fontFamily: MONO_BOLD, fontSize: sc(52) }}
            >
              {typed || (isFmc ? 'moves' : formatTime(0, 'NONE', solvePrecision))}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={addTyped}
                editable={!inputBlocked}
                placeholder={isFmc ? '28' : '10.00'}
                placeholderTextColor={p.textMuted}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                style={{
                  color: p.text,
                  fontFamily: MONO,
                  fontSize: 20,
                  textAlign: 'center',
                  width: 140,
                  paddingVertical: 10,
                  borderRadius: radius.sm,
                  backgroundColor: p.cardHover,
                }}
              />
              <Pressable
                accessibilityRole="button"
                onPress={addTyped}
                disabled={inputBlocked}
                style={({ pressed }) => ({
                  backgroundColor: p.accent,
                  borderRadius: radius.sm,
                  paddingVertical: 12,
                  paddingHorizontal: space.lg,
                  opacity: inputBlocked ? 0.4 : pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ color: '#fff', fontFamily: font.sansBold }}>Add</Text>
              </Pressable>
            </View>
          </Tile>
        )}

        {/* ── Footer: scramble image, stats, penalties ──
            The flex share belongs on this wrapper, not on the scramble/stats row
            inside it. That row is the thing being sized, but `flex` only draws
            space from a parent that has a definite height to give: this wrapper
            is the timer tile's actual sibling in the column, so it's the one that
            can claim a share. Putting flex on the inner row instead collapsed it
            to zero height (flexBasis 0 inside an auto-height parent contributes
            nothing and has no free space to grow into), which hid the scramble
            image and stats entirely and handed their space to the timer. */}
        {!immersive && (
          <View
            style={{
              flex: FOOTER_FLEX,
              // No gap when the penalty row is showing: the two halves are one
              // panel, split by a rule rather than by space.
              gap: newest ? 0 : space.sm,
              // Floor covering the row plus, when it's showing, the penalty tile
              // and the gap above it. Without this the footer shrinks below its
              // own contents and they spill off the bottom of the screen.
              minHeight:
                sc(density === 'minimal' ? 56 : FOOTER_ROW_MIN_H) +
                (newest ? sc(PENALTY_TILE_H) : 0),
            }}
          >
            {/* Penalties get their own tile rather than sitting loose above the
                footer: they act on the last solve, not on the timer, and a
                surface of their own is what makes that separation legible. */}
            {newest && (
              <Tile style={{ padding: space.sm, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 }}>
                <PenaltyRow
                  penalty={newest.penalty}
                  plusTwoCount={newest.plusTwoCount}
                  onChange={(pen, count) => data.updatePenalty(newest.id, pen, count)}
                  hidePlusTwo={isFmc}
                />
              </Tile>
            )}

            {/* The footer claims a share of the column rather than being sized
                by its contents, which is what shortens the timer: previously the
                timer was `flex: 1` against a content-sized footer, so it took
                every pixel the footer didn't need. The net then fits itself to
                the row's measured height (see ScrambleNet's maxHeight), because
                it can't simply be made wider: it's four faces across, so extra
                width comes straight out of the stats tile beside it. */}
            <View
              // minHeight is a floor, not a size: React Native leaves flexShrink
              // at 0, so the auto-height siblings above (the penalty tile, a PB
              // banner) never give way, and on a short screen this row is the
              // only thing that can shrink. Without a floor it shrinks to
              // nothing and the scramble image and stats vanish.
              style={{
                flex: 1,
                minHeight: sc(density === 'minimal' ? 56 : FOOTER_ROW_MIN_H),
                flexDirection: 'row',
                gap: space.sm,
                alignItems: 'stretch',
              }}
              onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
            >
              {/* Fixed width, so the tile is the same size before the drawing
                  arrives as after. Sizing it to its contents meant that during
                  the async load (a puzzle's artwork is a dynamic chunk on first
                  use) the tile collapsed to a thin sliver and the stats tile
                  beside it stretched to fill the gap, then both jumped back on
                  arrival. Not tappable: the scramble image is something to look
                  at, and it used to open Statistics, which is the stats tile's
                  job and surprising from a picture of a cube. */}
              {showScrambleImage && hasScrambleNet(scrambleEventId) && scr.scramble ? (
                <Tile
                  style={{
                    width: sc(SCRAMBLE_NET_MAX_W) + space.sm * 2,
                    padding: space.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(newest ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : null),
                  }}
                >
                  <ScrambleNet
                    eventId={scrambleEventId}
                    scramble={scr.scramble}
                    size={sc(SCRAMBLE_NET_MAX_W)}
                    maxHeight={footerH > 0 ? footerH - space.sm * 2 : undefined}
                  />
                </Tile>
              ) : null}

              {/* Individual figures open what they name: an average opens the
                  solves it was made of, Best opens that solve. Tapping the whole
                  tile used to open Statistics, which meant the one gesture
                  available went somewhere more general than the number under
                  your thumb. Mean and Solves aren't a window onto anything, so
                  they stay plain. */}
              {/* Rows are shed by density, not squeezed. At the tightest tier
                  the row that survives is the one you actually watch between
                  attempts, plus the best, rather than six figures too small to
                  read. */}
              <StatsBlock
                joined={!!newest}
                rows={
                  density === 'minimal'
                    ? [
                        [
                          { label: 'Ao5', value: fmtAvg(footerStats.ao5), onPress: () => openCurrentAverage(5) },
                          { label: 'Ao12', value: fmtAvg(footerStats.ao12), onPress: () => openCurrentAverage(12) },
                          {
                            label: 'Best',
                            value: footerStats.best === null ? '—' : fmt(footerStats.best),
                            onPress: () => openBestSolve(),
                          },
                        ],
                      ]
                    : [
                        [
                          { label: 'Ao5', value: fmtAvg(footerStats.ao5), onPress: () => openCurrentAverage(5) },
                          { label: 'Ao12', value: fmtAvg(footerStats.ao12), onPress: () => openCurrentAverage(12) },
                        ],
                        [
                          { label: 'Ao100', value: fmtAvg(footerStats.ao100), onPress: () => openCurrentAverage(100) },
                          { label: 'Mean', value: fmtAvg(footerStats.meanValue) },
                        ],
                        [
                          {
                            label: 'Best',
                            value: footerStats.best === null ? '—' : fmt(footerStats.best),
                            onPress: () => openBestSolve(),
                          },
                          { label: 'Solves', value: String(footerStats.count) },
                        ],
                      ]
                }
              />
            </View>
          </View>
        )}
      </View>

      {avgView && <AverageDetailSheet view={avgView} event={event} onClose={() => setAvgView(null)} />}
      {detailIndex !== null && (
        <SolveDetailSheet
          solves={data.solves}
          index={detailIndex}
          event={event}
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
      )}

      <EventPickerSheet
        visible={showEventPicker}
        value={event}
        onSelect={settings.setCurrentEvent}
        onClose={() => setShowEventPicker(false)}
      />

      {/* Last child, so it draws over everything, and absolutely positioned so
          it takes no space in the column: a PB no longer shoves the scramble
          image and stats down the screen. */}
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

// The screen's one surface treatment, shared by every panel on it (timer,
// penalties, scramble image, stats) so they read as one set rather than four
// separately-styled boxes. Deliberately local and not ui.tsx's Card: that one is
// a hairline-bordered content card with generous padding, which is right for a
// settings or detail screen but too soft and too padded for panels that sit
// edge to edge and have to hold their own next to 84pt digits.
function Tile({
  children,
  style,
  onLayout,
  as = 'view',
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Forwarded so a caller can size its contents to the tile it actually got. */
  onLayout?: ViewProps['onLayout'];
  /** A tile that opens something is a Pressable; the rest stay plain Views. */
  as?: 'view' | 'pressable';
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const base: ViewStyle = {
    backgroundColor: p.card,
    borderColor: p.border,
    borderWidth: 1,
    borderRadius: radius.md,
  };
  if (as === 'pressable') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLayout={onLayout}
        style={({ pressed }) => [base, style, pressed ? { opacity: 0.7 } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} onLayout={onLayout}>
      {children}
    </View>
  );
}

// The compact label/value grid beside the scramble image. Two columns so six
// stats fit in the footer without crowding the timer, and every value is
// tabular so the columns don't jitter as times change.
function StatsBlock({
  rows,
  joined,
}: {
  rows: { label: string; value: string; onPress?: () => void }[][];
  /** True when it sits directly under the penalty row, sharing its edge. */
  joined?: boolean;
}) {
  return (
    <Tile
      style={[
        {
          flex: 1,
          paddingVertical: space.sm,
          paddingHorizontal: space.md,
          // Clipped, so a row that still can't fit is visibly cut at the tile
          // edge rather than drawn over the tab bar below it.
          overflow: 'hidden',
        },
        joined ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 } : null,
      ]}
    >
      {rows.map((row, i) => (
        // Each row takes an equal share of the tile rather than its natural
        // height. Stacking the label over the value doubled the lines each row
        // needs, and three of those overflowed the tile's bottom edge (the last
        // row, BEST/SOLVES, was drawn outside it). Sharing the height means the
        // rows fit whatever the tile actually is, and the value's own
        // adjustsFontSizeToFit takes care of the rest.
        <View
          key={i}
          style={{ flex: 1, flexDirection: 'row', columnGap: space.md, justifyContent: 'center' }}
        >
          {row.map((cell) => (
            <StatCell key={cell.label} label={cell.label} value={cell.value} onPress={cell.onPress} />
          ))}
        </View>
      ))}
    </Tile>
  );
}

function StatCell({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const p = usePalette();
  const { s: sc, maxFontMultiplier } = useScreenScale();
  // An em dash means there's no such average yet, so there's nothing to open.
  const tappable = !!onPress && value !== '—';
  const body = (
    <>
      <Text
        style={{
          color: p.textMuted,
          fontFamily: font.sansSemi,
          fontSize: Math.max(8, sc(9)),
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontMultiplier}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={maxFontMultiplier}
        style={{
          color: tappable ? p.accent : p.text,
          fontFamily: MONO_BOLD,
          fontSize: Math.max(11, sc(14)),
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </>
  );
  // Stacked, not side by side: a label beside a mono time needs about 100pt, and
  // two of those don't fit once the scramble image has taken its share of the
  // row, which is what left every figure ellipsized ("21.…", "6.41s."). Stacking
  // needs only as much width as the wider of the two lines. A long value shrinks
  // its own font rather than losing digits, since a truncated time is worse than
  // a small one.
  const style = { flex: 1, minWidth: 0, justifyContent: 'center' as const };
  if (!tappable) return <View style={style}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ ...style, opacity: pressed ? 0.55 : 1 })}
    >
      {body}
    </Pressable>
  );
}
