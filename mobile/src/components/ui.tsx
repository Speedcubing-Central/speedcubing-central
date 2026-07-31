import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { usePalette } from '../store/settings';
import { useScreenScale } from '../lib/scale';
import { font, radius, space, stroke } from '../theme';
import { Icon, type IconName } from './Icon';

// ── The app's one set of building blocks ──────────────────────────────────
//
// Every screen draws from this file, so the app reads as one product rather
// than a pile of separately-styled screens. The visual language follows the web
// client's Tailwind component layer (client/src/index.css): `.card`, `.input`,
// `.label`, `.btn-primary`, `.btn-ghost`. Someone who uses the website should
// recognise the vocabulary here even though none of the code is shared.
//
// This file exists in its current shape because the timer surface had drifted
// into four ways of drawing a container, four pill implementations, three
// small-label styles, two "nothing here" glyphs, two divider weights, two
// screen scaffolds and five inline-input variants. None of those were bugs
// individually; collectively they were why the app looked unfinished. The rule
// now is that there is exactly one of each, it lives here, and a screen that
// wants something different says why in a comment at the call site.

/**
 * The one placeholder for a value that does not exist yet.
 *
 * The bare '—' is deliberate and is the sanctioned exception to this project's
 * no-em-dash rule: it matches the glyph the web client's stats table already
 * prints, so the same empty average reads the same on both platforms. The
 * solves list used to print '·' instead, which was defensible while it was a
 * separate screen and is not now that it shares a panel with the stats rows.
 */
export const EMPTY = '—';

// Monospace family for times and scrambles: the same JetBrains Mono the web
// client uses rather than the platform default (Menlo/Roboto Mono), so a time
// reads identically on both. `font.mono` in theme.ts is the source; these
// aliases exist because most call sites are about "this is a time", not about
// which family that implies.
export const MONO = font.mono;
export const MONO_BOLD = font.monoBold;

// ── Layout ────────────────────────────────────────────────────────────────

export function Screen({
  children,
  scroll = false,
  // Pushed stack screens pass [] because the navigation header already owns the
  // top inset; a tab root passes the default. Previously the pushed screens
  // hand-rolled `SafeAreaView edges={[]}` plus their own padded View, which is
  // how three of them ended up with slightly different padding.
  edges = ['top'],
  padded = true,
  gap = space.md,
  style,
  contentContainerStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  padded?: boolean;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const pad = padded ? space.md : 0;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: p.bg }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ padding: pad, gap, paddingBottom: space.xl }, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: pad, gap }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/**
 * The one container treatment: a bordered card.
 *
 * Matches web's `.card` (`bg-card border border-border rounded-xl`); radius.md
 * is 12, which is what Tailwind's rounded-xl resolves to, so the corner is
 * literally the same on both platforms.
 *
 * `padding="none"` is for a Surface holding its own rows, where each row
 * supplies the padding and the rules between them run edge to edge.
 */
export function Surface({
  children,
  style,
  padding = 'md',
  onLayout,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Forwarded so a caller can size its contents to the box it actually got. */
  onLayout?: ViewProps['onLayout'];
  /** A Surface that opens something becomes a Pressable; the rest stay Views. */
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const base: ViewStyle = {
    backgroundColor: p.card,
    borderColor: p.border,
    borderWidth: stroke.thin,
    borderRadius: radius.md,
    padding: padding === 'none' ? 0 : padding === 'sm' ? space.sm : padding === 'lg' ? space.lg : space.md,
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLayout={onLayout}
        style={({ pressed }) => [base, style, pressed ? { opacity: 0.7 } : null]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[base, style]} onLayout={onLayout}>
      {children}
    </View>
  );
}

/**
 * The one rule drawn inside a surface. Always hairline: a 1dp rule between list
 * rows reads as a border around each row rather than as a separation between
 * them, which is what the Statistics table and the settings rows both did.
 */
export function Divider({ inset = 0 }: { inset?: number }) {
  const p = usePalette();
  return <View style={{ height: stroke.hairline, backgroundColor: p.border, marginLeft: inset }} />;
}

// ── Text roles ────────────────────────────────────────────────────────────

/**
 * A group or section heading. Web's `.label`: uppercase, tracked, muted.
 * For headings only, never for data.
 */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  const { maxFontMultiplier } = useScreenScale();
  return (
    <Text
      maxFontSizeMultiplier={maxFontMultiplier}
      style={[
        {
          color: p.textMuted,
          fontSize: 11,
          fontFamily: font.sansSemi,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * A column head or an in-row caption, and deliberately NOT uppercase.
 *
 * The web stats table's heads are `text-xs text-muted` in sentence case and its
 * solves columns are lowercase (`single`, `ao5`), so uppercasing them here made
 * the mobile tables shout where the web ones murmur. Reserved for anything that
 * labels data rather than heading a section.
 */
export function ColumnLabel({
  children,
  style,
  align,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  align?: 'left' | 'right' | 'center';
}) {
  const p = usePalette();
  const { maxFontMultiplier } = useScreenScale();
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={maxFontMultiplier}
      style={[{ color: p.textMuted, fontSize: 11, fontFamily: font.sansMedium, textAlign: align }, style]}
    >
      {children}
    </Text>
  );
}

/** A statistic's own name: `single`, `mo3`, `ao5`. Lowercase, as on web. */
export function StatName({ children }: { children: string }) {
  const p = usePalette();
  const { s: sc, maxFontMultiplier } = useScreenScale();
  return (
    <Text
      numberOfLines={1}
      maxFontSizeMultiplier={maxFontMultiplier}
      style={{ color: p.text, fontSize: sc(14), fontFamily: font.sansBold }}
    >
      {children}
    </Text>
  );
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  const p = usePalette();
  const { maxFontMultiplier } = useScreenScale();
  return (
    <Text maxFontSizeMultiplier={maxFontMultiplier} style={{ color: p.text, fontSize: 20, fontFamily: font.sansBlack }}>
      {children}
    </Text>
  );
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

// ── Controls ──────────────────────────────────────────────────────────────

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
          borderWidth: variant === 'danger' ? stroke.thin : 0,
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

/**
 * The one pill. Used for every mutually-exclusive short option in the app.
 *
 * Geometry is 7/14, which was `Chip`'s. The settings option rows were 8/14 and
 * the session subset chips were 7/13, close enough that the difference read as
 * sloppiness rather than as a distinction.
 */
export function Pill({
  label,
  onPress,
  selected,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const { maxFontMultiplier } = useScreenScale();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: selected ? p.accent : p.cardHover,
          borderRadius: radius.pill,
          paddingVertical: 7,
          paddingHorizontal: 14,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontMultiplier}
        style={{ color: selected ? '#fff' : p.text, fontFamily: font.sansSemi, fontSize: 13 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * An icon-only pill, for rows of compact actions (the scramble controls).
 * Wider than it is tall on purpose: these sit in a row and a circle would read
 * as a set of buttons rather than as one control strip.
 */
export function IconPill({
  name,
  accessibilityLabel,
  onPress,
  disabled,
  active,
  size = 16,
}: {
  name: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: number;
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
      style={({ pressed }) => ({
        width: 38,
        height: 28,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? p.accent : p.cardHover,
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={name} size={size} color={active ? '#fff' : p.text} />
    </Pressable>
  );
}

// A square, icon-only tap target, sized to stay comfortably above the ~44px
// minimum once its hitSlop is counted. For header affordances, where a filled
// pill would add chrome to a row that is mostly identity.
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

/**
 * A borderless textual action, for the secondary controls that sit beside a
 * heading (Select, Cancel, Copy, Delete). Three of these were hand-rolled at
 * two different sizes.
 */
export function TextButton({
  label,
  onPress,
  tone = 'accent',
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'default' | 'danger';
  disabled?: boolean;
}) {
  const p = usePalette();
  const { maxFontMultiplier } = useScreenScale();
  const color = tone === 'accent' ? p.accent : tone === 'danger' ? p.red : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Text
        maxFontSizeMultiplier={maxFontMultiplier}
        style={{ color, fontFamily: font.sansBold, fontSize: 13 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Copy-to-clipboard with its own "Copied" feedback.
 *
 * Owns the timeout so callers stop duplicating it. Both previous copies of this
 * logic leaked their timer when the sheet closed inside the 1500ms window,
 * which called setState on an unmounted component; the cleanup below is the
 * point of centralising it.
 *
 * `getText` is a function, not a string, so the value is read at press time.
 * A solve's text depends on data that can change while the sheet is open.
 */
export function CopyButton({
  getText,
  label = 'Copy',
  copiedLabel = 'Copied',
  accessibilityLabel,
}: {
  getText: () => string;
  label?: string;
  copiedLabel?: string;
  accessibilityLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onPress = useCallback(() => {
    Clipboard.setStringAsync(getText());
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }, [getText]);

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <TextButton label={copied ? copiedLabel : label} onPress={onPress} />
    </View>
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
  const { maxFontMultiplier } = useScreenScale();
  return (
    <View
      style={[
        { flexDirection: 'row', backgroundColor: p.cardHover, borderRadius: radius.sm, padding: 3, gap: 3 },
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
              // 7, matching Pill, so a segmented control and a row of pills are
              // the same height when they sit near each other.
              paddingVertical: 7,
              alignItems: 'center',
            }}
          >
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={maxFontMultiplier}
              style={{ color: selected ? '#fff' : p.textMuted, fontFamily: font.sansSemi, fontSize: 12 }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The one text input.
 *
 * Follows web's `.input`, which fills with the *page* background and carries a
 * border, rather than the `cardHover` fill four of the five mobile inputs had
 * grown. On a card the border is what separates it; on the page background it
 * reads as border-only, which is exactly how the website behaves.
 */
export const Input = forwardRef<TextInput, TextInputProps & {
  invalid?: boolean;
  mono?: boolean;
  align?: 'left' | 'center';
}>(function Input({ invalid, mono, align = 'left', style, ...props }, ref) {
  const p = usePalette();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={p.textMuted}
      style={[
        {
          backgroundColor: p.bg,
          borderWidth: stroke.thin,
          borderColor: invalid ? p.red : p.border,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          paddingVertical: 10,
          fontSize: 15,
          fontFamily: mono ? MONO : font.sansMedium,
          color: p.text,
          textAlign: align,
        },
        style,
      ]}
      {...props}
    />
  );
});

// ── States ────────────────────────────────────────────────────────────────

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
