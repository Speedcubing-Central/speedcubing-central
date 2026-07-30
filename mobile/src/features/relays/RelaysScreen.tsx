import { Alert, Pressable, Text, View } from 'react-native';
import { getEvent, RELAY_PRESETS, presetToLegs, type RelayPreset } from '@scc/shared';
import { usePalette } from '../../store/settings';
import { useBeta } from '../../lib/beta';
import { Muted, Screen } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { font, radius, space } from '../../theme';

// Relays.
//
// Gating here mirrors the current web implementation exactly (see lib/beta.ts for
// the full read of how that implementation actually works today, which is not the
// per-feature betaAccess check it might look like from the outside):
//
//  * The Relays tab itself is fully released, everyone gets it, on both
//    deployments, signed in or not. Solo/preset relay running is not gated.
//  * The "Team Relay" entry point specifically is beta-only, matching
//    RelaysPage.tsx's `{IS_BETA_SITE && <Link to="/relays/team">}`. On mobile
//    that means it's hidden unless the server is the beta deployment AND the
//    signed-in account has betaAccess, which is precisely the set of users who
//    can see it on web, since RequireBetaAccess blocks everyone else from the
//    beta site outright.
//
// Running a relay is deliberately out of scope for this pass (see the stub note
// below); the presets, the tab, and the gating are real.
export default function RelaysScreen() {
  const p = usePalette();
  const { betaFeaturesEnabled } = useBeta();

  const quick = RELAY_PRESETS.filter((r) => r.group === 'quick');
  const guildford = RELAY_PRESETS.filter((r) => r.group === 'guildford');

  return (
    <Screen scroll>
      <View>
        <Text style={{ color: p.text, fontSize: 22, fontFamily: font.sansBlack }}>Relays</Text>
        <Muted>Time multi-event relays solo, build your own, or race one together.</Muted>
      </View>

      {/* The gated Team Relay entry point. */}
      {betaFeaturesEnabled && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert('Team Relay', 'Team Relay rooms are not part of this build yet. Coming in a later pass.')
          }
          style={({ pressed }) => ({
            backgroundColor: p.accent,
            borderRadius: radius.md,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          {/* Same 'swords' glyph the web RelaysPage button uses. */}
          <Icon name="swords" size={17} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: font.sansBold, fontSize: 15 }}>Team Relay</Text>
        </Pressable>
      )}

      <RelayGroup title="Quick Relays" presets={quick} />
      <RelayGroup title="Guildford Relays" presets={guildford} />

      <View
        style={{
          borderWidth: 1,
          borderColor: p.border,
          borderRadius: radius.md,
          padding: space.md,
        }}
      >
        <Muted>
          Relay running and the custom relay builder are not in this build yet. Presets and their leg lists are the
          real shared definitions, so a relay started here will match the web client's once running lands.
        </Muted>
      </View>
    </Screen>
  );
}

function RelayGroup({ title, presets }: { title: string; presets: RelayPreset[] }) {
  const p = usePalette();
  return (
    <View style={{ gap: space.sm }}>
      <Text
        style={{
          color: p.textMuted,
          fontSize: 11,
          fontFamily: font.sansBold,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}
      >
        {title}
      </Text>
      {presets.map((preset) => {
        const legs = presetToLegs(preset);
        return (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(preset.name, `${legs.length} legs:\n\n${legs.map((e) => getEvent(e)?.name ?? e).join('\n')}`)
            }
            style={({ pressed }) => ({
              backgroundColor: pressed ? p.cardHover : p.card,
              borderColor: p.border,
              borderWidth: 1,
              borderRadius: radius.md,
              padding: space.md,
              gap: 4,
            })}
          >
            <Text style={{ color: p.text, fontSize: 15, fontFamily: font.sansBold }}>{preset.name}</Text>
            <Muted>
              {legs.length} leg{legs.length === 1 ? '' : 's'} ·{' '}
              {legs
                .slice(0, 6)
                .map((e) => getEvent(e)?.name ?? e)
                .join(', ')}
              {legs.length > 6 ? '…' : ''}
            </Muted>
          </Pressable>
        );
      })}
    </View>
  );
}
