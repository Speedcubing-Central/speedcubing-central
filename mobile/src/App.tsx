import { useEffect, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
// Imported per face, not from the package root. The root index of
// @expo-google-fonts/* requires *every* weight and italic it ships, so importing
// from it pulls all ~36 faces of both families into the app bundle: measured at
// 7.72MB of fonts in `expo export`, against the 7 faces actually used. These
// subpaths pull one .ttf each.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { useAuth } from './store/auth';
import { useServerConfig } from './store/serverConfig';
import { usePalette, useSettings } from './store/settings';
import { useBeta } from './lib/beta';
import { Loading } from './components/ui';
import { RootNavigator } from './navigation/RootNavigator';
import LoginScreen from './features/auth/LoginScreen';
import { font, space } from './theme';

export default function App() {
  const initAuth = useAuth((s) => s.init);
  const loadConfig = useServerConfig((s) => s.load);

  // The same two families the web client loads from Google Fonts, so type looks
  // the same on both platforms (see theme.ts's `font`). Each weight is its own
  // registered face rather than relying on fontWeight, which doesn't
  // synthesize reliably for custom families on Android.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    // Both need to be underway before the beta gate can decide anything. It
    // waits for both to resolve (see useBeta's blockedFromBetaSite).
    loadConfig();
    initAuth();
  }, [loadConfig, initAuth]);

  return (
    <SafeAreaProvider>
      {/* Held until the faces are registered rather than rendering in the system
          font and reflowing a moment later, which is very visible on a screen
          whose centerpiece is 96pt tabular digits. */}
      {fontsLoaded ? (
        <BetaGate>
          <ThemedNavigation />
        </BetaGate>
      ) : (
        <FontGate />
      )}
    </SafeAreaProvider>
  );
}

function FontGate() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style="light" />
      <Loading />
    </View>
  );
}

// Mirrors client/src/App.tsx's RequireBetaAccess: when this build is talking to
// the beta deployment, the whole app requires an account with betaAccess. The
// gate is whole-site, not per-feature, because that is how the deployment-level
// flag actually works today (see lib/beta.ts for the full reading). Sign-in stays
// reachable either way, so an unapproved account can log in and be told why it's
// blocked rather than bouncing forever, exactly as /login does on web.
//
// On the main deployment this is a no-op and every user passes straight through.
function BetaGate({ children }: { children: ReactNode }) {
  const p = usePalette();
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const configLoaded = useServerConfig((s) => s.loaded);
  const { isBetaSite, blockedFromBetaSite } = useBeta();

  if (!configLoaded || authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <StatusBar style="light" />
        <Loading label="Loading…" />
      </View>
    );
  }

  if (isBetaSite && !user) {
    // Nobody signed in on a beta deployment. Send them to sign in, the
    // equivalent of web's <Navigate to="/login" />.
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <StatusBar style="light" />
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Text style={{ color: p.text, fontSize: 20, fontFamily: font.sansBlack }}>Private beta</Text>
          <Text style={{ color: p.textMuted }}>Sign in with an approved account to continue.</Text>
        </View>
        <LoginScreen />
      </View>
    );
  }

  if (blockedFromBetaSite) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: p.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
          gap: space.sm,
        }}
      >
        <StatusBar style="light" />
        <Text style={{ color: p.text, fontSize: 20, fontFamily: font.sansBlack }}>Private beta</Text>
        <Text style={{ color: p.textMuted, textAlign: 'center' }}>
          Your account doesn't have access to this build yet.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

function ThemedNavigation() {
  const p = usePalette();
  const theme = useSettings((s) => s.theme);

  const base = theme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: p.accent,
      background: p.bg,
      card: p.card,
      text: p.text,
      border: p.border,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </NavigationContainer>
  );
}
