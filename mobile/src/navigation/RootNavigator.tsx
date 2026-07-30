import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { usePalette } from '../store/settings';
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

// Emoji glyphs stand in for the web client's SVG icon set. Swapping in a real
// vector icon font (@expo/vector-icons) is a drop-in change later; this keeps the
// dependency surface small for the scaffold without leaving the tab bar bare.
const TAB_GLYPH: Record<keyof RootTabParamList, string> = {
  Timer: '⏱',
  Algorithms: '🧩',
  Battle: '⚔️',
  Relays: '⏭',
  More: '⋯',
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 19, color }}>{TAB_GLYPH[route.name]}</Text>,
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
