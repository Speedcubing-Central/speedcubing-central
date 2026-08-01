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
// ── Where the drag is picked up ────────────────────────────────────────────
//
// The whole panel, not the handle. It was the handle alone at first, because
// several of these sheets contain a ScrollView and a panel-wide responder races
// the list for every vertical touch. But that made the sheets read as stuck:
// the drag worked, on a strip most of a finger wide, and everywhere else the
// gesture did nothing.
//
// The race is settled by asking the list where it is rather than by staying off
// it. A sheet whose content scrolls reports whether it is scrolled to the top
// (see useSheetScrollProps), and the panel only claims a drag that starts there
// and goes down. Anywhere else in that list, a vertical drag is scrolling and is
// left alone. A sheet with no scrolling content registers nothing, and every
// vertical drag on it is the sheet's.
//
// The handle keeps its own responder, which claims unconditionally. That is what
// gets you out of a sheet scrolled halfway down a long list, where the rule
// above deliberately gives the gesture to the list.
//
// This mirrors the Timer's stats panel: the responder is taken on *movement*
// only, never on touch-down, so every button inside the drag surface still takes
// a tap normally.
//
// Built on RN's own Animated + PanResponder rather than Reanimated/
// gesture-handler: neither is set up in this app (gesture-handler is installed
// but has no GestureHandlerRootView, and Reanimated isn't installed at all), and
// a single-axis drag doesn't need either. No new native dependency.

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

function travelFor(dy: number): number {
  return dy >= 0 ? dy : dy * UPWARD_RESISTANCE;
}

// How a scrolling sheet tells its Sheet where the scroll is.
interface SheetScrollReporter {
  register: () => () => void;
  setAtTop: (atTop: boolean) => void;
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
  useEffect(() => reporter?.register(), [reporter]);
  return useMemo(
    () => ({
      scrollEventThrottle: 16,
      bounces: false,
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        reporter?.setAtTop(e.nativeEvent.contentOffset.y <= 0);
      },
    }),
    [reporter],
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
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(screenHeight);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 26,
          stiffness: 260,
          mass: 0.9,
        }),
        Animated.timing(backdrop, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      return;
    }
    // `visible` is the single source of truth for open/closed: every dismissal
    // path (backdrop tap, drag release, a parent closing it) just flips it and
    // lands here, so there's only one exit animation to reason about. A drag
    // release animates from wherever the finger left the panel, not from 0.
    Animated.parallel([
      Animated.timing(translateY, { toValue: screenHeight, duration: 200, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
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
  const scrollersRef = useRef(0);
  const atTopRef = useRef(true);
  const reporter = useMemo<SheetScrollReporter>(
    () => ({
      register: () => {
        scrollersRef.current += 1;
        atTopRef.current = true;
        return () => {
          scrollersRef.current -= 1;
        };
      },
      setAtTop: (atTop: boolean) => {
        atTopRef.current = atTop;
      },
    }),
    [],
  );

  // One set of drag handlers, given to two responders that differ only in when
  // they are willing to take the gesture.
  const makeResponder = useCallback(
    (claims: (g: PanResponderGestureState) => boolean) =>
      PanResponder.create({
        // Never on touch-down, so a tap anywhere inside the drag surface is
        // still a tap: these sheets are full of buttons.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dy) > 2 && Math.abs(g.dy) > Math.abs(g.dx) && claims(g),
        onPanResponderMove: (_e, g) => {
          translateY.setValue(travelFor(g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            onClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 30,
            stiffness: 300,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
        // Never hand the gesture back mid-drag, so a list underneath the finger
        // cannot take over a drag that has already started moving the sheet.
        onPanResponderTerminationRequest: () => false,
      }),
    [translateY, onClose],
  );

  // The panel. Yields to a list that has somewhere to scroll; owns everything
  // else, including the upward drag that only springs back.
  const panelPan = useMemo(
    () => makeResponder((g) => scrollersRef.current === 0 || (atTopRef.current && g.dy > 0)),
    [makeResponder],
  );
  // The handle. Always the sheet's, which is what makes a sheet scrolled halfway
  // down a long list still dismissable by drag.
  const handlePan = useMemo(() => makeResponder(() => true), [makeResponder]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: backdrop }]}>
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
            transform: [{ translateY }],
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
          <View {...handlePan.panHandlers} style={{ paddingTop: space.sm, paddingBottom: space.xs }}>
            <View style={{ alignItems: 'center', paddingVertical: space.xs }}>
              <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: p.border }} />
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
