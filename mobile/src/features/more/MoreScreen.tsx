import { Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePalette } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { useBeta } from '../../lib/beta';
import { Muted, Screen } from '../../components/ui';
import type { MoreStackParamList } from '../../navigation/MoreStack';
import { SERVER_ORIGIN } from '../../lib/config';
import { font, radius, space } from '../../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

// The web nav destinations that don't need a tab of their own, plus account
// status. See RootNavigator's tab-budget note for why these four are grouped.
export default function MoreScreen({ navigation }: Props) {
  const p = usePalette();
  const { user } = useAuth();
  const { isBetaSite, hasBetaAccess } = useBeta();

  const items: { label: string; hint: string; to: keyof MoreStackParamList }[] = [
    { label: 'Calculator', hint: 'Average and mean calculator, target-time solver', to: 'Calculator' },
    { label: 'Reconstruction', hint: '3D scramble and solution playback', to: 'Reconstruction' },
    { label: 'Results', hint: 'WCA competitor lookup and results history', to: 'Results' },
    { label: 'Settings', hint: 'Appearance, account, session', to: 'Settings' },
  ];

  return (
    <Screen scroll>
      <Text style={{ color: p.text, fontSize: 22, fontFamily: font.sansBlack }}>More</Text>

      {/* Account */}
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate(user ? 'Settings' : 'Login')}
        style={({ pressed }) => ({
          backgroundColor: pressed ? p.cardHover : p.card,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: space.lg,
        })}
      >
        {user ? (
          <>
            <Text style={{ color: p.text, fontSize: 16, fontFamily: font.sansBold }}>{user.displayName}</Text>
            <Muted>
              {user.email ?? user.wcaId ?? 'Signed in'}
              {isBetaSite ? (hasBetaAccess ? ' · beta access' : ' · no beta access') : ''}
            </Muted>
          </>
        ) : (
          <>
            <Text style={{ color: p.accent, fontSize: 16, fontFamily: font.sansBold }}>Sign in</Text>
            <Muted>Sign in to sync your solves and sessions with the web app.</Muted>
          </>
        )}
      </Pressable>

      <View style={{ gap: space.sm }}>
        {items.map((item) => (
          <Pressable
            key={item.to}
            accessibilityRole="button"
            onPress={() => navigation.navigate(item.to)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? p.cardHover : p.card,
              borderColor: p.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: space.md,
            })}
          >
            <Text style={{ color: p.text, fontSize: 15, fontFamily: font.sansBold }}>{item.label}</Text>
            <Muted>{item.hint}</Muted>
          </Pressable>
        ))}
      </View>

      <Muted>Connected to {SERVER_ORIGIN}</Muted>
    </Screen>
  );
}
