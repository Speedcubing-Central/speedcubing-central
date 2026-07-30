import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePalette } from '../store/settings';
import { TimerDataProvider } from '../features/timer/TimerDataContext';
import TimerScreen from '../features/timer/TimerScreen';
import StatsScreen from '../features/timer/StatsScreen';
import SolvesScreen from '../features/timer/SolvesScreen';
import SessionsScreen from '../features/timer/SessionsScreen';
import TimerSettingsScreen from '../features/timer/TimerSettingsScreen';

// The Timer tab is a small stack rather than a single screen. This is the
// concrete shape of the "restructure, don't shrink" requirement. The desktop
// page's right-hand column (a full statistics table and the whole solves list,
// both permanently visible next to the timer) becomes pushed screens that are
// one tap from the timer, so the timer itself gets the whole phone screen.
export type TimerStackParamList = {
  TimerHome: undefined;
  Stats: undefined;
  Solves: undefined;
  Sessions: undefined;
  TimerSettings: undefined;
};

const Stack = createNativeStackNavigator<TimerStackParamList>();

export function TimerStack() {
  const p = usePalette();
  return (
    // One TimerDataProvider around the whole stack, so the timer and its
    // sub-screens share a single sessions/solves state.
    <TimerDataProvider>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: p.bg },
          headerTintColor: p.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: p.bg },
        }}
      >
        <Stack.Screen name="TimerHome" component={TimerScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'Statistics' }} />
        <Stack.Screen name="Solves" component={SolvesScreen} options={{ title: 'Solves' }} />
        <Stack.Screen name="Sessions" component={SessionsScreen} options={{ title: 'Sessions' }} />
        <Stack.Screen name="TimerSettings" component={TimerSettingsScreen} options={{ title: 'Timer settings' }} />
      </Stack.Navigator>
    </TimerDataProvider>
  );
}
