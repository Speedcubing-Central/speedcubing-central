import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePalette } from '../store/settings';
import { Icon } from '../components/Icon';
import SettingsScreen from '../features/settings/SettingsScreen';
import LoginScreen from '../features/auth/LoginScreen';
import { font, space } from '../theme';

// Settings is a tab in its own right (it was behind More), and it needs one
// pushed screen: sign-in. That is the only route in the app that has to be
// reachable from a tab without being one, since an account is something you set
// up once and then forget about.
export type SettingsStackParamList = {
  SettingsHome: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

// The same explicit back control TimerStack uses, and for the same reason: a
// native-stack back button labels itself from the previous route's title, which
// a headerless root doesn't have, and it wasn't reliably operable here.
function BackToSettings({ onPress }: { onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to Settings"
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
      <Text style={{ color: p.accent, fontFamily: font.sansSemi, fontSize: 16 }}>Settings</Text>
    </Pressable>
  );
}

export function SettingsStack() {
  const p = usePalette();
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: p.bg },
        headerTintColor: p.text,
        headerTitleStyle: { fontFamily: font.sansBold, fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: p.bg },
        headerBackVisible: false,
        headerLeft: () => <BackToSettings onPress={() => navigation.goBack()} />,
      })}
    >
      <Stack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        // Headerless like the other tab roots, which title themselves. Titled
        // anyway: this is the name the rest of the navigation tree uses.
        options={{ headerShown: false, title: 'Settings' }}
      />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
    </Stack.Navigator>
  );
}
