import { StyleSheet } from 'react-native';

// The web client's theme presets, as plain values.
//
// On web these live in client/src/store/settings.ts and are applied as CSS
// custom properties that Tailwind reads (`rgb(var(--color-x) / <alpha>)`).
// React Native has no CSS variables, so the same palettes are consumed
// directly by StyleSheet objects instead. The hex values are copied verbatim
// so the two apps look like the same product.
export interface ThemePreset {
  id: string;
  name: string;
  accent: string;
  bg: string;
  card: string;
  cardHover: string;
  border: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'default', name: 'Default', accent: '#2b72ff', bg: '#0f1117', card: '#1e2130', cardHover: '#272b3d', border: '#2c3142' },
  { id: 'violet', name: 'Violet', accent: '#8b5cf6', bg: '#120f1a', card: '#201b30', cardHover: '#2a2340', border: '#332b4d' },
  { id: 'forest', name: 'Forest', accent: '#22c55e', bg: '#0d1410', card: '#16211a', cardHover: '#1e2c22', border: '#263a2c' },
  { id: 'crimson', name: 'Crimson', accent: '#ef4444', bg: '#150f11', card: '#241a1d', cardHover: '#2f2226', border: '#3a2a2f' },
  { id: 'amber', name: 'Amber', accent: '#f59e0b', bg: '#14100a', card: '#241d12', cardHover: '#2f2617', border: '#3a2f1d' },
  { id: 'slate', name: 'Slate', accent: '#6b7280', bg: '#101113', card: '#1c1e22', cardHover: '#24272c', border: '#2c2f36' },
];

export interface Palette {
  accent: string;
  bg: string;
  card: string;
  cardHover: string;
  border: string;
  text: string;
  textMuted: string;
  green: string;
  yellow: string;
  red: string;
}

// Dark is the product's default and the only mode the presets describe (light
// mode on web is a separate set of hardcoded overrides). Light mode here is
// the same idea: one fixed palette, independent of the chosen preset.
const LIGHT: Omit<Palette, 'accent'> = {
  bg: '#f9fafb',
  card: '#ffffff',
  cardHover: '#f3f4f6',
  border: '#e5e7eb',
  text: '#111827',
  textMuted: '#6b7280',
  green: '#16a34a',
  yellow: '#ca8a04',
  red: '#dc2626',
};

// The last palette built, so repeat calls with the same three inputs hand back
// the same object.
//
// `usePalette` is called by roughly every component in the app, on every render,
// and this used to allocate a fresh palette each time. That is cheap in itself.
// What it cost was identity: a `p` that is never twice the same object makes any
// useMemo, useEffect or memo() that depends on it re-run unconditionally, which
// is the opposite of what those are for. One entry is enough, because the inputs
// only change when the user edits their theme.
let lastPalette: { key: string; palette: Palette } | null = null;

export function getPalette(themeId: string, theme: 'dark' | 'light', accentOverride?: string): Palette {
  const key = `${themeId}|${theme}|${accentOverride ?? ''}`;
  if (lastPalette?.key === key) return lastPalette.palette;

  const preset = THEME_PRESETS.find((p) => p.id === themeId) ?? THEME_PRESETS[0];
  const accent = accentOverride || preset.accent;
  const palette: Palette =
    theme === 'light'
      ? { ...LIGHT, accent }
      : {
          accent,
          bg: preset.bg,
          card: preset.card,
          cardHover: preset.cardHover,
          border: preset.border,
          text: '#f3f4f6',
          textMuted: '#8b91a3',
          green: '#22c55e',
          yellow: '#facc15',
          red: '#ef4444',
        };
  lastPalette = { key, palette };
  return palette;
}

// Composites `overlay` over `base` at `alpha` and returns an opaque colour.
//
// For tinting a whole screen, where a translucent layer won't do. A View has one
// background, so a full-bleed tint has to be mixed into the colour rather than
// stacked on top of it: an absolutely positioned layer is laid out inside its
// parent's padding, so it cannot reach under a safe-area inset, and it would sit
// over a touch target that needs every pixel it has.
//
// Both arguments are 6-digit hex, which is what every colour in this file and in
// Palette is. Anything else returns `base` rather than a colour built from NaN.
export function mix(base: string, overlay: string, alpha: number): string {
  const parse = (hex: string): [number, number, number] | null => {
    const h = hex.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  };
  const b = parse(base);
  const o = parse(overlay);
  if (!b || !o) return base;
  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * alpha)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(b[0], o[0])}${channel(b[1], o[1])}${channel(b[2], o[2])}`;
}

// Shared spacing/typography scale, so screens don't each invent their own.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

// Border weights. Two values, one rule: the OUTER edge of a surface is `thin`
// (1dp, matching the web client's `.card`, which is a 1px border), and every
// rule drawn INSIDE a surface is `hairline`.
//
// The app previously mixed the two arbitrarily: the Statistics table's row rules
// and the settings rows used 1dp while the solves list, the sessions list and
// the sheet's top edge used hairlineWidth, so two lists a tap apart drew
// visibly different dividers. Naming the rule is what stops that recurring.
export const stroke = { hairline: StyleSheet.hairlineWidth, thin: 1 } as const;

// ── Motion ────────────────────────────────────────────────────────────────
//
// Durations for the chrome that leaves as an attempt starts and returns when it
// ends: the Timer's stats panel and the app's tab bar.
//
// Shared, because those two sit at the same edge of the screen and move at the
// same moment. Given separate values they read as one thing glitching rather
// than as two things agreeing, which is what happened when the panel cut
// instantly and the bar took 190ms over it.
//
// Out is quicker than in on purpose. Leaving should get out of the way of a
// solve that is already starting; returning lands while you are reading the
// time you just got, and a snap there pulls the eye off it.
export const motion = { immersiveOut: 150, immersiveIn: 190 } as const;

// ── Type families, matching the web client ────────────────────────────────
//
// The web client loads Inter (sans) and JetBrains Mono (mono) from Google Fonts
// and wires them into Tailwind's fontFamily (client/tailwind.config.js), so the
// same two families are bundled here via @expo-google-fonts and referenced by
// these names. Fraunces (web's `display` family) is deliberately not bundled:
// web uses it only on the marketing landing page, which has no mobile
// counterpart, so shipping a third font file would buy nothing.
//
// These are the exact keys the fonts register under in App.tsx's useFonts call.
// React Native has no font inheritance, so every Text that should not be
// system-default names one of these explicitly. The `weight` variants exist
// because RN's fontWeight is unreliable with custom families on Android: asking
// for a heavier weight of a single registered face silently renders the same
// face, so each weight is loaded as its own family instead.
export const font = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  sansBlack: 'Inter_800ExtraBold',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;
