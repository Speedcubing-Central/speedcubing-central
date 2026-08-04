import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { formatTime, type BattleRoomDTO, type ChatMessageDTO, type Penalty } from '@scc/shared';
import { usePalette } from '../../store/settings';
import { densityFor, useScreenScale } from '../../lib/scale';
import { useKeyboardHeight } from '../../lib/keyboard';
import {
  ColumnLabel,
  Divider,
  EMPTY,
  Input,
  Label,
  MONO,
  MONO_BOLD,
  Muted,
  Segmented,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { motion, radius, space, stroke } from '../../theme';
import type { PersonalSolve } from './useBattleSocket';

// ── The Battle room's bottom panel ────────────────────────────────────────
//
// Built to the same shape as the Timer's stats panel, and for the same reason.
// The desktop Battle page is two columns: the timer on the left, and on the
// right a permanently-visible stack of Your Stats, Leaderboard, Chat and My
// Round History. A phone has one column, and putting five cards down it made the
// timer, which is the thing you are actually using, one card among five.
//
// So the right-hand column becomes this: a strip you glance at between solves,
// which drags up into everything that was in it. Nothing from the web page is
// dropped, it is just stacked in depth instead of in height.
//
// ── What the collapsed strip says ──
//
// "Am I waiting on someone, and where am I". Those are the two questions a
// player has between finishing a solve and the next round starting, and they are
// what the desktop page answers by having the participant list and the
// leaderboard both on screen. Progress and your own standing answer both in one
// row each, without a list.
//
// ── What the expanded panel holds ──
//
// Players, Chat and History, behind a segmented control. Players is the web's
// participant list and leaderboard merged: they carry the same rows and differ
// only in ordering and in which column they emphasise, which is a reasonable use
// of two desktop cards and a poor use of two phone screens. One list, ordered by
// points, with each player's live status on their own row, answers both.
//
// ── Why Animated + PanResponder ──
//
// Same answer as Sheet.tsx and the Timer's panel: gesture-handler is installed
// but has no GestureHandlerRootView and Reanimated is not installed at all.
// A single-axis clamped drag needs neither.

const HANDLE_H = 22;
const PANEL_COLLAPSED_MIN_H = 76;
const PANEL_COLLAPSED_MAX_H = 190;
// The timer is never fully covered, so the room still reads as the screen you
// are on rather than as a list with a timer somewhere behind it.
const MIN_TIMER_VISIBLE_H = 130;
// How far a finger travels before this is a drag and not a tap that wobbled.
// 6, the number Sheet.tsx and the Timer's panel both settled on: the strip is
// full of things you tap, and claiming the gesture cancels the press underneath.
const DRAG_SLOP = 6;
const PANEL_TOGGLE_DISTANCE = 64;
const PANEL_TOGGLE_VELOCITY = 0.7;

const MEDALS = ['🥇', '🥈', '🥉'];

type PanelTab = 'players' | 'chat' | 'history';

export interface BattlePanelProps {
  room: BattleRoomDTO;
  myParticipantId: string | null;
  /** The measured height of the room column, never the window height. */
  columnH: number;
  /** True while an attempt is live: the panel force-collapses and goes inert. */
  immersive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollapsedHeight: (h: number) => void;
  chatMessages: ChatMessageDTO[];
  onSendChat: (message: string) => void;
  myHistory: PersonalSolve[];
  solvePrecision: number;
  /**
   * This device's own submitted result, shown on our row before the server's
   * room_state has confirmed it. Without this your own time is the last one to
   * appear to you, which reads as the submission not having gone through.
   */
  pending: { submitted: boolean; time: number; penalty: Penalty; plusTwoCount: number };
}

export const BattlePanel = memo(function BattlePanel({
  room,
  myParticipantId,
  columnH,
  immersive,
  open,
  onOpenChange,
  onCollapsedHeight,
  chatMessages,
  onSendChat,
  myHistory,
  solvePrecision,
  pending,
}: BattlePanelProps) {
  const p = usePalette();
  const { s: sc, fontScale } = useScreenScale();
  const keyboard = useKeyboardHeight();
  // The same tier the room column decides from, computed from the same measured
  // height, so the two cannot disagree about how much room there is.
  const density = columnH > 0 ? densityFor(columnH, fontScale) : 'comfortable';

  const [collapsedH, setCollapsedH] = useState(sc(PANEL_COLLAPSED_MIN_H));
  const reportedH = useRef(-1);
  const [everOpened, setEverOpened] = useState(false);
  const [tab, setTab] = useState<PanelTab>('players');
  const [chatInput, setChatInput] = useState('');
  const reduceMotion = useRef(false);
  const chatScrollRef = useRef<ScrollView>(null);

  const expandedH = Math.max(
    sc(PANEL_COLLAPSED_MIN_H),
    Math.min(columnH - sc(MIN_TIMER_VISIBLE_H), columnH * 0.82),
  );
  const travel = Math.max(0, expandedH - collapsedH);

  const offset = useRef(new Animated.Value(0)).current;
  const chrome = useRef(new Animated.Value(immersive ? 0 : 1)).current;
  const openRef = useRef(open);
  const travelRef = useRef(travel);
  const dragFrom = useRef(0);
  const forcedRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    });
  }, []);

  const settleTo = useCallback(
    (next: boolean) => {
      const to = next ? 0 : travelRef.current;
      if (reduceMotion.current) {
        offset.setValue(to);
        return;
      }
      Animated.spring(offset, {
        toValue: to,
        useNativeDriver: true,
        damping: 26,
        stiffness: 260,
        mass: 0.9,
      }).start();
    },
    [offset],
  );

  useEffect(() => {
    travelRef.current = travel;
    if (!openRef.current) offset.setValue(travel);
  }, [travel, offset]);

  // An attempt is starting: get out of the way, on the same clock as the tab bar.
  useEffect(() => {
    forcedRef.current = immersive;
    if (immersive && openRef.current) onOpenChange(false);
    const duration = immersive ? motion.immersiveOut : motion.immersiveIn;
    Animated.parallel([
      Animated.timing(chrome, { toValue: immersive ? 0 : 1, duration, useNativeDriver: true }),
      ...(immersive
        ? [Animated.timing(offset, { toValue: travelRef.current, duration, useNativeDriver: true })]
        : []),
    ]).start();
  }, [immersive, offset, chrome, onOpenChange]);

  const setOpen = useCallback(
    (next: boolean) => {
      if (next) setEverOpened(true);
      onOpenChange(next);
      settleTo(next);
    },
    [onOpenChange, settleTo],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Never on touch-down, so every button in the strip still takes a tap.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          !forcedRef.current && Math.abs(g.dy) > DRAG_SLOP && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          dragFrom.current = openRef.current ? 0 : travelRef.current;
          setEverOpened(true);
        },
        onPanResponderMove: (_e, g) => {
          if (forcedRef.current) return;
          offset.setValue(Math.max(0, Math.min(travelRef.current, dragFrom.current + g.dy)));
        },
        onPanResponderRelease: (_e, g) => {
          if (forcedRef.current) return;
          const wasOpen = openRef.current;
          const next = wasOpen
            ? !(g.dy > PANEL_TOGGLE_DISTANCE || g.vy > PANEL_TOGGLE_VELOCITY)
            : -g.dy > PANEL_TOGGLE_DISTANCE || -g.vy > PANEL_TOGGLE_VELOCITY;
          onOpenChange(next);
          settleTo(next);
        },
        onPanResponderTerminate: () => {
          if (forcedRef.current) return;
          settleTo(openRef.current);
        },
        // Never hand the gesture on mid-drag, which is also what stops a drag
        // travelling up over the timer from reaching the timer's own Pressable
        // and starting a solve.
        onPanResponderTerminationRequest: () => false,
      }),
    [offset, onOpenChange, settleTo],
  );

  // ── Derived ───────────────────────────────────────────────────────────────

  const standings = useMemo(
    () => [...room.participants].sort((a, b) => b.points - a.points),
    [room.participants],
  );

  const myIndex = standings.findIndex((x) => x.id === myParticipantId);
  const me = myIndex >= 0 ? standings[myIndex] : null;

  const solvedCount = room.participants.filter(
    (x) => x.finishedAt || (x.id === myParticipantId && pending.submitted),
  ).length;

  const nonDnf = myHistory.filter((s) => s.penalty !== 'DNF' && s.time !== null).map((s) => s.time!);
  const myStats = {
    rounds: myHistory.length,
    wins: myHistory.filter((s) => s.rank === 1 && s.penalty !== 'DNF').length,
    best: nonDnf.length ? Math.min(...nonDnf) : null,
    // Mean of this room's solves, matching the web page's "Average" tile, which
    // is a plain mean and not a WCA trimmed average.
    avg: nonDnf.length ? Math.round(nonDnf.reduce((a, b) => a + b, 0) / nonDnf.length) : null,
  };

  const fmt = useCallback(
    (time: number | null, penalty: Penalty | null, plusTwoCount: number) =>
      time === null && penalty !== 'DNF' ? EMPTY : formatTime(time, penalty ?? 'NONE', solvePrecision, plusTwoCount),
    [solvePrecision],
  );

  /** A player's live state, in the room's own terms rather than the DTO's. */
  function statusOf(participant: BattleRoomDTO['participants'][number]) {
    if (room.status === 'WAITING') return { label: 'Ready', tone: 'muted' as const };
    if (participant.id === myParticipantId && pending.submitted) {
      return { label: fmt(pending.time, pending.penalty, pending.plusTwoCount), tone: 'done' as const };
    }
    if (participant.finishedAt) {
      // `time` is optional on the DTO and genuinely absent on a DNF, which is
      // not the same as "no result": the penalty is what says which it is.
      return {
        label: fmt(participant.time ?? null, participant.penalty ?? 'NONE', participant.plusTwoCount),
        tone: 'done' as const,
      };
    }
    return { label: 'Solving…', tone: 'busy' as const };
  }

  function send() {
    const message = chatInput.trim();
    if (!message) return;
    onSendChat(message);
    setChatInput('');
  }

  // Newest message in view. Only when the chat tab is actually showing, so a
  // message arriving while you are on Players does not scroll a hidden list.
  useEffect(() => {
    if (open && tab === 'chat') {
      requestAnimationFrame(() => chatScrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [chatMessages, open, tab]);

  const unreadHint = chatMessages.length > 0 && tab !== 'chat';

  return (
    <Animated.View
      pointerEvents={immersive ? 'none' : 'auto'}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: expandedH,
        // Lifted by the keyboard rather than shrunk by it. The panel is out of
        // the column's flex flow entirely, so it can move without the timer
        // above it giving up any height (which is the trap a KeyboardAvoidingView
        // would walk straight into here).
        transform: [{ translateY: offset }, { translateY: -(open ? keyboard : 0) }],
        backgroundColor: p.card,
        borderTopWidth: stroke.thin,
        borderTopColor: p.border,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        opacity: chrome,
        overflow: 'hidden',
      }}
    >
      {/* Everything above the body is the drag surface, same as the Timer's
          panel: a grabber alone is a 4mm target, the whole strip is a
          comfortable one. */}
      <View
        {...pan.panHandlers}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          const clamped = Math.max(sc(PANEL_COLLAPSED_MIN_H), Math.min(sc(PANEL_COLLAPSED_MAX_H), h));
          if (clamped !== collapsedH) setCollapsedH(clamped);
          if (clamped !== reportedH.current) {
            reportedH.current = clamped;
            onCollapsedHeight(clamped);
          }
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Room standings and chat"
          accessibilityState={{ expanded: open }}
          accessibilityHint={
            open ? 'Double tap to collapse and return to the timer' : 'Double tap to show players, chat and your history'
          }
          onPress={() => setOpen(!open)}
          style={{ height: HANDLE_H, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: p.border }} />
        </Pressable>

        {/* Row A: am I waiting on anyone. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.md,
            paddingBottom: space.sm,
          }}
        >
          <StatusDot
            color={room.status === 'ACTIVE' ? (solvedCount === room.participants.length ? p.green : p.yellow) : p.textMuted}
          />
          <Text style={{ color: p.text, fontSize: sc(13), fontFamily: MONO_BOLD, flex: 1 }} numberOfLines={1}>
            {room.status === 'ACTIVE'
              ? `${solvedCount} of ${room.participants.length} solved`
              : room.participants.length < 2
                ? 'Waiting for players'
                : 'Next round shortly'}
          </Text>
          {/* Where the figures row goes at the tightest tier, points is the one
              that has to survive: it is the score. */}
          {density === 'minimal' && me ? (
            <Text style={{ color: p.accent, fontSize: sc(13), fontFamily: MONO_BOLD }}>
              {me.points} pts
            </Text>
          ) : null}
          {unreadHint && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="list" size={13} color={p.textMuted} />
              <Text style={{ color: p.textMuted, fontSize: sc(12), fontFamily: MONO }}>{chatMessages.length}</Text>
            </View>
          )}
        </View>

        {/* Row B: where am I. The Timer's panel uses three figures here, and
            these are the three that mean something in a room.

            Dropped at the tightest tier, where the room column has already
            spent everything it has on the scramble and the timer. Measured, not
            guessed: with this row present, an iPhone SE showing a megaminx or
            square-1 scramble overflowed the column, and on a screen that does
            not scroll that puts the bottom of it out of reach. Row A absorbs the
            points when that happens, so nothing is actually lost, which is what
            makes this a fair thing to drop rather than a compromise. */}
        {density !== 'minimal' && (
          <>
            <Divider />
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                columnGap: space.md,
              }}
            >
              <Figure label="rank" value={me ? `${myIndex + 1} of ${standings.length}` : EMPTY} />
              <Figure label="points" value={me ? String(me.points) : EMPTY} accent />
              <Figure
                label="best"
                value={myStats.best !== null ? formatTime(myStats.best, 'NONE', solvePrecision) : EMPTY}
              />
            </View>
          </>
        )}
      </View>

      <Divider />

      {/* Body. `flex: 1` works only because the panel has a definite height
          (expandedH, from the measured column). Made auto-height "to hug its
          content" this silently becomes zero tall: HANDOFF trap 2. */}
      <View style={{ flex: 1 }} pointerEvents={open ? 'auto' : 'none'}>
        {everOpened && (
          <View style={{ flex: 1 }}>
            <View style={{ padding: space.md, paddingBottom: space.sm }}>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'players', label: 'Players' },
                  { value: 'chat', label: chatMessages.length ? `Chat (${chatMessages.length})` : 'Chat' },
                  { value: 'history', label: 'You' },
                ]}
              />
            </View>

            {/* Every tab's list needs `flex: 1`, and it is load bearing rather
                than cosmetic: a ScrollView with no flex in a column container
                sizes to its content, so it has no bounded viewport and does not
                scroll, it just overflows and is clipped. A full room is ten
                players, which is past the panel's height. */}
            {tab === 'players' && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.lg }}
                scrollEnabled={open}
              >
                {standings.length === 0 ? (
                  <Muted>No players yet</Muted>
                ) : (
                  standings.map((participant, i) => {
                    const st = statusOf(participant);
                    const isMe = participant.id === myParticipantId;
                    return (
                      <View
                        key={participant.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: space.sm,
                          paddingVertical: 9,
                          paddingHorizontal: space.sm,
                          borderRadius: radius.sm,
                          backgroundColor: isMe ? `${p.accent}1a` : 'transparent',
                        }}
                      >
                        <Text style={{ width: 22, textAlign: 'center', fontSize: 13, color: p.textMuted }}>
                          {MEDALS[i] ?? `${i + 1}.`}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            color: p.text,
                            fontSize: sc(14),
                            fontFamily: isMe ? MONO_BOLD : MONO,
                          }}
                        >
                          {participant.name}
                          {isMe ? ' (you)' : ''}
                        </Text>
                        {participant.isHost && <HostBadge />}
                        <Text
                          numberOfLines={1}
                          style={{
                            color: st.tone === 'done' ? p.green : p.textMuted,
                            fontSize: sc(12),
                            fontFamily: MONO,
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {st.label}
                        </Text>
                        <Text
                          style={{
                            color: p.accent,
                            fontSize: sc(13),
                            fontFamily: MONO_BOLD,
                            minWidth: 24,
                            textAlign: 'right',
                          }}
                        >
                          {participant.points}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            {tab === 'chat' && (
              <View style={{ flex: 1 }}>
                <ScrollView
                  ref={chatScrollRef}
                  // Also what leaves room for the input row below it, rather
                  // than growing past it as the log fills up.
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.sm, gap: 6 }}
                  scrollEnabled={open}
                >
                  {chatMessages.length === 0 ? (
                    <Muted>No messages yet. Say hi.</Muted>
                  ) : (
                    chatMessages.map((m, i) => (
                      <Text key={`${m.sentAt}-${i}`} style={{ fontSize: sc(13), lineHeight: sc(18) }}>
                        <Text
                          style={{
                            color: m.participantId === myParticipantId ? p.accent : p.text,
                            fontFamily: MONO_BOLD,
                          }}
                        >
                          {m.name}:{' '}
                        </Text>
                        <Text style={{ color: p.textMuted }}>{m.message}</Text>
                      </Text>
                    ))
                  )}
                </ScrollView>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    paddingHorizontal: space.md,
                    paddingTop: space.sm,
                    paddingBottom: space.md,
                    borderTopWidth: stroke.hairline,
                    borderTopColor: p.border,
                  }}
                >
                  <Input
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Say something…"
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={send}
                    blurOnSubmit={false}
                    style={{ flex: 1, paddingVertical: 8 }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    onPress={send}
                    disabled={!chatInput.trim()}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      opacity: !chatInput.trim() ? 0.35 : pressed ? 0.6 : 1,
                      padding: 6,
                    })}
                  >
                    <Icon name="arrowRight" size={20} color={p.accent} />
                  </Pressable>
                </View>
              </View>
            )}

            {tab === 'history' && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.lg, gap: space.md }}
                scrollEnabled={open}
              >
                <View style={{ flexDirection: 'row', columnGap: space.md }}>
                  <Figure label="rounds" value={String(myStats.rounds)} />
                  <Figure label="wins" value={String(myStats.wins)} />
                  <Figure
                    label="mean"
                    value={myStats.avg !== null ? formatTime(myStats.avg, 'NONE', solvePrecision) : EMPTY}
                  />
                </View>

                <View style={{ gap: space.xs }}>
                  <Label>Round history</Label>
                  {myHistory.length === 0 ? (
                    <Muted>Nothing yet. Your finished rounds land here.</Muted>
                  ) : (
                    [...myHistory].reverse().map((s, i) => (
                      <View
                        key={`${i}-${s.time ?? 'dnf'}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 5 }}
                      >
                        <Text style={{ width: 26, textAlign: 'right', color: p.textMuted, fontSize: 12, fontFamily: MONO }}>
                          {myHistory.length - i}.
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            color: s.penalty === 'DNF' ? p.red : p.text,
                            fontSize: sc(13),
                            fontFamily: MONO,
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {fmt(s.time, s.penalty, s.plusTwoCount)}
                        </Text>
                        <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: MONO }}>
                          {s.rank === 1 ? MEDALS[0] : `#${s.rank}`}
                        </Text>
                        <Text
                          style={{
                            color: s.pointsEarned > 0 ? p.green : p.textMuted,
                            fontSize: 12,
                            fontFamily: MONO_BOLD,
                            minWidth: 26,
                            textAlign: 'right',
                          }}
                        >
                          +{s.pointsEarned}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
});

function StatusDot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

function HostBadge() {
  const p = usePalette();
  return (
    <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: `${p.accent}33` }}>
      <Text style={{ color: p.accent, fontSize: 9, fontFamily: MONO_BOLD, letterSpacing: 0.5 }}>HOST</Text>
    </View>
  );
}

/** One figure in the collapsed strip, matching the Timer panel's own. */
function Figure({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const p = usePalette();
  const { s: sc, maxFontMultiplier } = useScreenScale();
  return (
    <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
      <ColumnLabel>{label}</ColumnLabel>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={maxFontMultiplier}
        style={{
          color: accent ? p.accent : p.text,
          fontFamily: MONO_BOLD,
          fontSize: Math.max(13, sc(17)),
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}
