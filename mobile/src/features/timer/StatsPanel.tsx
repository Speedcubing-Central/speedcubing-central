import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  bestSingleIndex,
  currentAverage,
  formatMoveCount,
  formatTime,
  makeAverageView,
  sortedSolveIndices,
  TIMER_ONLY_EVENT_IDS,
  type Penalty,
  type SolveAverage,
  type SolveDTO,
  type SolveSortBy,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { useScreenScale } from '../../lib/scale';
import {
  ColumnLabel,
  Divider,
  EMPTY,
  Label,
  MONO_BOLD,
  Muted,
  Segmented,
  TextButton,
} from '../../components/ui';
import { PenaltyRow } from './PenaltyRow';
import { StatRows } from './StatRows';
import { SolvesList, SolvesColumnHeader } from './SolvesList';
import { motion, radius, space, stroke } from '../../theme';

// ── The Timer's stats panel ───────────────────────────────────────────────
//
// Collapsed, it is the strip you glance at between attempts: the solve you just
// did with the buttons that fix it, then the scramble image beside Ao5, Ao12 and
// best. Dragged up, it becomes the full statistics and the whole solves list
// without leaving the Timer.
//
// Conceptually this is the web layout's right-hand column brought back within
// thumb reach. On desktop the stats table and solves list live permanently
// beside the timer; a phone cannot afford that, so they became pushed screens,
// and the cost was that checking your ao12 meant leaving the thing you were
// using. The panel gives the glance back and keeps the pushed screens for
// actually browsing.
//
// ── Why it is absolutely positioned ──
//
// The previous footer was a flex sibling competing with the timer for column
// height, and essentially all of this file's trap history (see HANDOFF section
// 3) came from that competition: flex shares on the wrong node, floors to stop
// shrink-to-nothing, a stats row that could be squeezed off screen entirely.
//
// This panel is out of the flex flow completely. The column reserves its
// collapsed height with a plain spacer and the panel draws over that rectangle,
// so the column is left with exactly one flexible child (the timer) and the
// whole class of bug goes away. The price is one number that has to be measured
// rather than assumed, which is `collapsedH` below.
//
// ── Why Animated + PanResponder ──
//
// Same reason Sheet.tsx gives: gesture-handler is installed but has no
// GestureHandlerRootView, and Reanimated is not installed at all. Adding either
// would mean wrapping the app root and re-verifying every Pressable's hit
// behaviour app-wide, on an Expo SDK pinned to 54 for Expo Go compatibility.
// A single-axis clamped drag does not need any of that: only a transform is
// animated, so this runs on the native thread and never touches JS per frame,
// which matters on a screen whose entire job is timing.

const HANDLE_H = 22;
// Floors for the two strip rows. React Native leaves flexShrink at 0, so these
// are what stop a long scramble's knock-on effects from squeezing the strip's
// contents to nothing (trap 3).
const SUMMARY_PENALTY_ROW_MIN_H = 48;
// The scramble image used to sit in this row, which is why it was 66. It has
// moved up to the scramble zone, where it belongs: it answers "is my cube
// scrambled right", which is a question about the scramble, not about how the
// session is going. Filing it beside ao5/ao12/best is what made a 50pt box look
// defensible, and 50pt is 2.4pt per sticker on a 7x7.
//
// The three figures get the whole strip width back as a result.
const SUMMARY_STATS_ROW_MIN_H = 52;
// Clamp on the measured collapsed height. Not a size, a safety net: at an
// extreme OS font scale the strip could otherwise grow until the timer had
// nothing left.
const PANEL_COLLAPSED_MIN_H = 72;
const PANEL_COLLAPSED_MAX_H = 180;
// The timer is never fully covered, so it always reads as the screen you are on.
const MIN_TIMER_VISIBLE_H = 120;
// Shorter than Sheet's 110 because `travel` here is a fraction of a screen.
const PANEL_TOGGLE_DISTANCE = 64;
const PANEL_TOGGLE_VELOCITY = 0.7;

export interface StatsPanelProps {
  solves: SolveDTO[];
  event: string;
  /** The measured height of the Timer column, never the window height. */
  columnH: number;
  /** True while an attempt is live: the panel force-collapses and goes inert. */
  immersive: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Feeds the spacer that reserves this panel's rectangle in the column. */
  onCollapsedHeight: (h: number) => void;
  onUpdatePenalty: (id: string, penalty: Penalty, plusTwoCount: number) => void;
  onDeleteSolves: (ids: string[]) => Promise<void> | void;
  onOpenAverage: (view: SolveAverage) => void;
  onOpenSolve: (index: number) => void;
  onOpenStatsScreen: () => void;
  onOpenSolvesScreen: () => void;
}

export function StatsPanel({
  solves,
  event,
  columnH,
  immersive,
  open,
  onOpenChange,
  onCollapsedHeight,
  onUpdatePenalty,
  onDeleteSolves,
  onOpenAverage,
  onOpenSolve,
  onOpenStatsScreen,
  onOpenSolvesScreen,
}: StatsPanelProps) {
  const p = usePalette();
  const { s: sc } = useScreenScale();
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);

  const [collapsedH, setCollapsedH] = useState(sc(PANEL_COLLAPSED_MIN_H));
  // The body is not built until the panel has been opened once, so the Timer's
  // steady-state render cost is unchanged. After that it stays mounted, so
  // reopening is instant and the solves list keeps its scroll position.
  const [everOpened, setEverOpened] = useState(false);
  const [sortBy, setSortBy] = useState<SolveSortBy>('date');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const reduceMotion = useRef(false);

  const expandedH = Math.max(
    sc(PANEL_COLLAPSED_MIN_H),
    Math.min(columnH - sc(MIN_TIMER_VISIBLE_H), columnH * 0.82),
  );
  const travel = Math.max(0, expandedH - collapsedH);

  const offset = useRef(new Animated.Value(0)).current;
  // 1 while the panel is on screen, 0 while an attempt is live. Animated
  // rather than switched so it leaves on the same clock as the tab bar.
  const chrome = useRef(new Animated.Value(immersive ? 0 : 1)).current;
  const openRef = useRef(open);
  const travelRef = useRef(travel);
  const dragFrom = useRef(0);
  // Set while the panel is being closed by something other than the finger (an
  // attempt starting). Short-circuits every gesture handler so a thumb still on
  // the glass cannot fight the forced collapse.
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
        // Identical to Sheet's entry spring, so the two bottom surfaces in this
        // app move the same way.
        damping: 26,
        stiffness: 260,
        mass: 0.9,
      }).start();
    },
    [offset],
  );

  // `travel` changes when the column is measured, the strip is measured, or a
  // penalty row appears. A collapsed panel has to follow it or it detaches from
  // the bottom of the screen.
  useEffect(() => {
    travelRef.current = travel;
    if (!openRef.current) offset.setValue(travel);
  }, [travel, offset]);

  // An attempt is starting: get out of the way, and stay out.
  //
  // The fade and the slide run together, on the same clock as the tab bar (see
  // `motion` in theme.ts). This used to cut the opacity instantly while sliding
  // over 160ms, and the bar took a different duration again, so three things at
  // the bottom of the screen each left differently.
  //
  // Only the fade is reversed on the way back. The slide is not: the panel
  // should return collapsed, which is where it already is.
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

  // Coming back from Sessions or Statistics should land on the timer, not on a
  // panel left open three screens ago.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (openRef.current) {
          onOpenChange(false);
          offset.setValue(travelRef.current);
        }
      };
    }, [onOpenChange, offset]),
  );

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
        // False, so a tap is never intercepted: the penalty buttons and the
        // three figures live inside the drag region and must stay pressable.
        // The responder is only taken once the finger has actually moved, which
        // is what lets the whole strip be the drag surface.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          !forcedRef.current && Math.abs(g.dy) > 2 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          dragFrom.current = openRef.current ? 0 : travelRef.current;
          setEverOpened(true);
        },
        onPanResponderMove: (_e, g) => {
          if (forcedRef.current) return;
          const next = Math.max(0, Math.min(travelRef.current, dragFrom.current + g.dy));
          offset.setValue(next);
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
        // Never hand the gesture on mid-drag. This is also what guarantees a
        // drag that travels up over the timer cannot reach the timer's own
        // Pressable and start a solve.
        onPanResponderTerminationRequest: () => false,
      }),
    [offset, onOpenChange, settleTo],
  );

  const newest = solves[0];

  const figures = useMemo(() => {
    const bestIdx = bestSingleIndex(solves);
    return {
      ao5: currentAverage(solves, 5),
      ao12: currentAverage(solves, 12),
      best: bestIdx === null ? null : solves[bestIdx],
      bestIdx,
    };
  }, [solves]);

  const order = useMemo(() => sortedSolveIndices(solves, sortBy), [solves, sortBy]);

  const fmtAvg = (v: number | null): string => {
    if (v === null) return EMPTY;
    if (!isFinite(v)) return 'DNF';
    return isFmc ? formatMoveCount(v, 'NONE', 2) : formatTime(Math.round(v), 'NONE', solvePrecision);
  };

  const fmtSolve = (s: SolveDTO): string =>
    isFmc
      ? formatMoveCount(s.time, s.penalty, 0, s.plusTwoCount)
      : formatTime(s.time, s.penalty, solvePrecision, s.plusTwoCount);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  function confirmBulkDelete() {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(`Delete ${count} solve${count === 1 ? '' : 's'}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onDeleteSolves(Array.from(selectedIds));
          exitSelectMode();
        },
      },
    ]);
  }

  return (
    <Animated.View
      // pointerEvents rather than unmounting, so an attempt starting mid-drag
      // makes RN terminate the live responder (whose handler is already inert
      // under forcedRef). Belt and braces: this is the one failure mode that
      // would corrupt a real attempt.
      pointerEvents={immersive ? 'none' : 'auto'}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: expandedH,
        transform: [{ translateY: offset }],
        backgroundColor: p.card,
        borderTopWidth: stroke.thin,
        borderTopColor: p.border,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        opacity: chrome,
        overflow: 'hidden',
      }}
    >
      {/* Everything above the body is the drag surface. A grabber alone is a
          4mm target; the whole strip is a comfortable one, and it keeps the
          bottom-of-card muscle memory working even though the grabber itself
          has to sit at the top (where it is still visible once expanded). */}
      <View
        {...pan.panHandlers}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          const clamped = Math.max(sc(PANEL_COLLAPSED_MIN_H), Math.min(sc(PANEL_COLLAPSED_MAX_H), h));
          if (clamped !== collapsedH) {
            setCollapsedH(clamped);
            onCollapsedHeight(clamped);
          }
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Session statistics"
          accessibilityState={{ expanded: open }}
          accessibilityHint={
            open
              ? 'Double tap to collapse and return to the timer'
              : 'Double tap to show full statistics and your solves'
          }
          accessibilityActions={[{ name: 'expand' }, { name: 'collapse' }]}
          onAccessibilityAction={(e) => setOpen(e.nativeEvent.actionName === 'expand')}
          onPress={() => setOpen(!open)}
          style={{ height: HANDLE_H, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: p.border }} />
        </Pressable>

        {/* The result and the buttons that act on it, on one line: the time
            sits beside the controls that change it rather than the controls
            floating with no subject. */}
        {newest && (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                minHeight: sc(SUMMARY_PENALTY_ROW_MIN_H),
                paddingHorizontal: space.md,
                paddingBottom: space.sm,
              }}
            >
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={{
                  color: newest.penalty === 'DNF' ? p.red : p.text,
                  fontFamily: MONO_BOLD,
                  fontSize: sc(19),
                  fontVariant: ['tabular-nums'],
                }}
              >
                {fmtSolve(newest)}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <PenaltyRow
                  penalty={newest.penalty}
                  plusTwoCount={newest.plusTwoCount}
                  onChange={(pen, count) => onUpdatePenalty(newest.id, pen, count)}
                  hidePlusTwo={isFmc}
                />
              </View>
            </View>
            <Divider />
          </>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            minHeight: sc(SUMMARY_STATS_ROW_MIN_H),
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
          }}
        >
          {/* Three figures, not six. Six took as much height as the timer, so
              the screen read as two equal halves and nothing looked important.
              Ao100, mean and the solve count are session totals: they are a
              drag away now rather than a tap. */}
          <View style={{ flex: 1, flexDirection: 'row', columnGap: space.md }}>
            <Figure label="ao5" value={fmtAvg(figures.ao5)} onPress={() => onOpenCurrent(5)} />
            <Figure label="ao12" value={fmtAvg(figures.ao12)} onPress={() => onOpenCurrent(12)} />
            <Figure
              label="best"
              value={figures.best ? fmtSolve(figures.best) : EMPTY}
              onPress={figures.bestIdx !== null ? () => onOpenSolve(figures.bestIdx!) : undefined}
            />
          </View>
        </View>
      </View>

      <Divider />

      {/* Body. `flex: 1` works here only because the panel has a definite
          height (expandedH, from the measured column). If anyone ever makes the
          panel auto-height "to hug its content", this silently becomes zero
          tall: that is trap 2, and it is the exact bug that once hid the
          scramble image and the stats entirely. */}
      <View style={{ flex: 1 }} pointerEvents={open ? 'auto' : 'none'}>
        {everOpened && (
          <SolvesList
            solves={solves}
            event={event}
            order={order}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleOne}
            onEnterSelectMode={() => setSelectMode(true)}
            onOpenSolve={onOpenSolve}
            onOpenAverage={onOpenAverage}
            scrollEnabled={open}
            pinnedHeader={false}
            ListHeaderComponent={
              <View>
                <View style={{ padding: space.md, gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Label>Statistics</Label>
                    <TextButton label="Open full statistics" onPress={onOpenStatsScreen} />
                  </View>
                  <StatRows
                    solves={solves}
                    event={event}
                    compact
                    onOpenAverage={onOpenAverage}
                    onOpenSolve={onOpenSolve}
                  />
                </View>

                <View style={{ paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Label>Solves ({solves.length})</Label>
                    {selectMode ? (
                      <TextButton label="Cancel" onPress={exitSelectMode} />
                    ) : (
                      <TextButton label="Open all solves" onPress={onOpenSolvesScreen} />
                    )}
                  </View>

                  {selectMode ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <Muted>{selectedIds.size} selected</Muted>
                      <View style={{ flex: 1 }} />
                      <TextButton
                        tone="danger"
                        label={`Delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                        onPress={confirmBulkDelete}
                        disabled={selectedIds.size === 0}
                      />
                    </View>
                  ) : (
                    <Segmented
                      value={sortBy}
                      onChange={setSortBy}
                      options={[
                        { value: 'date', label: 'Date' },
                        { value: 'single', label: 'Single' },
                        { value: 'ao5', label: 'Ao5' },
                        { value: 'ao12', label: 'Ao12' },
                      ]}
                    />
                  )}
                </View>

                <SolvesColumnHeader selectMode={selectMode} />
                <Divider />
              </View>
            }
          />
        )}
      </View>
    </Animated.View>
  );

  function onOpenCurrent(size: 5 | 12) {
    // The *current* rolling average of this size, i.e. the one ending on the
    // most recent solve, which is the figure the strip is showing.
    const view = makeAverageView(solves, 0, size);
    if (view) onOpenAverage(view);
  }
}

// One figure in the collapsed strip. Label above value, because a label beside a
// mono time needs about 100pt and three of those do not fit once the scramble
// image has taken its share of the row.
function Figure({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const p = usePalette();
  const { s: sc, maxFontMultiplier } = useScreenScale();
  const tappable = !!onPress && value !== EMPTY;
  const body = (
    <>
      <ColumnLabel>{label}</ColumnLabel>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={maxFontMultiplier}
        style={{
          color: tappable ? p.accent : p.text,
          fontFamily: MONO_BOLD,
          fontSize: Math.max(13, sc(17)),
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </>
  );
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
