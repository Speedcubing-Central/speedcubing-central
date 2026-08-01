import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomBar } from './BottomBar';
import { TimerStack } from './TimerStack';
import { SettingsStack } from './SettingsStack';
import AlgorithmsScreen from '../features/algorithms/AlgorithmsScreen';
import BattleScreen from '../features/battle/BattleScreen';
import RelaysScreen from '../features/relays/RelaysScreen';
import CalculatorScreen from '../features/calculator/CalculatorScreen';
import ReconstructionScreen from '../features/reconstruction/ReconstructionScreen';
import ResultsScreen from '../features/results/ResultsScreen';

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
// truncating, and the web nav has eight destinations once Home is dropped. So the
// bar carries Timer, Calculator, Algorithms and Settings, and the other four
// (Battle, Relays, Reconstruction, Results) open as a second row above the bar
// from the three-dot More button. Every destination is registered here as a real
// tab; which of them the bar shows, and where, is BottomBar's business.
//
// This replaced an earlier split where More was itself a tab holding a stack of
// list-of-links screens. That cost two taps and a pushed screen to reach a
// destination the bar now reveals in place, and its landing screen duplicated the
// Settings page's account section to do it.
export type RootTabParamList = {
  Timer: undefined;
  Calculator: undefined;
  Algorithms: undefined;
  Settings: undefined;
  Battle: undefined;
  Relays: undefined;
  Reconstruction: undefined;
  Results: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Timer"
      // The stock bar can hide a tab but has nowhere to put one, so the whole
      // bar is ours. Tint, label and icon options are set there rather than
      // through screenOptions for the same reason.
      tabBar={(props) => <BottomBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Timer" component={TimerStack} />
      <Tab.Screen name="Calculator" component={CalculatorScreen} />
      <Tab.Screen name="Algorithms" component={AlgorithmsScreen} />
      <Tab.Screen name="Settings" component={SettingsStack} />
      <Tab.Screen name="Battle" component={BattleScreen} />
      <Tab.Screen name="Relays" component={RelaysScreen} />
      <Tab.Screen name="Reconstruction" component={ReconstructionScreen} />
      <Tab.Screen name="Results" component={ResultsScreen} />
    </Tab.Navigator>
  );
}
