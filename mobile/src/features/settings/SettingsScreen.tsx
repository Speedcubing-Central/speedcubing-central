import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePalette, useSettings } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { useBeta } from '../../lib/beta';
import { THEME_PRESETS } from '../../theme';
import { Button, Muted, ScreenTitle } from '../../components/ui';
import { OptionRow, SettingsGroup, SettingsRow, Toggle } from '../../components/settingsUi';
import type { SettingsStackParamList } from '../../navigation/SettingsStack';
import { SERVER_ORIGIN } from '../../lib/config';
import { space } from '../../theme';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

// Appearance + account, mirroring the web /settings page's Appearance and Account
// sections. Timer-specific settings live on the Timer tab (see
// features/timer/TimerSettingsScreen.tsx), which is where you'd want to change
// them from on a phone.
//
// A tab root, so it owns its top inset and titles itself, like the other tab
// roots. It also owns sign-in now, which used to hang off the More tab's landing
// screen: an account belongs with the rest of the account settings, and there is
// no landing screen any more.
export default function SettingsScreen({ navigation }: Props) {
  const p = usePalette();
  const s = useSettings();
  const { user, logout, refreshUser } = useAuth();
  const { isBetaSite, hasBetaAccess } = useBeta();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl }}>
        <View style={{ marginBottom: space.md }}>
          <ScreenTitle>Settings</ScreenTitle>
        </View>

        <SettingsGroup title="Appearance">
          <SettingsRow label="Dark mode" hint="Dark is the default for this app" inline>
            <Toggle value={s.theme === 'dark'} onChange={(v) => s.setTheme(v ? 'dark' : 'light')} />
          </SettingsRow>
          <SettingsRow label="Colour theme" hint="Applies to dark mode, same presets as the web app">
            <OptionRow
              value={s.themeId}
              onChange={(id) => s.setThemeId(id)}
              options={THEME_PRESETS.map((preset) => ({ value: preset.id, label: preset.name }))}
            />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Account">
          {user ? (
            <>
              <SettingsRow label={user.displayName} hint={user.email ?? user.wcaId ?? 'Signed in'} />
              {isBetaSite && (
                <SettingsRow
                  label="Beta access"
                  hint={
                    hasBetaAccess
                      ? 'Your account has access to this beta build.'
                      : 'Your account does not have beta access yet.'
                  }
                />
              )}
            </>
          ) : (
            <SettingsRow
              label="Not signed in"
              hint="Solves are stored on this device only. Sign in to sync them with the web app."
            />
          )}
        </SettingsGroup>

        <View style={{ gap: space.sm, marginTop: space.lg }}>
          {user ? (
            <>
              <Button label="Refresh account details" onPress={() => refreshUser()} />
              <Button
                label="Sign out"
                variant="danger"
                onPress={() =>
                  Alert.alert('Sign out?', 'Solves already saved to your account stay on the server.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign out', style: 'destructive', onPress: () => logout() },
                  ])
                }
              />
            </>
          ) : (
            <Button label="Sign in" variant="primary" onPress={() => navigation.navigate('Login')} />
          )}
        </View>

        <View style={{ marginTop: space.xl, gap: 4 }}>
          <Text style={{ color: p.textMuted, fontSize: 11 }}>Server: {SERVER_ORIGIN}</Text>
          <Muted>
            Changing your email or password isn't in this build yet. Use the web app's Settings page for those.
          </Muted>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
