import type { ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { usePalette } from '../store/settings';
import { radius, space } from '../theme';

// Settings row primitives, mirroring client/src/components/settingsUi.tsx so the
// two apps present the same options with the same labels and hints.

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
        borderBottomWidth: 1,
        borderBottomColor: p.border,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
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
  const p = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      <Text
        style={{
          color: p.textMuted,
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginTop: space.md,
        }}
      >
        {title}
      </Text>
      <View
        style={{
          backgroundColor: p.card,
          borderColor: p.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: space.md,
        }}
      >
        {children}
      </View>
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
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={{
              backgroundColor: selected ? p.accent : p.cardHover,
              borderRadius: radius.pill,
              paddingVertical: 8,
              paddingHorizontal: 14,
            }}
          >
            <Text style={{ color: selected ? '#fff' : p.text, fontSize: 12, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
