import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '../store/settings';
import { radius, space } from '../theme';

// Small set of building blocks every screen shares, so the app reads as one
// product rather than a pile of independently-styled screens. The visual
// language (dark card surfaces, accent-tinted actions, muted secondary text)
// matches the web client's Tailwind classes.

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const body = (
    <View style={[{ flex: 1, padding: space.md, gap: space.md }, style]}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl }}
          style={{ flex: 1 }}
        >
          {children}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: p.card,
          borderColor: p.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: space.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return <Text style={[{ color: p.textMuted, fontSize: 13 }, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const bg = variant === 'primary' ? p.accent : variant === 'danger' ? 'transparent' : p.cardHover;
  const fg = variant === 'primary' ? '#fff' : variant === 'danger' ? p.red : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.sm,
          paddingVertical: 12,
          paddingHorizontal: space.lg,
          alignItems: 'center',
          borderWidth: variant === 'danger' ? StyleSheet.hairlineWidth : 0,
          borderColor: p.red,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

// A tappable pill, used for the Timer's event/session selectors and for
// compact navigation affordances.
export function Chip({
  label,
  onPress,
  active,
  style,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: active ? p.accent : p.cardHover,
          borderRadius: radius.pill,
          paddingVertical: 7,
          paddingHorizontal: 14,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: active ? '#fff' : p.text, fontWeight: '600', fontSize: 13 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: p.cardHover,
          borderRadius: radius.sm,
          padding: 3,
          gap: 3,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              backgroundColor: selected ? p.accent : 'transparent',
              borderRadius: radius.sm - 2,
              paddingVertical: 7,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: selected ? '#fff' : p.textMuted,
                fontWeight: '600',
                fontSize: 12,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Row of labelled values. The mobile stand-in for a wide desktop table when
// only a couple of numbers need to be visible.
export function StatPill({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: p.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text
        style={{
          color: p.text,
          fontSize: 20,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          fontFamily: mono ? MONO : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
      <ActivityIndicator color={p.accent} />
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm }}>
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {body ? <Muted style={{ textAlign: 'center' }}>{body}</Muted> : null}
    </View>
  );
}

// Monospace family for times and scrambles. Tabular digits matter for a timer
// that updates every frame. 'monospace' is an Android alias and is NOT a valid
// iOS font family, so each platform gets its own name.
export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
