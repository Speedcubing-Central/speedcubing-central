import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type FlatListProps,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PanResponderGestureState,
  type ScrollViewProps,
} from 'react-native';
import { usePalette } from '../store/settings';
import { font, radius, space } from '../theme';

// The one bottom sheet every popup in the app is built from.
//
// Exists because "tap the backdrop to close" was the only way out of the old
// sheets: the grabber bar was decorative, which is the opposite of what the
// handle affordance promises. Dragging dismisses now, which is what a phone user
// reaches for first.
//
// ── Where the drag is picked up, and why not everywhere ────────────────────
//
// Everywhere on a sheet that does not scroll. Only the header strip on one that
// does. That split is not a preference, it is the limit of what RN's own
// responder system can do, and it was established on a device rather than
// reasoned about:
//
//   * The responder claims correctly. Traced on a device: claimed on the first
//     try, granted, move handler running, correct values all the way down.
//   * A drag over a live ScrollView never gets that far. On iOS the scroll
//     view's own pan recogniser takes the touch before the JS responder system
//     votes, and no amount of capture-phase claiming outranks it. This is the
//     single reason gesture-handler exists.
//
// So the sheet stops fighting for a gesture it cannot win. Scrolling is switched
// off whenever the content fits (see useSheetScrollProps), which is most sheets
// most of the time, and those are draggable anywhere on the panel because there
// is no live scroll view left to compete. When the content genuinely scrolls,
// the header strip is the drag surface and the body scrolls.
//
// This is exactly how the Timer's stats panel works, which is why that one has
// always felt right: its drag surface is a band with nothing scrollable in it.
//
// The panel additionally declines any drag the list could use, so at the top of
// a scrollable list a downward drag still reaches the sheet.
//
// Both responders take the gesture on *movement* only, never on touch-down, so
// every button inside a drag surface still takes a tap normally.
//
// Built on RN's own Animated + PanResponder rather than Reanimated/
// gesture-handler: neither is set up in this app (gesture-handler is installed
// but has no GestureHandlerRootView, and Reanimated isn't installed at all).
// Wiring gesture-handler up is what it would take to drag a scrolling sheet by
// its body, and is the one remaining upgrade here.

// Read at module load, so it is whatever the screen was when the JS bundle first
// evaluated: wrong after a rotation, on an iPad split view, and on a foldable.
// It survives only as the value the animation starts from before the component
// has measured anything; every use that matters reads the live height below.
const INITIAL_SCREEN_HEIGHT = Dimensions.get('window').height;

// Past this much downward travel, release dismisses instead of springing back.
const DISMISS_DISTANCE = 110;
// Or past this flick speed, however far it actually moved, so a quick flick
// dismisses without needing the full distance.
const DISMISS_VELOCITY = 0.85;

// Upward drags move the sheet at a fraction of the finger and always spring
// back. A sheet is already as tall as its content or its height cap, so there is
// nothing above it to open into and it must not be draggable off the top of the
// screen. Following the finger a little anyway is the difference between "this
// does not move that way" and "this is as far as it goes", and it is the second
// one that is true.
const UPWARD_RESISTANCE = 0.22;

// How far a finger travels before a drag on the panel is a drag rather than a
// tap that wobbled. Claiming in the capture phase means this number is the only
// thing protecting the buttons underneath, so it is a real distance (about a
// millimetre and a half) rather than the 2 that reads as "any movement at all".
// UIScrollView uses a comparable threshold over tappable content for the same
// reason.
const PANEL_SLOP = 6;
// The handle has nothing on it to tap, so nothing to protect.
const HANDLE_SLOP = 2;

// Traces the drag negotiation into the Metro log. Off, but kept: it is what
// established that the responder claims correctly and the transform was the
// problem, and this component has no other way to be observed on a device.
const DRAG_TRACE = false;

// ── Why these animations are JS driven ─────────────────────────────────────
//
// Measured, not assumed. With the native driver the drag was claimed on the
// first try, granted, and fed setValue all the way to a 440pt gesture, and the
// panel did not move a pixel: the responder was never the problem, the transform
// was. The Timer's stats panel does the same thing with the native driver and
// works, and the one difference between them is that this lives inside a Modal,
// which on the New Architecture hosts its children in a separate surface.
//
// A sheet drag is one transform on one view while nothing else is happening, so
// the JS thread drives it comfortably. Every animation of these two values has
// to agree: an Animated.Value that has once been driven natively throws if a JS
// driven animation is later started on it.

function travelFor(dy: number): number {
  return dy >= 0 ? dy : dy * UPWARD_RESISTANCE;
}

// How a scrolling sheet tells its Sheet where the scroll is.
interface SheetScrollReporter {
  register: () => () => void;
  setAtTop: (atTop: boolean) => void;
  /** Whether the content is actually taller than the viewport. */
  setScrollable: (scrollable: boolean) => void;
}

const SheetScrollContext = createContext<SheetScrollReporter | null>(null);

// Reports scroll position up to the enclosing Sheet.
//
// A hook the caller could spread onto its own list would be simpler to use, but
// it cannot work: `children` are built in the *parent's* render scope, above the
// provider, so a hook called there reads no context at all. Only a component
// rendered inside the sheet can. Hence the two wrappers below.
//
// `bounces: false` is part of the deal, not a style preference: an iOS list that
// rubber-bands at the top is competing for the exact gesture the sheet is
// waiting for there.
function useSheetScrollProps() {
  const reporter = useContext(SheetScrollContext);
  const viewportH = useRef(0);
  const contentH = useRef(0);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => reporter?.register(), [reporter]);

  // A list shorter than its viewport has nothing to scroll, and a scroll view
  // with scrolling switched off is not a scroll view as far as the touch system
  // is concerned: its pan recogniser stops competing and the whole panel becomes
  // draggable. This is what makes short sheets (a solve with no comment, the
  // timer menu) draggable everywhere rather than by the handle alone.
  const sync = useCallback(() => {
    const next = contentH.current > viewportH.current + 1;
    setScrollable(next);
    reporter?.setScrollable(next);
  }, [reporter]);

  return useMemo(
    () => ({
      scrollEnabled: scrollable,
      scrollEventThrottle: 16,
      bounces: false,
      onLayout: (e: LayoutChangeEvent) => {
        viewportH.current = e.nativeEvent.layout.height;
        sync();
      },
      onContentSizeChange: (_w: number, h: number) => {
        contentH.current = h;
        sync();
      },
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        reporter?.setAtTop(e.nativeEvent.contentOffset.y <= 0);
      },
    }),
    [reporter, scrollable, sync],
  );
}

/**
 * The ScrollView to use inside a Sheet. A plain one still scrolls, but the sheet
 * around it can then only be dragged by its handle, because it has no way to
 * tell a scroll from a drag.
 */
export function SheetScrollView(props: ScrollViewProps) {
  const scroll = useSheetScrollProps();
  return <ScrollView {...props} {...scroll} />;
}

/** The FlatList counterpart of SheetScrollView. */
export function SheetFlatList<ItemT>(props: FlatListProps<ItemT>) {
  const scroll = useSheetScrollProps();
  return <FlatList {...props} {...scroll} />;
}

export function Sheet({
  visible,
  onClose,
  title,
  children,
  headerRight,
  maxHeightRatio = 0.85,
  // Set when the body is its own ScrollView: the sheet then fills its max height
  // instead of hugging content, so the list has a stable viewport to scroll in.
  fillHeight = false,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  headerRight?: ReactNode;
  maxHeightRatio?: number;
  fillHeight?: boolean;
}) {
  const p = usePalette();
  // Live, so a sheet opened after a rotation slides the right distance and caps
  // at the right height.
  const { height: screenHeight } = useWindowDimensions();
  // Kept mounted through the exit animation so the panel can slide out rather
  // than vanishing the instant `visible` flips.
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(INITIAL_SCREEN_HEIGHT)).current;
  // Where the finger has the panel, or null when no finger is on it.
  //
  // The drag is driven by React state and the enter/exit animations by
  // `translateY`, and the transform below picks whichever is in charge. That
  // split exists because an Animated value driven from a gesture was measured
  // not to move this view at all: the responder was claiming, the move handler
  // was running, setValue was receiving correct numbers, and the panel stayed
  // put. A plain style prop cannot fail that way, because there is no separate
  // animation pipeline for it to be lost in.
  //
  // The cost is a render per frame of the drag, and it is smaller than it
  // sounds: `children` is the same element object across these renders, so
  // React bails out of the sheet's whole body and only the shell re-renders.
  const [dragY, setDragY] = useState<number | null>(null);
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(screenHeight);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: false,
          damping: 26,
          stiffness: 260,
          mass: 0.9,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: false }),
      ]).start();
      return;
    }
    // `visible` is the single source of truth for open/closed: every dismissal
    // path (backdrop tap, drag release, a parent closing it) just flips it and
    // lands here, so there's only one exit animation to reason about. A drag
    // release animates from wherever the finger left the panel, not from 0.
    Animated.parallel([
      Animated.timing(translateY, { toValue: screenHeight, duration: 200, useNativeDriver: false }),
      Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    // `mounted` is deliberately not a dependency: including it would re-run the
    // exit animation when it flips false at the end of that very animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Whether the sheet's content scrolls, and if so whether it is at the top.
  // Refs, not state: the responder callbacks read these on every touch and must
  // see the current value without the component re-rendering to get it.
  const scrollableRef = useRef(false);
  const atTopRef = useRef(true);
  const reporter = useMemo<SheetScrollReporter>(
    () => ({
      register: () => {
        atTopRef.current = true;
        return () => {
          scrollableRef.current = false;
        };
      },
      setAtTop: (atTop: boolean) => {
        atTopRef.current = atTop;
      },
      setScrollable: (scrollable: boolean) => {
        scrollableRef.current = scrollable;
      },
    }),
    [],
  );

  // One set of drag handlers, given to two responders that differ only in when
  // they are willing to take the gesture.
  const makeResponder = useCallback(
    (who: string, slop: number, claims: (g: PanResponderGestureState) => boolean) => {
      const wants = (g: PanResponderGestureState) =>
        Math.abs(g.dy) > slop && Math.abs(g.dy) > Math.abs(g.dx) && claims(g);
      // TEMPORARY. Traces one gesture per touch into the Metro log so the drag
      // can be diagnosed without a debugger attached. Remove with DRAG_TRACE.
      let traced = false;
      let moved = false;
      const trace = (msg: string) => {
        if (DRAG_TRACE) console.log(`[sheet:${who}] ${msg}`);
      };
      return PanResponder.create({
        // Never on touch-down, so a tap anywhere inside the drag surface is
        // still a tap: these sheets are full of buttons.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => {
          traced = false;
          return false;
        },
        // Claimed on the way DOWN the tree, not on the way back up.
        //
        // This is what the first version got wrong, and why dragging a sheet
        // took several tries. A bubbled claim only lands if whatever is already
        // holding the touch agrees to give it up. A Pressable does agree, which
        // is why the Timer's stats panel works without this: its drag strip has
        // nothing else in it. A native ScrollView does not, and three of these
        // sheets are a ScrollView filling the whole panel, so the drag was
        // landing only when a finger happened to start somewhere the list
        // wasn't. Capture asks the ancestor first and takes the gesture
        // outright.
        //
        // Safe precisely because `claims` is narrow: for a scrolling sheet it is
        // true only at the top of the list and only downward, which is the one
        // gesture the list has no use for. Everything else still reaches it.
        onMoveShouldSetPanResponderCapture: (_e, g) => {
          const ok = wants(g);
          if (!traced && (ok || Math.abs(g.dy) > 14)) {
            traced = true;
            trace(
              `capture dy=${g.dy.toFixed(0)} dx=${g.dx.toFixed(0)} scrollable=${scrollableRef.current} atTop=${atTopRef.current} claim=${ok}`,
            );
          }
          return ok;
        },
        onMoveShouldSetPanResponder: (_e, g) => wants(g),
        onPanResponderGrant: () => {
          moved = false;
          trace('granted');
        },
        onPanResponderMove: (_e, g) => {
          const to = travelFor(g.dy);
          setDragY(to);
          if (!moved) {
            moved = true;
            trace(`first move -> dragY=${to.toFixed(0)}`);
          }
        },
        onPanResponderRelease: (_e, g) => {
          trace(`release dy=${g.dy.toFixed(0)} vy=${g.vy.toFixed(2)}`);
          // Hand the position back to the Animated value at exactly where the
          // finger left it, then stop driving from state. Both happen before
          // anything animates, so the switch of who owns the transform is not a
          // frame where the panel jumps.
          translateY.setValue(travelFor(g.dy));
          setDragY(null);
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            onClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: false,
            damping: 30,
            stiffness: 300,
          }).start();
        },
        onPanResponderTerminate: (_e, g) => {
          trace('TERMINATED mid-drag');
          translateY.setValue(travelFor(g.dy));
          setDragY(null);
          Animated.spring(translateY, { toValue: 0, useNativeDriver: false }).start();
        },
        // Never hand the gesture back mid-drag, so a list underneath the finger
        // cannot take over a drag that has already started moving the sheet.
        onPanResponderTerminationRequest: () => false,
      });
    },
    [translateY, onClose, setDragY],
  );

  // The panel. Yields to a list that has somewhere to scroll; owns everything
  // else, including the upward drag that only springs back.
  const panelPan = useMemo(
    () =>
      makeResponder(
        'panel',
        PANEL_SLOP,
        (g) => !scrollableRef.current || (atTopRef.current && g.dy > 0),
      ),
    [makeResponder],
  );
  // The handle. Always the sheet's, which is what makes a sheet scrolled halfway
  // down a long list still dismissable by drag. Finer slop because there is
  // nothing on it to tap, so there is no tap to protect.
  const handlePan = useMemo(() => makeResponder('handle', HANDLE_SLOP, () => true), [makeResponder]);
  // The dimmed area above the sheet, which also drags it.
  //
  // Aiming at the grabber does not reliably hit it: it sits 12pt below the
  // panel's edge and a fingertip covers rather more than that, so a good half of
  // the attempts land above the sheet entirely. That used to be a tap, and a tap
  // there dismisses, so "drag the handle" produced "the sheet vanished when I let
  // go" often enough to read as the handle not working at all.
  //
  // Rather than defend a 5pt target, the miss is made harmless: a drag that
  // starts anywhere above the sheet moves the sheet. A tap still dismisses,
  // because this only claims on movement.
  const backdropPan = useMemo(() => makeResponder('backdrop', PANEL_SLOP, () => true), [makeResponder]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          {...backdropPan.panHandlers}
          style={[StyleSheet.absoluteFillObject, { opacity: backdrop }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000AA' }]}
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          {...panelPan.panHandlers}
          style={{
            transform: [{ translateY: dragY ?? translateY }],
            maxHeight: screenHeight * maxHeightRatio,
            height: fillHeight ? screenHeight * maxHeightRatio : undefined,
            backgroundColor: p.card,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: p.border,
            overflow: 'hidden',
          }}
        >
          {/* The drag handle. Padding here is load-bearing: it's the gesture
              target, so it needs real height, not just a 4px bar. Its own
              responder sits deeper in the tree than the panel's, so it is asked
              first and wins, which is how it can claim what the panel won't. */}
          <View
            {...handlePan.panHandlers}
            // A generous strip, because on a sheet whose content scrolls this is
            // the only place the drag can live (see the note at the top). The
            // Timer's stats panel works the same way and for the same reason:
            // its drag surface is a band with nothing scrollable in it.
            style={{ paddingTop: space.md, paddingBottom: space.sm }}
          >
            <View style={{ alignItems: 'center', paddingVertical: space.xs }}>
              {/* Lights up while a finger owns the panel. Started as a debug
                  readout and earned its place: it is the only feedback that
                  the handle did take the gesture, on a control whose whole job
                  is to be grabbed. */}
              <View
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: dragY !== null ? p.accent : p.border,
                }}
              />
            </View>
            {title ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: space.lg,
                  paddingTop: space.xs,
                  paddingBottom: space.sm,
                  gap: space.sm,
                }}
              >
                <Text style={{ color: p.text, fontSize: 18, fontFamily: font.sansBlack, flexShrink: 1 }}>
                  {title}
                </Text>
                {headerRight}
              </View>
            ) : null}
          </View>

          <SheetScrollContext.Provider value={reporter}>
            <View style={{ flex: fillHeight ? 1 : undefined, paddingHorizontal: space.lg }}>{children}</View>
          </SheetScrollContext.Provider>
          <View style={{ height: space.xl }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
