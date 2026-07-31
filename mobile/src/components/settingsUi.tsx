import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native';
import { usePalette } from '../store/settings';
import { font, space, stroke } from '../theme';
import { Label, Pill, Surface } from './ui';

// Settings row primitives, mirroring client/src/components/settingsUi.tsx so the
// two apps present the same options with the same labels and hints.
//
// This stays a thin domain layer over ui.tsx rather than folding into it: these
// four exports are used by exactly two screens, and ui.tsx is already the
// general vocabulary. What changed is only what they are built from, so no
// screen that renders them needed an edit.

export function SettingsRow({
  label,
  hint,
  disabled,
  // A toggle is narrow enough to sit beside the label; wider controls (option
  // lists) get their own full-width line below it so labels are never squeezed
  // on a narrow screen. Callers say which they are rather than this trying to
  // infer it from the child element's type.
  inline = false,
  children,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  inline?: boolean;
  // Optional so a row can be pure information (e.g. "Beta access: yes") with no
  // control attached, the way the web settings page has read-only rows too.
  children?: ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      style={{
        opacity: disabled ? 0.45 : 1,
        paddingVertical: space.md,
        // Hairline, not 1dp. At 1dp a rule between two rows reads as a border
        // around each of them rather than as a separation between them.
        borderBottomWidth: stroke.hairline,
        borderBottomColor: p.border,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 15, fontFamily: font.sansSemi }}>{label}</Text>
          {hint ? <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 2 }}>{hint}</Text> : null}
        </View>
        {inline ? <View>{children}</View> : null}
      </View>
      {inline ? null : children}
    </View>
  );
}

export function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      trackColor={{ true: p.accent, false: p.border }}
      thumbColor="#fff"
    />
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Label style={{ marginTop: space.md }}>{title}</Label>
      {/* padding="none" because each SettingsRow supplies its own vertical
          padding and its rule needs to run to the card's edges. The horizontal
          inset is the group's, not the row's, so a rule is never inset. */}
      <Surface padding="none" style={{ paddingHorizontal: space.md }}>
        {children}
      </Surface>
    </View>
  );
}

// A horizontal list of mutually-exclusive options. Used where the web client
// uses a <select>. A native picker for four short options is more taps than it
// is worth on a phone.
export function OptionRow<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {options.map((o) => (
        <Pill
          key={String(o.value)}
          label={o.label}
          selected={o.value === value}
          disabled={disabled}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}
