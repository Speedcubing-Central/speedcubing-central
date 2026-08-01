import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../store/settings';
import { Icon, type IconName } from '../components/Icon';
import { useScreenScale } from '../lib/scale';
import { font, space } from '../theme';
import type { RootTabParamList } from './RootNavigator';

// The bottom bar, replacing the stock one from @react-navigation/bottom-tabs.
//
// Four destinations sit in the bar (Timer, Calculator, Algorithms, Settings) and
// four more (Battle, Relays, Reconstruction, Results) live behind the three-dot
// More button, which opens them as a second row directly above the bar rather
// than as a screen you navigate to. That is the whole reason this is hand-rolled:
// the stock bar can hide a tab, but it has nowhere to put one.
//
// Every glyph is the one the web sidebar uses for the same destination
// (client/src/components/Layout.tsx's NAV list), so a destination looks the same
// on both platforms. That includes Algorithms, which is the web's `cube` and was
// `brain` here.
type TabName = keyof RootTabParamList;

const PRIMARY: readonly TabName[] = ['Timer', 'Calculator', 'Algorithms', 'Settings'];
const OVERFLOW: readonly TabName[] = ['Battle', 'Relays', 'Reconstruction', 'Results'];

const TAB_ICON: Record<TabName, IconName> = {
  Timer: 'timer',
  Calculator: 'calculator',
  Algorithms: 'cube',
  Settings: 'gear',
  Battle: 'swords',
  Relays: 'skipForward',
  Reconstruction: 'film',
  Results: 'trophy',
};

// The stock bar's own row height (TABBAR_HEIGHT_UIKIT in
// @react-navigation/bottom-tabs, plus the bottom inset). Matched deliberately:
// the Timer column is laid out against whatever height is left over once the bar
// has taken its share (see HANDOFF's layout traps), so a taller bar here would
// quietly re-tune a screen that was measured against this number.
const ROW_HEIGHT = 49;

export function BottomBar({ state, navigation }: BottomTabBarProps) {
  const [expanded, setExpanded] = useState(false);

  const focusedName = state.routes[state.index]?.name as TabName | undefined;
  const overflowFocused = focusedName !== undefined && OVERFLOW.includes(focusedName);

  // The same sequence the stock bar runs, so a tab press behaves identically:
  // the event is emitted first and can be prevented (that is how a screen opts
  // out of a press, and how a stack pops to top when its own tab is pressed
  // again), and only an unprevented press on an unfocused tab navigates.
  const go = (name: TabName) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const isFocused = state.routes[state.index]?.key === route.key;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.dispatch({
        ...CommonActions.navigate({ name: route.name, merge: true }),
        target: state.key,
      });
    }
  };

  const select = (name: TabName) => {
    setExpanded(false);
    go(name);
  };

  const row = (
    <BarRow
      focusedName={focusedName}
      moreActive={expanded || overflowFocused}
      expanded={expanded}
      onSelect={select}
      onToggleMore={() => setExpanded((v) => !v)}
    />
  );

  return (
    <>
      {row}
      <MoreOverlay
        visible={expanded}
        focusedName={focusedName}
        onClose={() => setExpanded(false)}
        onSelect={select}
        // The bar is drawn again inside the overlay rather than left showing
        // through it. The overlay's backdrop covers the whole window, so the
        // real bar underneath would be both dimmed (breaking the illusion that
        // the extra row is part of it) and untappable (every press landing on
        // the backdrop instead). A second copy of the same component is lit,
        // live, and pixel-identical to the one it covers.
        bar={row}
      />
    </>
  );
}

function BarRow({
  focusedName,
  moreActive,
  expanded,
  onSelect,
  onToggleMore,
}: {
  focusedName: TabName | undefined;
  moreActive: boolean;
  expanded: boolean;
  onSelect: (name: TabName) => void;
  onToggleMore: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: p.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: p.border,
        // The inset as padding, not margin: the bar's colour has to run to the
        // bottom edge of the screen, with only the touch targets held above it.
        paddingBottom: insets.bottom,
        height: ROW_HEIGHT + insets.bottom,
      }}
    >
      {PRIMARY.map((name) => (
        <BarItem
          key={name}
          label={name}
          icon={TAB_ICON[name]}
          focused={focusedName === name}
          onPress={() => onSelect(name)}
        />
      ))}
      <BarItem
        label="More"
        icon="more"
        // Lit while one of its destinations is open, so the bar still answers
        // "where am I" once the row it was chosen from has closed.
        focused={moreActive}
        expanded={expanded}
        onPress={onToggleMore}
      />
    </View>
  );
}

function BarItem({
  label,
  icon,
  focused,
  expanded,
  onPress,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  /** Only the More button passes this; it reports the row, not a destination. */
  expanded?: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  const { maxFontMultiplier } = useScreenScale();
  const color = focused ? p.accent : p.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={expanded === undefined ? { selected: focused } : { expanded }}
      accessibilityLabel={expanded === undefined ? label : expanded ? 'More, showing' : 'More'}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={22} color={color} />
      <Text
        numberOfLines={1}
        // Width-only shrink, which is the axis actually in question: five columns
        // on a narrow phone leave "Reconstruction" and "Calculator" short of
        // room. Safe here in a way it isn't on a tile, because the row's height
        // is fixed and nothing below it can be pushed out of view (HANDOFF:
        // adjustsFontSizeToFit fits WIDTH only).
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={maxFontMultiplier}
        style={{ color, fontSize: 11, fontFamily: font.sansSemi, paddingHorizontal: 2 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// The extra row, plus a copy of the bar it grows out of.
//
// A Modal rather than a view positioned above the real bar, for two reasons. A
// child drawn outside its parent's bounds does not receive touches on Android,
// which is exactly what an overlay anchored to the bar's top edge would be. And
// growing the bar itself would shrink the scene above it, reflowing whatever
// screen is open: the Timer measures its column, so it would visibly re-lay-out
// every time this opened.
//
// Laid out as a column (backdrop, row, bar) rather than by absolute offsets, so
// the extra row lands on the bar by construction and there is no height to
// measure or keep in sync.
function MoreOverlay({
  visible,
  focusedName,
  onClose,
  onSelect,
  bar,
}: {
  visible: boolean;
  focusedName: TabName | undefined;
  onClose: () => void;
  onSelect: (name: TabName) => void;
  bar: ReactNode;
}) {
  const p = usePalette();
  // Kept mounted through the exit animation, the same way Sheet does it, so the
  // row slides away rather than vanishing the instant `visible` flips.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 24,
        stiffness: 280,
        mass: 0.8,
      }).start();
      return;
    }
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
    // `mounted` is deliberately not a dependency: it flips false at the end of
    // this very animation, and including it would restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const rowHeight = ROW_HEIGHT + space.xs;

  // Draggable shut, like every sheet in the app (components/Sheet.tsx). It slid
  // up, so it should answer a drag back down; being dismissable only by tapping
  // elsewhere is the thing the sheets were fixed for.
  //
  // Taken on movement only, so the four destinations inside it stay tappable,
  // and downward only, since it is already open as far as it goes.
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 2 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_e, g) => {
      if (g.dy > 0) anim.setValue(Math.max(0, 1 - g.dy / rowHeight));
    },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > rowHeight * 0.4 || g.vy > 0.7) {
        onClose();
        return;
      }
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 24, stiffness: 280 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }).start();
    },
    onPanResponderTerminationRequest: () => false,
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: anim }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close the More row"
            style={{ flex: 1, backgroundColor: '#000000AA' }}
            onPress={onClose}
          />
        </Animated.View>

        {/* Clips its own child, which is what makes this read as the bar
            extending rather than a panel landing on top of it. */}
        <View style={{ height: rowHeight, overflow: 'hidden' }}>
          <Animated.View
            {...pan.panHandlers}
            style={{
              height: rowHeight,
              flexDirection: 'row',
              backgroundColor: p.card,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: p.border,
              paddingTop: space.xs,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [rowHeight, 0] }) },
              ],
            }}
          >
            {OVERFLOW.map((name) => (
              <BarItem
                key={name}
                label={name}
                icon={TAB_ICON[name]}
                focused={focusedName === name}
                onPress={() => onSelect(name)}
              />
            ))}
          </Animated.View>
        </View>

        {bar}
      </View>
    </Modal>
  );
}
