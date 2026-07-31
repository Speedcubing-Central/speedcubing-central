import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { usePalette } from '../store/settings';
import { font, radius, space } from '../theme';

// The one bottom sheet every popup in the app is built from.
//
// Exists because "tap the backdrop to close" was the only way out of the old
// sheets: the grabber bar was decorative, which is the opposite of what the
// handle affordance promises. Dragging down on the bar now dismisses, which is
// what a phone user reaches for first.
//
// The pan is attached to the *handle region only* (grabber + title row), not the
// whole panel, and that is deliberate: several of these sheets contain a
// ScrollView, and a panel-wide responder would race the list for every vertical
// touch. A tall, generous handle area gets the gesture without ever competing
// with content scrolling.
//
// Built on RN's own Animated + PanResponder rather than Reanimated/
// gesture-handler: neither is set up in this app (gesture-handler is installed
// but has no GestureHandlerRootView, and Reanimated isn't installed at all), and
// a single-axis drag-to-dismiss doesn't need either. No new native dependency.

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

  const pan = useRef(
    PanResponder.create({
      // Claim only clearly-downward drags, so a tap on the header still reads as
      // a tap and an upward drag is left alone.
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 2 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        // Downward only. Dragging up shouldn't lift the sheet off its edge.
        if (g.dy > 0) translateY.setValue(g.dy);
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
    }),
  ).current;

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
              target, so it needs real height, not just a 4px bar. */}
          <View {...pan.panHandlers} style={{ paddingTop: space.sm, paddingBottom: space.xs }}>
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

          <View style={{ flex: fillHeight ? 1 : undefined, paddingHorizontal: space.lg }}>{children}</View>
          <View style={{ height: space.xl }} />
        </Animated.View>
      </View>
    </Modal>
  );
}
