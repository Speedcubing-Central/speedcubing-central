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

export function getPalette(themeId: string, theme: 'dark' | 'light', accentOverride?: string): Palette {
  const preset = THEME_PRESETS.find((p) => p.id === themeId) ?? THEME_PRESETS[0];
  const accent = accentOverride || preset.accent;
  if (theme === 'light') return { ...LIGHT, accent };
  return {
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
}

// Shared spacing/typography scale, so screens don't each invent their own.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

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
