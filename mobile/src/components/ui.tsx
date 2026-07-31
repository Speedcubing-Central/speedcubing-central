import type { ReactNode } from 'react';
import {
  ActivityIndicator,
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
import { font, radius, space } from '../theme';
import { Icon, type IconName } from './Icon';

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
  return <Text style={{ color: p.text, fontSize: 22, fontFamily: font.sansBlack }}>{children}</Text>;
}

export function Muted({
  children,
  style,
  numberOfLines,
  maxFontSizeMultiplier,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Forwarded so a caller in a fixed-height box can cap OS text scaling. */
  maxFontSizeMultiplier?: number;
}) {
  const p = usePalette();
  return (
    <Text
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[{ color: p.textMuted, fontSize: 13, fontFamily: font.sans }, style]}
    >
      {children}
    </Text>
  );
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
      <Text style={{ color: fg, fontFamily: font.sansBold, fontSize: 15 }}>{label}</Text>
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
        style={{ color: active ? '#fff' : p.text, fontFamily: font.sansSemi, fontSize: 13 }}
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
                fontFamily: font.sansSemi,
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
      <Text
        style={{
          color: p.textMuted,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontFamily: font.sansSemi,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: p.text,
          fontSize: 20,
          fontVariant: ['tabular-nums'],
          fontFamily: mono ? font.monoBold : font.sansBold,
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
      <Text style={{ color: p.text, fontSize: 16, fontFamily: font.sansBold, textAlign: 'center' }}>{title}</Text>
      {body ? <Muted style={{ textAlign: 'center' }}>{body}</Muted> : null}
    </View>
  );
}

// Monospace family for times and scrambles, now the same JetBrains Mono the web
// client uses rather than the platform default (Menlo/Roboto Mono), so a time
// reads identically on both. Kept as a named export because several screens
// already reference MONO; `font.mono` in theme.ts is the underlying source.
export const MONO = font.mono;
export const MONO_BOLD = font.monoBold;

// A square, icon-only tap target. Used for the header affordances that replaced
// the emoji buttons, sized to stay comfortably above the ~44px minimum.
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  color,
  disabled,
  size = 20,
  style,
}: {
  name: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 38,
          height: 38,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? p.cardHover : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={color ?? p.text} />
    </Pressable>
  );
}
