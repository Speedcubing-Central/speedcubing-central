import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiError } from '../../lib/api';
import { SERVER_ORIGIN } from '../../lib/config';
import { usePalette } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { useServerConfig } from '../../store/serverConfig';
import { Button, Muted, Segmented } from '../../components/ui';
import { font, radius, space } from '../../theme';

// Email/password sign-in and registration against the same endpoints the web
// client uses. The difference is what happens to the credential afterwards: the
// server returns the JWT pair in the response body (because the api client sends
// `X-Auth-Mode: bearer`) and the auth store writes it into expo-secure-store.
//
// WCA OAuth is a browser redirect flow ending in a server-side redirect to
// FRONTEND_URL, so it can't be completed inside a native app without a
// mobile-specific callback (a deep link back into the app, or an
// expo-auth-session PKCE flow). Rather than pretend, the WCA button hands off to
// the system browser and explains that the account can then be used here with a
// password. Wiring a real native WCA flow is its own piece of work and would mean
// touching the OAuth callback, which this pass deliberately leaves alone.
export default function LoginScreen() {
  const p = usePalette();
  const { login, register, loginWithWca } = useAuth();
  const wcaEnabled = useServerConfig((s) => s.wcaEnabled);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, displayName.trim());
      }
    } catch (e) {
      Alert.alert(mode === 'login' ? 'Sign in failed' : 'Registration failed', apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    color: p.text,
    backgroundColor: p.cardHover,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 15,
  } as const;

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'login', label: 'Sign in' },
            { value: 'register', label: 'Create account' },
          ]}
        />

        {mode === 'register' && (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={p.textMuted}
            autoCapitalize="words"
            style={inputStyle}
          />
        )}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={p.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={inputStyle}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={p.textMuted}
          secureTextEntry
          autoCapitalize="none"
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          style={inputStyle}
        />

        <Button
          label={busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          variant="primary"
          onPress={submit}
          disabled={busy || !email.trim() || !password || (mode === 'register' && !displayName.trim())}
        />

        {wcaEnabled && (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <Muted>Or sign in with your WCA account</Muted>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await loginWithWca();
                } catch (e) {
                  Alert.alert('WCA sign in failed', apiError(e));
                } finally {
                  setBusy(false);
                }
              }}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: p.border,
                borderRadius: radius.sm,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: busy ? 0.5 : pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: p.text, fontFamily: font.sansBold }}>Continue with WCA</Text>
            </Pressable>
            <Muted>
              Opens WCA in a secure browser and signs you in here. Your WCA password is never entered in this app.
            </Muted>
          </View>
        )}

        <Muted style={{ marginTop: space.lg }}>
          You can use the timer, calculator and trainers without an account. Solves are then stored on this device
          only, exactly as in the web app.
        </Muted>
      </ScrollView>
    </SafeAreaView>
  );
}
