import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { usePalette } from '../store/settings';
import { Icon, type IconName } from '../components/Icon';
import { font } from '../theme';
import { TimerStack } from './TimerStack';
import { MoreStack } from './MoreStack';
import AlgorithmsScreen from '../features/algorithms/AlgorithmsScreen';
import BattleScreen from '../features/battle/BattleScreen';
import RelaysScreen from '../features/relays/RelaysScreen';

// ── Bottom tab bar ────────────────────────────────────────────────────────
//
// No Home tab, by design. The web sidebar has one because a vertical sidebar has
// a natural landing slot at the top, and the signed-out version of that route
// doubles as the marketing landing page. A bottom tab bar has neither need: every
// top-level section is already one tap away, so a tab whose only job is to link to
// the other tabs would be pure overhead. The Timer is the initial route instead.
// It's what the app gets opened for.
//
// Tab budget. A phone tab bar tops out around five items before labels start
// truncating, and the web nav has eight destinations once Home is dropped (Timer,
// Calculator, Algorithms, Battle, Relays, Reconstruction, Results, Settings). So
// the four tabs here are the ones reached for during a practice session, and the
// four that are browsed occasionally rather than used mid-solve, Calculator,
// Reconstruction, Results, Settings, are grouped behind "More" (see MoreStack)
// along with sign-in/out. Nothing is unreachable; the split follows how often a
// screen gets opened, not importance.
export type RootTabParamList = {
  Timer: undefined;
  Algorithms: undefined;
  Battle: undefined;
  Relays: undefined;
  More: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// The web client's own icon set, ported to react-native-svg in
// components/Icon.tsx: same 24x24 paths, so a tab is drawn with the same glyph
// its sidebar entry uses on the web. (This replaced emoji placeholders, which
// rendered at inconsistent sizes and couldn't take the active tint.)
const TAB_ICON: Record<keyof RootTabParamList, IconName> = {
  Timer: 'timer',
  Algorithms: 'brain',
  Battle: 'swords',
  Relays: 'skipForward',
  More: 'panel',
};

export function RootNavigator() {
  const p = usePalette();
  return (
    <Tab.Navigator
      initialRouteName="Timer"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.textMuted,
        tabBarStyle: {
          backgroundColor: p.card,
          borderTopColor: p.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: font.sansSemi },
        tabBarIcon: ({ color }) => <Icon name={TAB_ICON[route.name]} size={22} color={color} />,
      })}
    >
      <Tab.Screen name="Timer" component={TimerStack} />
      <Tab.Screen name="Algorithms" component={AlgorithmsScreen} />
      <Tab.Screen name="Battle" component={BattleScreen} />
      <Tab.Screen name="Relays" component={RelaysScreen} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}
