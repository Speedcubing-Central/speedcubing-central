import { useEffect, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { useAuth } from './store/auth';
import { useServerConfig } from './store/serverConfig';
import { usePalette, useSettings } from './store/settings';
import { useBeta } from './lib/beta';
import { Loading } from './components/ui';
import { RootNavigator } from './navigation/RootNavigator';
import LoginScreen from './features/auth/LoginScreen';
import { space } from './theme';

export default function App() {
  const initAuth = useAuth((s) => s.init);
  const loadConfig = useServerConfig((s) => s.load);

  useEffect(() => {
    // Both need to be underway before the beta gate can decide anything. It
    // waits for both to resolve (see useBeta's blockedFromBetaSite).
    loadConfig();
    initAuth();
  }, [loadConfig, initAuth]);

  return (
    <SafeAreaProvider>
      <BetaGate>
        <ThemedNavigation />
      </BetaGate>
    </SafeAreaProvider>
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
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>Private beta</Text>
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
        <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>Private beta</Text>
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
