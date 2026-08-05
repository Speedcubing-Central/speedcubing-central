import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatTime, type Penalty } from '@scc/shared';
import { parseTimeInput } from '../../lib/timeInput';
import { scrambleImageHeight, scrambleImageWidth } from '../../lib/scramble';
import { densityFor, useRhythm, useScreenScale } from '../../lib/scale';
import { usePalette, useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import { Button, EMPTY, IconButton, Loading, MONO_BOLD, Muted } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { ScrambleView } from '../../components/ScrambleView';
import { ScrambleNet, hasScrambleNet } from '../../components/ScrambleNet';
import { ScrambleImageSheet } from '../timer/ScrambleImageSheet';
import { KeypadSheet } from '../timer/Keypad';
import { PenaltyRow } from '../timer/PenaltyRow';
import { TimerDigits } from '../timer/TimerDigits';
import { useTimerEngine, type TimerPhase } from '../timer/useTimerEngine';
import { BattlePanel } from './BattlePanel';
import { BattleSettingsSheet } from './BattleSettingsSheet';
import { BattleEventSheet } from './BattleEventSheet';
import { RoundResultOverlay } from './RoundResultOverlay';
import { useBattleSocket } from './useBattleSocket';
import { battleEventLabel } from './LobbySheets';
import { getGuestName, hydrateGuestName } from './guestName';
import type { BattleStackParamList } from '../../navigation/BattleStack';
import { font, mix, radius, space } from '../../theme';

// ── A live Battle room ────────────────────────────────────────────────────
//
// Every feature the web room has, laid out the way the Timer is rather than the
// way the desktop page is.
//
// The desktop page is two columns: a timer on the left under a room header and a
// scramble, and on the right a permanently-visible stack of your stats, the
// leaderboard, chat and your round history. That is a good use of a wide screen
// and a poor use of a phone: stacked into one column it became five cards of
// equal weight, and the timer, the thing you are actually holding the phone to
// use, was one of them.
//
// So the column here is the Timer's column, for the same reasons and with the
// same rules:
//
//   header      the room, its event, its round, its code
//   scramble    text on the page, with the cube under it
//   timer       the digits, on no surface at all, taking everything left over
//   panel       a strip you glance at, which drags up into the rest
//
// The right-hand column becomes that panel (BattlePanel), so checking the
// standings or answering a message never costs you the screen you are solving
// on. Everything hides during an attempt, exactly as on the Timer.
//
// The gameplay itself is not reimplemented. The engine is the Timer's engine,
// the penalty control is the Timer's, the keypad is the Timer's, and every
// number is formatted by @scc/shared. The room's rules live on the server and
// this only speaks its protocol, so a phone and a browser in one room cannot
// disagree about what happened.
type Props = NativeStackScreenProps<BattleStackParamList, 'BattleRoom'>;

const IMAGE_FLEX = 1;
const TIMER_FLEX = 2.2;
const IMAGE_MAX_GROWTH = 1.25;
const TIMER_CONTENT_BIAS = 0.65;
const TIMER_MIN_H = 140;

// See the Timer's copy: the cube's box moves by a point or two whenever the
// scramble above it wraps differently, and passing that straight through
// resizes the drawing, which makes react-native-svg re-lay out every element in
// it. Reported in steps so it only changes when it meaningfully has.
const IMAGE_BOX_STEP = 8;

export default function BattleRoomScreen({ route, navigation }: Props) {
  const p = usePalette();
  const { s: sc, fontScale, maxFontMultiplier, width } = useScreenScale();
  const settings = useSettings();
  const { user } = useAuth();

  const code = route.params.code.toUpperCase();
  const password = route.params.password;
  // The name to join under. A signed-in user is identified server-side from
  // their verified token and the name is only a label; a guest's name is the
  // only thing their participant row can be matched by on a reconnect, so it has
  // to be the same one every time (see guestName.ts).
  const [guestFallback, setGuestFallback] = useState(getGuestName());
  useEffect(() => {
    hydrateGuestName().then(() => setGuestFallback(getGuestName()));
  }, []);
  const displayName = user?.displayName ?? route.params.displayName ?? guestFallback;

  const {
    connected,
    room,
    lastResult,
    setLastResult,
    error,
    setError,
    connectionError,
    myHistory,
    chatMessages,
    myParticipantId,
    setMyParticipantId,
    joinRoom,
    solveComplete,
    leaveRoom,
    changeEvent,
    sendChatMessage,
  } = useBattleSocket();

  const [submitted, setSubmitted] = useState(false);
  const [pendingTime, setPendingTime] = useState(0);
  const [pendingPenalty, setPendingPenalty] = useState<Penalty>('NONE');
  const [pendingPlusTwoCount, setPendingPlusTwoCount] = useState(0);
  const [awaitingSubmit, setAwaitingSubmit] = useState(false);
  // A penalty change made after submitting that has not been sent yet.
  //
  // Only +2 can be in this state. OK and DNF are decisions and go immediately,
  // but a +2 is a tally you may still be adding to, so it waits for Confirm, and
  // in the meantime the screen must not claim your result is in when what is on
  // it differs from what the server has.
  const [unsent, setUnsent] = useState(false);
  // What the server was actually told, as distinct from what the penalty
  // buttons are currently showing. The panel puts our own result on our row
  // before room_state confirms it, and that shortcut is only honest if it
  // repeats what was sent rather than what is being considered.
  const [sent, setSent] = useState<{ time: number; penalty: Penalty; plusTwoCount: number } | null>(null);
  const [typed, setTyped] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangeEvent, setShowChangeEvent] = useState(false);
  const [showScrambleImage, setShowScrambleImage] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [columnH, setColumnH] = useState(0);
  const [timerTileH, setTimerTileH] = useState(0);
  const [panelCollapsedH, setPanelCollapsedH] = useState(0);
  const [imageBoxH, setImageBoxHRaw] = useState(0);
  const setImageBoxH = useCallback((h: number) => {
    // Floor, so the drawing always stays inside the box it was given.
    setImageBoxHRaw(Math.floor(h / IMAGE_BOX_STEP) * IMAGE_BOX_STEP);
  }, []);

  const phaseRef = useRef<TimerPhase>('idle');

  const roundActive = room?.status === 'ACTIVE';
  const canSolve = roundActive && !submitted;

  // ── Submitting ───────────────────────────────────────────────────────────

  const submit = useCallback(
    (penalty: Penalty, time: number, plusTwoCount: number) => {
      const count = penalty === 'DNF' ? 0 : plusTwoCount;
      solveComplete(code, time, penalty, count);
      setPendingTime(time);
      setPendingPenalty(penalty);
      setPendingPlusTwoCount(count);
      setSent({ time, penalty, plusTwoCount: count });
      setSubmitted(true);
      setAwaitingSubmit(false);
      setUnsent(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    },
    [code, solveComplete],
  );

  const onTimerComplete = useCallback((timeMs: number) => {
    // Stopping does not submit. The penalty choice comes first, exactly as on
    // web: the buttons select, and the Submit button below them sends.
    setPendingTime(timeMs);
    setPendingPenalty('NONE');
    setPendingPlusTwoCount(0);
    setAwaitingSubmit(true);
  }, []);

  const engineEnabled =
    !!canSolve &&
    settings.entryMode === 'keyboard' &&
    !awaitingSubmit &&
    !showSettings &&
    !showChangeEvent &&
    !showScrambleImage &&
    !showKeypad &&
    !panelOpen &&
    !lastResult;

  const engine = useTimerEngine({
    inspection: settings.inspection,
    inspectionDirection: settings.inspectionDirection,
    inspectionVoice: settings.inspectionVoice,
    holdToStart: settings.holdToStart,
    holdDuration: settings.holdDuration,
    startSound: settings.startSound,
    enabled: engineEnabled,
    onComplete: onTimerComplete,
  });
  phaseRef.current = engine.phase;

  // ── Joining, and re-joining on every reconnect ───────────────────────────
  //
  // Not a one-shot flag. socket.io reconnects the transport by itself, but the
  // server sees a brand new connection with no room membership, so a client that
  // only ever sent join_room once goes silently stale: it keeps rendering its
  // last snapshot forever and its solve submissions are dropped, which blocks
  // round completion for everyone else too, not just for it. This is the same
  // fix the web client carries, and the same reason.
  const joined = useRef(false);
  // True from the moment we ask to join until the server answers with room
  // state. An error arriving inside that window means the join itself failed,
  // whatever the message happens to say, which is what makes this a rule rather
  // than a list of message strings to match against.
  const joinPending = useRef(false);
  // Set once we have decided this room cannot be entered, so the rejoin below
  // stops trying and a second error cannot stack another alert behind the first.
  const givingUp = useRef(false);

  useEffect(() => {
    if (givingUp.current) return;
    if (!connected) {
      joined.current = false;
      return;
    }
    if (!displayName || joined.current) return;
    joined.current = true;
    joinPending.current = true;
    joinRoom({ code, name: displayName, password });
  }, [connected, displayName, code, password, joinRoom]);

  // The join was answered, so anything that goes wrong from here is about a
  // room we are actually in.
  useEffect(() => {
    if (room) joinPending.current = false;
  }, [room]);

  // Which participant row is ours. Matched by account when signed in, by name
  // otherwise, the same pair of rules the server itself uses.
  useEffect(() => {
    if (!room || !displayName) return;
    const me = room.participants.find(
      (x) => (user?.id && x.userId === user.id) || x.name === displayName,
    );
    if (me && me.id !== myParticipantId) setMyParticipantId(me.id);
  }, [room, displayName, user?.id, myParticipantId, setMyParticipantId]);

  // A new round: everything about the last one is cleared, including the
  // scoreboard, which must never be left covering a live attempt.
  useEffect(() => {
    if (room?.status !== 'ACTIVE') return;
    setSubmitted(false);
    setAwaitingSubmit(false);
    setUnsent(false);
    setSent(null);
    setTyped('');
    setShowKeypad(false);
    setLastResult(null);
    engine.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.roundNumber, room?.status]);

  // Socket errors surface as an alert and are cleared, so the same one does not
  // re-fire on the next render.
  //
  // A failed join ends the screen. Previously every error was just an alert, so
  // dismissing "Room not found" left you sitting on "Joining ABC123…" with
  // nothing behind it, and every reconnect re-sent the join and raised the same
  // alert again. There is nothing to wait for: the room was not entered, and on
  // this path it usually no longer exists (an empty room deletes itself, so
  // arriving as the last player leaves is exactly when this happens).
  useEffect(() => {
    if (!error) return;
    setError(null);
    // Already on the way out. Further errors are noise from the connection
    // winding down and must not queue a second alert behind the first.
    if (givingUp.current) return;

    if (joinPending.current) {
      givingUp.current = true;
      Alert.alert('Battle', error, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    Alert.alert('Battle', error);
  }, [error, setError, navigation]);

  const handleLeave = useCallback(() => {
    leaveRoom(code);
    navigation.goBack();
  }, [leaveRoom, code, navigation]);

  // ── Manual entry ─────────────────────────────────────────────────────────

  const manualPrecision = settings.solvePrecision;
  const maxTypedDigits = manualPrecision + 4;

  const pressDigit = useCallback(
    (digit: string) => {
      setTyped((prev) => {
        const next = (prev + digit).replace(/^0+(?=\d)/, '');
        return next.length > maxTypedDigits ? prev : next;
      });
    },
    [maxTypedDigits],
  );

  const manualDisplay = useMemo(() => {
    if (!typed) return formatTime(0, 'NONE', settings.solvePrecision);
    const parsed = parseTimeInput(typed, manualPrecision);
    if (!parsed) return typed;
    return formatTime(parsed.time, 'NONE', settings.solvePrecision, parsed.plusTwoCount);
  }, [typed, manualPrecision, settings.solvePrecision]);

  // A typed time goes to the penalty choice, exactly like a timed one, and
  // exactly like the web room's own typing mode (handleTypingSubmit there sets
  // awaitingSubmit rather than sending).
  //
  // It used to send immediately, and that is a real problem rather than a
  // shortcut: the round is scored the moment the last player's time lands, so
  // whoever finishes last had their result committed before they could add a +2
  // to it. Nothing on this screen is in a hurry until you say so.
  const addTyped = useCallback(() => {
    const parsed = parseTimeInput(typed, manualPrecision);
    if (!parsed) return;
    setPendingTime(parsed.time);
    setPendingPenalty(parsed.penalty);
    setPendingPlusTwoCount(parsed.plusTwoCount);
    setAwaitingSubmit(true);
    setTyped('');
    setShowKeypad(false);
  }, [typed, manualPrecision]);

  // ── Display ──────────────────────────────────────────────────────────────

  const immersive =
    engine.phase === 'inspecting' ||
    engine.phase === 'holding' ||
    engine.phase === 'ready' ||
    engine.phase === 'running';

  const screenTint = useMemo(() => {
    if (engine.phase === 'ready') return mix(p.bg, p.green, 0.12);
    if (engine.phase === 'holding') return mix(p.bg, settings.inspection ? p.yellow : p.red, 0.12);
    if (engine.phase === 'running') return mix(p.bg, p.accent, 0.08);
    return p.bg;
  }, [engine.phase, p, settings.inspection]);

  const setTimerImmersion = useUi((s) => s.setTimerImmersion);
  useEffect(() => {
    setTimerImmersion(immersive, immersive ? screenTint : null);
  }, [immersive, screenTint, setTimerImmersion]);
  useEffect(() => () => setTimerImmersion(false, null), [setTimerImmersion]);

  const density = columnH > 0 ? densityFor(columnH, fontScale) : 'comfortable';
  const rhythm = useRhythm(density);

  const eventId = room?.eventId ?? '333';
  // The cube is sized one tier tighter than the column's own, once the column is
  // tight at all. The room has less to spend than the Timer does at the same
  // density: it carries a room header the Timer has no equivalent of, and it has
  // to keep room for penalty controls that appear partway through every round.
  // Measured: without this an iPhone SE on a square-1 scramble overflowed by
  // 10pt, square-1 being the one puzzle whose artwork is taller than it is wide,
  // so a modest width still buys a tall picture.
  const imageDensity = density === 'compact' ? 'minimal' : density;
  const imageHeight = scrambleImageHeight(eventId, imageDensity, width);
  const imageWidth = scrambleImageWidth(eventId, width);

  const digitCeiling = sc(immersive ? 128 : 104);
  const digitFontSize =
    timerTileH > 0 ? Math.max(sc(30), Math.min(digitCeiling, timerTileH * 0.6)) : digitCeiling;

  const timerContentLift = useMemo(() => {
    if (immersive || timerTileH <= 0) return 0;
    const contentH = digitFontSize * 1.1 + space.md + sc(18);
    return Math.round(Math.max(0, timerTileH - contentH) * TIMER_CONTENT_BIAS);
  }, [immersive, timerTileH, digitFontSize, sc]);

  const restingText = useMemo(() => {
    if (submitted || awaitingSubmit) {
      return formatTime(pendingTime, pendingPenalty, settings.solvePrecision, pendingPlusTwoCount);
    }
    if (engine.phase === 'stopped') return formatTime(Math.round(engine.stoppedElapsed), 'NONE', settings.solvePrecision);
    return formatTime(0, 'NONE', settings.solvePrecision);
  }, [
    submitted,
    awaitingSubmit,
    pendingTime,
    pendingPenalty,
    pendingPlusTwoCount,
    engine.phase,
    engine.stoppedElapsed,
    settings.solvePrecision,
  ]);

  const digitColor = (() => {
    if (engine.phase === 'ready') return p.green;
    if (engine.phase === 'holding') return settings.inspection ? p.yellow : p.red;
    // While a penalty is being chosen, or a change to an already-sent one has
    // not been committed, the digits are a preview of what Submit will send,
    // not a result. Colouring them by the pending penalty is what makes that
    // legible at a glance: the number already changes (a +2 moves it, a DNF
    // replaces it), and this says *why* in the same yellow and red the buttons
    // underneath use. Matches the web room, which colours the same state the
    // same way.
    //
    // Green is reserved for "this is what the room has", so it deliberately
    // does not apply until the result is actually in and unmodified.
    if (awaitingSubmit || unsent) {
      if (pendingPenalty === 'DNF') return p.red;
      if (pendingPlusTwoCount > 0) return p.yellow;
      return p.text;
    }
    if (submitted) return p.green;
    return p.text;
  })();

  // Stable identity, so the panel's memo holds across the many renders a live
  // round pushes through this screen (a phase change, a tick of the engine's
  // resting text, a room_state, a chat message).
  const panelPending = useMemo(
    () => ({
      submitted: sent !== null,
      time: sent?.time ?? 0,
      penalty: sent?.penalty ?? ('NONE' as Penalty),
      plusTwoCount: sent?.plusTwoCount ?? 0,
    }),
    [sent],
  );

  const me = room?.participants.find((x) => x.id === myParticipantId);
  const isHost = me?.isHost ?? false;

  const openScrambleImage = useCallback(() => setShowScrambleImage(true), []);
  const copyScramble = useCallback(() => {
    if (room?.scramble) void Clipboard.setStringAsync(room.scramble);
  }, [room?.scramble]);
  const sendChat = useCallback((message: string) => sendChatMessage(code, message), [sendChatMessage, code]);

  // ── Pre-room states ──────────────────────────────────────────────────────

  if (!connected) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
        {/* The reason, when there is one, rather than a spinner that says
            nothing. socket.io keeps retrying underneath, so this stays a
            waiting state and not an error screen, but "the tunnel is down"
            and "the server is slow" should not look identical. */}
        <Loading label={connectionError ? 'Reconnecting…' : 'Connecting…'} />
        {connectionError ? (
          <Muted style={{ textAlign: 'center', paddingHorizontal: space.xl, paddingBottom: space.xl }}>
            {connectionError}
          </Muted>
        ) : null}
        <View style={{ padding: space.lg }}>
          <Button label="Back to rooms" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
        <Loading label={`Joining ${code}…`} />
        {/* A way out that does not depend on an error arriving. If the server
            never answers the join at all, the alert path below never fires and
            this screen would otherwise be a dead end. */}
        <View style={{ padding: space.lg }}>
          <Button label="Back to rooms" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const showScramble = roundActive && !!room.scramble;
  const manualEntry = settings.entryMode !== 'keyboard';
  // The solve is done and the penalty controls are on screen. Drives what the
  // column gives up to make room for them; see the cube below.
  const solveOver = roundActive && (awaitingSubmit || submitted);

  // What the timer surface says under the digits, which is the whole of the
  // room's state machine expressed in one line.
  const hint = (() => {
    if (!roundActive) {
      return room.participants.length < 2 ? `Waiting for players. Code ${room.code}` : 'Next round starting…';
    }
    if (unsent) return `Confirm to update your time to +${pendingPlusTwoCount * 2}`;
    if (submitted) return 'Submitted. Waiting for the others…';
    if (awaitingSubmit) return 'Choose a penalty, then submit';
    if (manualEntry) return typed ? 'Tap to finish this entry' : 'Tap to enter your time';
    switch (engine.phase) {
      case 'idle':
        return settings.inspection ? 'Tap to inspect' : 'Hold, then release';
      case 'inspecting':
        return 'Hold to get ready';
      case 'holding':
        return 'Keep holding…';
      case 'ready':
        return 'Release to start';
      case 'running':
        return 'Tap anywhere to stop';
      default:
        return '';
    }
  })();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: screenTint }}>
      <View
        style={{ flex: 1, paddingHorizontal: space.md }}
        onLayout={(e) => setColumnH(e.nativeEvent.layout.height)}
      >
        {/* The chrome, hidden during an attempt but never unmounted: the cube
            costs a cubing.js render and an SVG parse to rebuild, and doing that
            in the frame the timer stops is what makes a screen feel slow to come
            back. See the Timer's own note and HANDOFF. */}
        <View style={{ display: immersive ? 'none' : 'flex', marginBottom: rhythm.section }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: rhythm.tight }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontMultiplier}
                style={{ color: p.text, fontFamily: font.sansBold, fontSize: sc(15) }}
              >
                {room.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={maxFontMultiplier}
                  style={{ color: p.textMuted, fontFamily: font.sansSemi, fontSize: sc(12), flexShrink: 1 }}
                >
                  {battleEventLabel(room.eventId, room.algSetId)}
                  {' · '}
                  Round {room.roundNumber > 0 ? room.roundNumber : EMPTY}
                </Text>
                {/* The code is the one thing on this screen someone else needs,
                    so it is a control rather than a caption. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Copy room code ${room.code}`}
                  onPress={() => {
                    void Clipboard.setStringAsync(room.code);
                    Haptics.selectionAsync().catch(() => undefined);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 3, opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ color: p.accent, fontFamily: MONO_BOLD, fontSize: sc(12), letterSpacing: 1 }}>
                    {room.code}
                  </Text>
                  <Icon name="copy" size={11} color={p.accent} />
                </Pressable>
              </View>
            </View>

            {isHost && (
              <IconButton name="pencil" accessibilityLabel="Change event" onPress={() => setShowChangeEvent(true)} />
            )}
            <IconButton name="gear" accessibilityLabel="Battle settings" onPress={() => setShowSettings(true)} />
            <IconButton name="logout" accessibilityLabel="Leave room" onPress={handleLeave} />
          </View>
        </View>

        {/* Scramble. No refresh, edit or back controls, unlike the Timer: in a
            battle the scramble is the room's, identical for everyone, and a
            control that changed it for you alone would be a way to cheat rather
            than a feature. Copy and the full-size view are still yours. */}
        <View style={{ display: immersive || !showScramble ? 'none' : 'flex', marginBottom: rhythm.group }}>
          <ScrambleView
            eventId={eventId}
            scramble={room.scramble}
            loading={false}
            onCopy={copyScramble}
            onOpenImage={openScrambleImage}
          />
        </View>

        {/* ── The cube ──
            Hidden while the penalty controls are up, and not for tidiness: the
            two together do not fit. Measured in Yoga across five devices, seven
            events and three text sizes, keeping both overflowed the column on
            every device modelled for the deep-scramble events, and on an iPhone
            SE even for a 3x3. This screen does not scroll, so overflow means the
            penalty buttons are not merely cramped, they are unreachable, and the
            round cannot be submitted at all. That exact failure reached a tester
            on the Timer once already.

            It is also the right thing to drop. Once you have stopped the timer
            the cube answers a question you are finished with; what is on screen
            then should be the decision in front of you. */}
        {hasScrambleNet(eventId) && showScramble ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View the scrambled cube full size"
            onPress={openScrambleImage}
            onLayout={(e) => setImageBoxH(e.nativeEvent.layout.height)}
            style={({ pressed }) => ({
              display: immersive || solveOver ? 'none' : 'flex',
              flex: IMAGE_FLEX,
              minHeight: imageHeight,
              maxHeight: Math.round(imageHeight * IMAGE_MAX_GROWTH),
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: rhythm.section - rhythm.group,
              marginBottom: rhythm.group,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <ScrambleNet
              eventId={eventId}
              scramble={room.scramble}
              size={imageWidth}
              maxHeight={imageBoxH > 0 ? imageBoxH : imageHeight}
            />
          </Pressable>
        ) : null}

        {/* ── The timer surface ──
            One tile with several states, rather than a different screen per
            state. It is the same rectangle and the same digit size throughout,
            so the room never reshuffles under you between rounds. */}
        <View
          style={{ flex: TIMER_FLEX, minHeight: sc(TIMER_MIN_H), overflow: 'hidden' }}
          onLayout={(e) => setTimerTileH(e.nativeEvent.layout.height)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              manualEntry ? 'Enter your time' : 'Timer. Touch and hold, then release to start.'
            }
            onPressIn={() => {
              if (engineEnabled && !manualEntry) engine.press();
            }}
            onPressOut={() => {
              if (engineEnabled && !manualEntry) engine.release();
            }}
            onPress={() => {
              // Not while a penalty is being chosen: the keypad would cover the
              // buttons that are waiting on you, and reopening it is not what a
              // tap means at that point.
              if (manualEntry && canSolve && !awaitingSubmit) setShowKeypad(true);
            }}
            disabled={!canSolve && !submitted}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.md,
              paddingBottom: timerContentLift,
            }}
          >
            {roundActive ? (
              <TimerDigits
                phase={engine.phase}
                subscribe={engine.subscribe}
                inspection={settings.inspection}
                inspectionDirection={settings.inspectionDirection}
                timerUpdate={settings.timerUpdate}
                solvePrecision={settings.solvePrecision}
                restingText={manualEntry && !submitted && !awaitingSubmit ? manualDisplay : restingText}
                color={digitColor}
                fontSize={digitFontSize}
              />
            ) : (
              <Text
                allowFontScaling={false}
                style={{
                  color: p.textMuted,
                  fontFamily: MONO_BOLD,
                  fontSize: digitFontSize,
                  lineHeight: digitFontSize * 1.1,
                }}
              >
                {EMPTY}
              </Text>
            )}

            <Muted
              numberOfLines={2}
              maxFontSizeMultiplier={maxFontMultiplier}
              style={{ textAlign: 'center', paddingHorizontal: space.lg }}
            >
              {hint}
            </Muted>

            {engine.phase === 'inspecting' || engine.phase === 'running' ? (
              <Pressable
                accessibilityRole="button"
                onPress={engine.cancel}
                hitSlop={12}
                style={{ position: 'absolute', bottom: space.lg, alignSelf: 'center' }}
              >
                <Text style={{ color: p.textMuted, fontFamily: font.sans, fontSize: 12 }}>Cancel attempt</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </View>

        {/* The penalty control, for the stopped-but-not-sent moment and for as
            long afterwards as the round stays open. Both are the same control on
            purpose: "what penalty is on my time" is one question, and the server
            accepts a correction right up until it scores the round, so there is
            no reason for the answer to become read-only the instant you send it. */}
        {!immersive && roundActive && (awaitingSubmit || submitted) ? (
          <View style={{ gap: space.sm, marginBottom: rhythm.group }}>
            <PenaltyRow
              penalty={pendingPenalty}
              plusTwoCount={pendingPlusTwoCount}
              onChange={(penalty, count) => {
                // A selection tick. Choosing a penalty no longer sends anything,
                // so without this the only feedback that a tap registered is the
                // button's own highlight, which your thumb is on top of.
                Haptics.selectionAsync().catch(() => undefined);
                if (awaitingSubmit) {
                  // Before the time is in, nothing here sends: the buttons pick
                  // a penalty and the Submit button below sends it. Same rule as
                  // the web room. OK and DNF used to send on tap, which made the
                  // step that commits your time invisible unless you happened to
                  // stack a +2 and reveal the Confirm button.
                  setPendingPenalty(penalty);
                  setPendingPlusTwoCount(count);
                  return;
                }
                // After it is in, this is a correction to a result the server
                // already has. OK and DNF are decisions, so they send. A +2 is a
                // tally you may still be adding to, so it waits for Confirm.
                if (penalty === 'DNF' || count === 0) {
                  submit(penalty, pendingTime, count);
                } else {
                  setPendingPenalty(penalty);
                  setPendingPlusTwoCount(count);
                  // Deliberately NOT clearing `submitted`. That would re-arm the
                  // timer under a finger that is on the penalty buttons, and a
                  // stray press would start an attempt in a round you have
                  // already sent a time for. `unsent` says what is actually
                  // true: the result is in, and this change to it is not.
                  setUnsent(true);
                }
              }}
            />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {(awaitingSubmit || pendingPlusTwoCount > 0) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Sends your time for this round"
                  onPress={() => submit(pendingPenalty, pendingTime, pendingPlusTwoCount)}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: 'center',
                    // 13, not the 11 the row's other controls use: this is now
                    // the only thing that commits a round, and at 11 it came to
                    // about 40pt, under the 44 a touch target is meant to be.
                    // The penalty buttons above are selections you can correct;
                    // a mistap on this one sends the wrong result.
                    paddingVertical: 13,
                    borderRadius: radius.sm,
                    backgroundColor: p.accent,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ color: '#fff', fontFamily: font.sansBold, fontSize: 13 }}>
                    {!awaitingSubmit
                      ? `Confirm +${pendingPlusTwoCount * 2}`
                      : pendingPenalty === 'DNF'
                        ? 'Submit DNF'
                        : pendingPlusTwoCount > 0
                          ? `Submit +${pendingPlusTwoCount * 2}`
                          : 'Submit'}
                  </Text>
                </Pressable>
              )}
              {submitted && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setTyped('');
                    setShowKeypad(true);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 11,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: p.border,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ color: p.textMuted, fontFamily: font.sansBold, fontSize: 13 }}>Edit time</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}

        {/* Reserves the collapsed panel's rectangle, so the timer's tap target
            and the panel can never overlap. */}
        {!immersive && <View style={{ height: panelCollapsedH }} />}
      </View>

      {panelOpen && !immersive && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collapse the room panel"
          onPress={() => setPanelOpen(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00000059' }}
        />
      )}

      <BattlePanel
        room={room}
        myParticipantId={myParticipantId}
        columnH={columnH}
        immersive={immersive}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onCollapsedHeight={setPanelCollapsedH}
        chatMessages={chatMessages}
        onSendChat={sendChat}
        myHistory={myHistory}
        solvePrecision={settings.solvePrecision}
        pending={panelPending}
      />

      <KeypadSheet
        visible={showKeypad}
        onClose={() => setShowKeypad(false)}
        display={manualDisplay}
        empty={typed.length === 0}
        disabled={!roundActive}
        onDigit={pressDigit}
        onBackspace={() => setTyped((prev) => prev.slice(0, -1))}
        onClear={() => setTyped('')}
        onSubmit={addTyped}
      />

      <ScrambleImageSheet
        visible={showScrambleImage}
        eventId={eventId}
        scramble={room.scramble}
        onClose={() => setShowScrambleImage(false)}
      />

      <BattleSettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />

      {isHost && (
        <BattleEventSheet
          visible={showChangeEvent}
          eventId={room.eventId}
          algSetId={room.algSetId}
          title="Change event"
          note="Changing the event resets the round and everyone's points."
          applyLabel="Change event"
          onClose={() => setShowChangeEvent(false)}
          onApply={(newEventId, newAlgSetId) => changeEvent(code, newEventId, newAlgSetId ?? undefined)}
        />
      )}

      {lastResult && (
        <RoundResultOverlay
          result={lastResult}
          solvePrecision={settings.solvePrecision}
          onDismiss={() => setLastResult(null)}
        />
      )}
    </SafeAreaView>
  );
}
