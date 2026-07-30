import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  currentAverage,
  detectNewPBs,
  formatMoveCount,
  formatTime,
  getEvent,
  singleStats,
  SUBSET_EVENTS,
  TIMER_ONLY_EVENT_IDS,
  type Penalty,
} from '@scc/shared';
import { apiError } from '../../lib/api';
import { parseTimeInput } from '../../lib/timeInput';
import { usePalette, useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { Chip, MONO, Muted, StatPill } from '../../components/ui';
import { ScrambleView } from '../../components/ScrambleView';
import { EventPickerSheet } from '../../components/EventPickerSheet';
import { PenaltyRow } from './PenaltyRow';
import { useTimerDataContext } from './TimerDataContext';
import { useScrambler } from './useScrambler';
import { useTimerEngine, formatInspectionDisplay } from './useTimerEngine';
import type { TimerStackParamList } from '../../navigation/TimerStack';
import { radius, space } from '../../theme';

// ── The mobile Timer, restructured rather than shrunk ─────────────────────
//
// The web Timer page is a two-column desktop layout: scramble + timer +
// last-solve on the left, and a permanently-visible Statistics table
// (single/mo3/ao5/ao12/ao50/ao100/ao1000 x Current/Best/BPA/WPA/Target) plus the
// full Solves list on the right. That's roughly 40 numbers and an unbounded list
// competing with the timer for a phone screen, which doesn't work. So on mobile:
//
//  * The timer surface itself is the screen. It's the biggest tap target, sized
//    to fill whatever's left, and it's what your thumb lands on.
//  * Only two numbers stay visible while solving: the last solve and the current
//    Ao5. The two a cuber actually watches between attempts.
//  * The full stats table and the solves list moved to their own sub-screens,
//    one tap away via the header (see navigation/TimerStack.tsx). Same numbers,
//    same code (@scc/shared's timerStats), just not all at once.
//  * Session and event selection collapsed from always-on dropdowns into two
//    chips that open sheets.
//  * During inspection and while running, everything except the digits is
//    hidden. No chrome to mis-tap when you're about to put your hands on a cube.
//
// The underlying behaviour is the web behaviour: same engine phases, same WCA
// inspection penalties, same scramble prefetching, same input blocking while
// solves/scrambles load, same PB detection, same server round-trips.
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

  const stats = useMemo(() => singleStats(data.solves), [data.solves]);
  const ao5 = useMemo(() => currentAverage(data.solves, 5), [data.solves]);
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

  // While an attempt is live the screen goes immersive: chrome hidden so
  // nothing but the digits is on screen (and nothing but the digits is
  // touchable) at the moment your hands are leaving the phone for the cube.
  const immersive = engine.phase === 'inspecting' || engine.phase === 'holding' || engine.phase === 'ready' || engine.phase === 'running';

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
      <View style={{ flex: 1, padding: space.md, gap: space.sm }}>
        {!immersive && (
          <>
            {/* Header: event + session as chips, and the two sub-screen entry
                points that replaced the desktop right-hand column. */}
            <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'center' }}>
              <Chip label={getEvent(event)?.name ?? event} onPress={() => setShowEventPicker(true)} />
              <Chip
                label={sessionLabel}
                onPress={() => navigation.navigate('Sessions')}
                style={{ flexShrink: 1 }}
              />
              <View style={{ flex: 1 }} />
              <Chip label="Stats" onPress={() => navigation.navigate('Stats')} />
              <Chip label="Solves" onPress={() => navigation.navigate('Solves')} />
              <Chip label="⚙" onPress={() => navigation.navigate('TimerSettings')} />
            </View>

            {!user && (
              <Text style={{ color: p.textMuted, fontSize: 11, textAlign: 'center' }}>
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

        {/* ── The timer surface ── */}
        {entryMode === 'keyboard' && !isFmc ? (
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
              backgroundColor: immersive ? p.bg : p.card,
              borderColor: p.border,
              borderWidth: immersive ? 0 : 1,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.lg,
            }}
          >
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{
                color: digitColor,
                fontFamily: MONO,
                fontSize: immersive ? 96 : 72,
                fontWeight: '700',
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
                <Text style={{ color: p.textMuted, fontSize: 12 }}>Cancel attempt</Text>
              </Pressable>
            )}
          </Pressable>
        ) : (
          // Manual entry, also the path FMC takes in this pass.
          <View
            style={{
              flex: 1,
              backgroundColor: p.card,
              borderColor: p.border,
              borderWidth: 1,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.lg,
              padding: space.lg,
            }}
          >
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={{ color: p.text, fontFamily: MONO, fontSize: 56, fontWeight: '700' }}
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
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
              </Pressable>
            </View>
            <Muted>Type a time, "DNF", or append "+" to stack a +2</Muted>
          </View>
        )}

        {/* ── The only stats kept on-screen while solving ──
            Everything else lives in the Stats sub-screen. */}
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
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                  New PB: {pbNote}
                </Text>
              </View>
            )}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: p.card,
                borderColor: p.border,
                borderWidth: 1,
                borderRadius: radius.md,
                paddingVertical: space.md,
              }}
            >
              <StatPill label="Last" value={newest ? fmt(newest.time, newest.penalty, newest.plusTwoCount) : '—'} />
              <View style={{ width: 1, backgroundColor: p.border }} />
              <StatPill
                label="Ao5"
                value={ao5 === null ? '—' : ao5 === Infinity ? 'DNF' : fmt(Math.round(ao5))}
              />
            </View>

            {newest && (
              <PenaltyRow
                penalty={newest.penalty}
                plusTwoCount={newest.plusTwoCount}
                onChange={(pen, count) => data.updatePenalty(newest.id, pen, count)}
                hidePlusTwo={isFmc}
              />
            )}
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
