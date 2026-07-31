import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
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
import { eventBadge, scrambleImageHeight } from '../../lib/scramble';
import { densityFor, useRhythm, useScreenScale } from '../../lib/scale';
import { usePalette, useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { Button, IconButton, Input, MONO_BOLD, Muted } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ScrambleView } from '../../components/ScrambleView';
import { PbCelebration } from './PbCelebration';
import { EventPickerSheet } from '../../components/EventPickerSheet';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolveDetailSheet } from './SolveDetailSheet';
import { EditScrambleSheet } from './EditScrambleSheet';
import { ScrambleImageSheet } from './ScrambleImageSheet';
import { TimerMenuSheet, type TimerMenuItem } from './TimerMenuSheet';
import { StatsPanel } from './StatsPanel';
import { useTimerDataContext } from './TimerDataContext';
import { useScrambler } from './useScrambler';
import { useTimerEngine, formatInspectionDisplay } from './useTimerEngine';
import type { TimerStackParamList } from '../../navigation/TimerStack';
import { font, radius, space } from '../../theme';

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
//   scramble    text on the page, with its controls beneath
//   timer       the digits, on no surface at all, taking everything left over
//   panel       a strip you glance at, which drags up into everything else
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

// The timer is now the column's only flexible child, so there is no share to
// negotiate: this exists to hold that fact where the next person will read it.
// The previous 3:1 split against a footer sibling is gone along with the footer.
const TIMER_FLEX = 1;

// A floor on the timer tile, and deliberately a DIAGNOSTIC one. The old
// arrangement had the floor on the footer and let the timer absorb any
// shortfall; now the timer holds the floor and a shortfall has nowhere to go,
// because the scramble is auto-height and React Native leaves flexShrink at 0.
// So if this binds, the column overflows, and the Yoga harness fails on its
// explicit overflow assertion rather than a clipped screen reaching a phone.
// The real relief valves are ScrambleView's content-length font ladder and
// `density` dropping content.
const TIMER_MIN_H = 140;

export default function TimerScreen({ navigation }: Props) {
  const p = usePalette();
  const { s: sc, fontScale, maxFontMultiplier } = useScreenScale();
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
  const scr = useScrambler(scrambleEventId, data.currentId);

  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditScramble, setShowEditScramble] = useState(false);
  const [showScrambleImage, setShowScrambleImage] = useState(false);
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
    [data, scr, event, celebratePBs],
  );

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
  // borrows that, so the state is legible from the edge of your vision at the
  // moment your eyes are on the cube rather than the phone.
  //
  // Held at 12% so it reads as a tint on the background rather than a filled
  // panel; at full strength it would compete with the digits sitting on it.
  // This was previously computed and then applied only to the manual-entry
  // branch, so the touch timer, the one the comment is actually about, never
  // had it.
  const surfaceTint = (() => {
    const phase = engine.phase;
    if (phase === 'ready') return `${p.green}1F`;
    if (phase === 'holding') return inspection ? `${p.yellow}1F` : `${p.red}1F`;
    if (phase === 'running') return `${p.accent}14`;
    return 'transparent';
  })();

  // While an attempt is live the screen goes immersive: chrome hidden so nothing
  // but the digits is on screen (and nothing but the digits is touchable) at the
  // moment your hands are leaving the phone for the cube.
  const immersive =
    engine.phase === 'inspecting' || engine.phase === 'holding' || engine.phase === 'ready' || engine.phase === 'running';

  // One decision, read by the header and the panel, so they cannot disagree
  // about how much room there is.
  const density = columnH > 0 ? densityFor(columnH, fontScale) : 'comfortable';
  const rhythm = useRhythm(density);

  // Sized per puzzle, because every NxN from 4x4 up is drawn into the same
  // 1.600 viewBox and differs only in how many stickers are packed into it: one
  // constant that suits a 9-row 3x3 leaves a 21-row 7x7 unreadable. Scaled by
  // the screen and then by density, so it is the events that need the room that
  // spend the timer's height, and a 3x3 keeps its digits at their ceiling.
  const imageHeight = scrambleImageHeight(scrambleEventId, density, sc);

  // Raised well past the old 64: that ceiling was set when the timer was a
  // bordered card competing with four others, and it left the digits at ~53pt
  // inside a 320pt surface. With the card gone the time is the screen, so the
  // ceiling is the width of the phone rather than an arbitrary point size, and
  // the measured-tile share still governs on short screens.
  // adjustsFontSizeToFit handles the long values ("1:23.45" is seven characters
  // where "25.05" is five).
  const digitCeiling = sc(immersive ? 128 : 104);
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={{ flex: 1, paddingHorizontal: space.md }}
        onLayout={(e) => setColumnH(e.nativeEvent.layout.height)}
      >
        {!immersive && (
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

            <View style={{ marginBottom: rhythm.group }}>
              <ScrambleView
                eventId={scrambleEventId}
                scramble={scr.scramble}
                loading={scr.loading}
                onRefresh={() => scr.refresh()}
                onGoBack={scr.goBack}
                canGoBack={scr.previous !== null && !scr.loading && (engine.phase === 'idle' || engine.phase === 'stopped')}
                onEdit={() => setShowEditScramble(true)}
                onCopy={() => Clipboard.setStringAsync(normalizeScramble(scr.scramble))}
                onOpenImage={() => setShowScrambleImage(true)}
                imageHeight={imageHeight}
              />
            </View>
          </>
        )}

        {/* ── The timer surface ──
            No fill of its own. The digits are the focal point of the screen,
            and a panel behind them puts a box in the way of that: a surface
            says "this is one thing among several", which is exactly the reading
            to avoid. The tint is the phase colour, not a surface.

            Overflow is clipped to the radius so the Pressable fills the tile
            exactly: the area you see and the area that starts a solve are the
            same rectangle, which matters more here than anywhere else. */}
        {entryMode === 'keyboard' && !isFmc ? (
          <View
            style={{
              flex: TIMER_FLEX,
              minHeight: sc(TIMER_MIN_H),
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
                if (engineEnabled) engine.press();
              }}
              onPressOut={() => {
                if (engineEnabled) engine.release();
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}
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
          // Manual entry, also the path FMC takes in this pass. Same surface as
          // the touch timer above, so switching input mode doesn't change what
          // the screen looks like, only what it accepts.
          <View
            style={{
              flex: TIMER_FLEX,
              minHeight: sc(TIMER_MIN_H),
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.lg,
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor: surfaceTint,
            }}
            onLayout={(e) => setTimerTileH(e.nativeEvent.layout.height)}
          >
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              allowFontScaling={false}
              style={{ color: p.text, fontFamily: MONO_BOLD, fontSize: sc(52), fontVariant: ['tabular-nums'] }}
            >
              {typed || (isFmc ? 'moves' : formatTime(0, 'NONE', solvePrecision))}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <Input
                value={typed}
                onChangeText={setTyped}
                onSubmitEditing={addTyped}
                // The panel is position:absolute against the bottom edge and
                // nothing here manages the keyboard, so an open panel would sit
                // underneath it. Collapsing on focus is the cheap fix.
                onFocus={() => setPanelOpen(false)}
                editable={!inputBlocked}
                placeholder={isFmc ? '28' : '10.00'}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                mono
                align="center"
                style={{ fontSize: 20, width: 140 }}
              />
              <Button label="Add" variant="primary" onPress={addTyped} disabled={inputBlocked} />
            </View>
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
        onOpenStatsScreen={() => navigation.navigate('Stats')}
        onOpenSolvesScreen={() => navigation.navigate('Solves')}
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
