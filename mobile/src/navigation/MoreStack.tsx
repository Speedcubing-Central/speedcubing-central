import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { usePalette } from '../store/settings';
import MoreScreen from '../features/more/MoreScreen';
import CalculatorScreen from '../features/calculator/CalculatorScreen';
import ReconstructionScreen from '../features/reconstruction/ReconstructionScreen';
import ResultsScreen from '../features/results/ResultsScreen';
import SettingsScreen from '../features/settings/SettingsScreen';
import LoginScreen from '../features/auth/LoginScreen';

// The four web nav destinations that aren't used mid-practice, plus sign-in,
// reached from the More tab. See RootNavigator's tab-budget note.
export type MoreStackParamList = {
  MoreHome: undefined;
  Calculator: undefined;
  Reconstruction: undefined;
  Results: undefined;
  Settings: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

export function MoreStack() {
  const p = usePalette();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: p.bg },
        headerTintColor: p.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: p.bg },
      }}
    >
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Calculator" component={CalculatorScreen} options={{ title: 'Calculator' }} />
      <Stack.Screen name="Reconstruction" component={ReconstructionScreen} options={{ title: 'Reconstruction' }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
    </Stack.Navigator>
  );
}
