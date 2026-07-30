import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  currentAverage,
  detectNewPBs,
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
import { usePalette, useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { IconButton, MONO, MONO_BOLD, Muted } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ScrambleView } from '../../components/ScrambleView';
import { ScrambleNet, hasScrambleNet } from '../../components/ScrambleNet';
import { EventPickerSheet } from '../../components/EventPickerSheet';
import { PenaltyRow } from './PenaltyRow';
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

export default function TimerScreen({ navigation }: Props) {
  const p = usePalette();
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
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pbNote, setPbNote] = useState<string | null>(null);

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
          if (hits.length > 0) {
            setPbNote(
              hits
                .map((h) => `${h.label} ${isFmc ? formatMoveCount(h.value, 'NONE', 2) : formatTime(h.value, 'NONE', solvePrecision)}`)
                .join('  ·  '),
            );
            setTimeout(() => setPbNote(null), 4000);
          }
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

  // While an attempt is live the screen goes immersive: chrome hidden so
  // nothing but the digits is on screen (and nothing but the digits is
  // touchable) at the moment your hands are leaving the phone for the cube.
  const immersive =
    engine.phase === 'inspecting' || engine.phase === 'holding' || engine.phase === 'ready' || engine.phase === 'running';

  const hint = (() => {
    switch (engine.phase) {
      case 'idle':
        return inspection ? 'Tap to start inspection' : 'Touch and hold, release to start';
      case 'inspecting':
        return 'Inspecting: hold to get ready';
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
      <View style={{ flex: 1, paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm }}>
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
                <Text style={{ color: p.accent, fontFamily: font.sansBold, fontSize: 13 }}>
                  {getEvent(event)?.name ?? event}
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
                  flexShrink: 1,
                  paddingVertical: 8,
                  paddingHorizontal: space.xs,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Icon name="layers" size={16} color={p.textMuted} />
                <Text
                  numberOfLines={1}
                  style={{ color: p.textMuted, fontFamily: font.sansSemi, fontSize: 13, flexShrink: 1 }}
                >
                  {sessionLabel}
                </Text>
              </Pressable>

              <View style={{ flex: 1 }} />
              <IconButton name="chart" accessibilityLabel="Statistics" onPress={() => navigation.navigate('Stats')} />
              <IconButton name="list" accessibilityLabel="Solves" onPress={() => navigation.navigate('Solves')} />
              <IconButton
                name="gear"
                accessibilityLabel="Timer settings"
                onPress={() => navigation.navigate('TimerSettings')}
              />
            </View>

            {!user && (
              <Text style={{ color: p.textMuted, fontFamily: font.sans, fontSize: 11, textAlign: 'center' }}>
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
          <Tile style={{ flex: 1, overflow: 'hidden' }}>
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
                style={{
                  color: digitColor,
                  fontFamily: MONO_BOLD,
                  fontSize: immersive ? 84 : 64,
                  fontVariant: ['tabular-nums'],
                  paddingHorizontal: space.lg,
                }}
              >
                {display}
              </Text>
              <Muted style={{ textAlign: 'center', paddingHorizontal: space.lg }}>
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
          </Tile>
        ) : (
          // Manual entry, also the path FMC takes in this pass.
          <Tile
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.lg,
              padding: space.lg,
            }}
          >
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ color: p.text, fontFamily: MONO_BOLD, fontSize: 52 }}
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

        {/* ── Footer: scramble image, stats, penalties ── */}
        {!immersive && (
          <View style={{ gap: space.sm }}>
            {pbNote && (
              <View
                style={{
                  backgroundColor: p.accent,
                  borderRadius: radius.sm,
                  paddingVertical: 8,
                  paddingHorizontal: space.md,
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontFamily: font.sansBold,
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  New PB: {pbNote}
                </Text>
              </View>
            )}

            {/* Penalties get their own tile rather than sitting loose above the
                footer: they act on the last solve, not on the timer, and a
                surface of their own is what makes that separation legible. */}
            {newest && (
              <Tile style={{ padding: space.sm }}>
                <PenaltyRow
                  penalty={newest.penalty}
                  plusTwoCount={newest.plusTwoCount}
                  onChange={(pen, count) => data.updatePenalty(newest.id, pen, count)}
                  hidePlusTwo={isFmc}
                />
              </Tile>
            )}

            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'stretch' }}>
              {hasScrambleNet(scrambleEventId) && scr.scramble ? (
                <Tile style={{ padding: space.sm, justifyContent: 'center' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Scramble image"
                    onPress={() => navigation.navigate('Stats')}
                  >
                    <ScrambleNet eventId={scrambleEventId} scramble={scr.scramble} size={116} />
                  </Pressable>
                </Tile>
              ) : null}

              <StatsBlock
                rows={[
                  [
                    { label: 'Ao5', value: fmtAvg(footerStats.ao5) },
                    { label: 'Ao12', value: fmtAvg(footerStats.ao12) },
                  ],
                  [
                    { label: 'Ao100', value: fmtAvg(footerStats.ao100) },
                    { label: 'Mean', value: fmtAvg(footerStats.meanValue) },
                  ],
                  [
                    { label: 'Best', value: footerStats.best === null ? '—' : fmt(footerStats.best) },
                    { label: 'Solves', value: String(footerStats.count) },
                  ],
                ]}
              />
            </View>
          </View>
        )}
      </View>

      <EventPickerSheet
        visible={showEventPicker}
        value={event}
        onSelect={settings.setCurrentEvent}
        onClose={() => setShowEventPicker(false)}
      />
    </SafeAreaView>
  );
}

// The screen's one surface treatment, shared by every panel on it (timer,
// penalties, scramble image, stats) so they read as one set rather than four
// separately-styled boxes. Deliberately local and not ui.tsx's Card: that one is
// a hairline-bordered content card with generous padding, which is right for a
// settings or detail screen but too soft and too padded for panels that sit
// edge to edge and have to hold their own next to 84pt digits.
function Tile({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: p.card,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// The compact label/value grid beside the scramble image. Two columns so six
// stats fit in the footer without crowding the timer, and every value is
// tabular so the columns don't jitter as times change.
function StatsBlock({ rows }: { rows: { label: string; value: string }[][] }) {
  const p = usePalette();
  return (
    <Tile
      style={{
        flex: 1,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        justifyContent: 'space-evenly',
      }}
    >
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {row.map((cell) => (
            <View key={cell.label} style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
              <Text
                style={{
                  color: p.textMuted,
                  fontFamily: font.sansSemi,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  minWidth: 34,
                }}
              >
                {cell.label}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  color: p.text,
                  fontFamily: MONO_BOLD,
                  fontSize: 14,
                  fontVariant: ['tabular-nums'],
                  flexShrink: 1,
                }}
              >
                {cell.value}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </Tile>
  );
}
