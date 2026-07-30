import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePalette } from '../store/settings';
import { Icon } from '../components/Icon';
import { TimerDataProvider } from '../features/timer/TimerDataContext';
import TimerScreen from '../features/timer/TimerScreen';
import StatsScreen from '../features/timer/StatsScreen';
import SolvesScreen from '../features/timer/SolvesScreen';
import SessionsScreen from '../features/timer/SessionsScreen';
import TimerSettingsScreen from '../features/timer/TimerSettingsScreen';
import { font, space } from '../theme';

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

// Every pushed screen gets this as its headerLeft instead of the platform back
// button, because that default misbehaved here in two ways:
//
//  * Its label read "TimerHome". A native-stack back button falls back to the
//    previous route's *name* when that route sets no title, and TimerHome set
//    none because it hides its header entirely. Titling TimerHome fixes the
//    text, but the label stays platform-derived and still collapses to "Back"
//    at narrow widths.
//  * It wasn't reliably operable, which left the tab bar as the only way back
//    out of these screens.
//
// An explicit control calling goBack() removes both problems and picks up the
// app's own arrow icon rather than the platform chevron.
function BackToTimer({ onPress }: { onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to Timer"
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: 6,
        paddingRight: space.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name="arrowLeft" size={20} color={p.accent} />
      <Text style={{ color: p.accent, fontFamily: font.sansSemi, fontSize: 16 }}>Timer</Text>
    </Pressable>
  );
}

export function TimerStack() {
  const p = usePalette();
  return (
    // One TimerDataProvider around the whole stack, so the timer and its
    // sub-screens share a single sessions/solves state.
    <TimerDataProvider>
      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          headerStyle: { backgroundColor: p.bg },
          headerTintColor: p.text,
          headerTitleStyle: { fontFamily: font.sansBold, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: p.bg },
          // Suppress the platform back button in favour of the explicit one.
          headerBackVisible: false,
          headerLeft: () => <BackToTimer onPress={() => navigation.goBack()} />,
        })}
      >
        <Stack.Screen
          name="TimerHome"
          component={TimerScreen}
          // Titled even though its header is hidden: this is the label the rest
          // of the navigation tree refers to this route by.
          options={{ headerShown: false, title: 'Timer' }}
        />
        <Stack.Screen name="Stats" component={StatsScreen} options={{ title: 'Statistics' }} />
        <Stack.Screen name="Solves" component={SolvesScreen} options={{ title: 'Solves' }} />
        <Stack.Screen name="Sessions" component={SessionsScreen} options={{ title: 'Sessions' }} />
        <Stack.Screen name="TimerSettings" component={TimerSettingsScreen} options={{ title: 'Timer settings' }} />
      </Stack.Navigator>
    </TimerDataProvider>
  );
}
