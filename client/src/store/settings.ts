import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_ACCENT = '#2b72ff';

export type Theme = 'dark' | 'light';
export type InspectionDirection = 'down' | 'up';
export type EntryMode = 'keyboard' | 'typing';
export type TimerUpdate = 'centiseconds' | 'deciseconds' | 'seconds' | 'hidden';

// Preset dark-mode color palettes ("themes"). Light mode has its own
// hardcoded look (scattered `dark:` overrides throughout the app) and isn't
// affected by these — they only reskin the default dark palette via the
// same CSS custom properties `applyAccentColor` already used for accent.
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
  { id: 'violet',  name: 'Violet',  accent: '#8b5cf6', bg: '#120f1a', card: '#201b30', cardHover: '#2a2340', border: '#332b4d' },
  { id: 'forest',  name: 'Forest',  accent: '#22c55e', bg: '#0d1410', card: '#16211a', cardHover: '#1e2c22', border: '#263a2c' },
  { id: 'crimson', name: 'Crimson', accent: '#ef4444', bg: '#150f11', card: '#241a1d', cardHover: '#2f2226', border: '#3a2a2f' },
  { id: 'amber',   name: 'Amber',   accent: '#f59e0b', bg: '#14100a', card: '#241d12', cardHover: '#2f2617', border: '#3a2f1d' },
  { id: 'slate',   name: 'Slate',   accent: '#6b7280', bg: '#101113', card: '#1c1e22', cardHover: '#24272c', border: '#2c2f36' },
];

interface SettingsState {
  theme: Theme;
  accentColor: string;
  themeId: string;
  defaultEvent: string;
  currentEvent: string;
  // eventId -> id of the session most recently solved in for that event, so
  // the Timer can reopen to wherever the user was actually practicing
  // instead of whichever session happens to be newest (see useTimerData's
  // session-selection effect). Keyed by event since each event tracks its
  // own session list independently.
  lastSessionByEvent: Record<string, string>;

  // Timer settings
  inspection: boolean;
  inspectionDirection: InspectionDirection;
  inspectionVoice: boolean;
  entryMode: EntryMode;
  timerUpdate: TimerUpdate; // precision shown while running
  solvePrecision: 2 | 3; // decimals shown in the solves list & stats
  holdToStart: boolean;
  holdDuration: number; // ms the spacebar must be held before the timer is armed
  startSound: boolean;
  celebratePBs: boolean; // confetti + animated text on a new PB single/average
  carrotNotation: boolean; // display megaminx scrambles as carrot notation instead of WCA moves

  // Stats table column toggles
  showBPA: boolean;
  showWPA: boolean;
  showTarget: boolean;

  // Algorithm Trainer settings
  trainerShowCaseName: boolean; // reveal the case name/group after stopping
  trainerRandomAUF: boolean; // random U/U'/U2/none before inverting the scramble

  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setThemeId: (id: string) => void;
  setDefaultEvent: (e: string) => void;
  setCurrentEvent: (e: string) => void;
  setLastSessionForEvent: (eventId: string, sessionId: string) => void;
  set: (patch: Partial<SettingsState>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      accentColor: DEFAULT_ACCENT,
      themeId: 'default',
      defaultEvent: '333',
      currentEvent: '333',
      lastSessionByEvent: {},

      inspection: false,
      inspectionDirection: 'down',
      inspectionVoice: false,
      entryMode: 'keyboard',
      timerUpdate: 'centiseconds',
      solvePrecision: 2,
      holdToStart: true,
      holdDuration: 550,
      startSound: false,
      celebratePBs: true,
      carrotNotation: false,

      showBPA: true,
      showWPA: true,
      showTarget: true,

      trainerShowCaseName: true,
      trainerRandomAUF: true,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setThemeId: (themeId) => {
        const preset = THEME_PRESETS.find((p) => p.id === themeId) ?? THEME_PRESETS[0];
        set({ themeId, accentColor: preset.accent });
      },
      setDefaultEvent: (defaultEvent) => set({ defaultEvent }),
      setCurrentEvent: (currentEvent) => set({ currentEvent }),
      setLastSessionForEvent: (eventId, sessionId) =>
        set((s) => ({ lastSessionByEvent: { ...s.lastSessionByEvent, [eventId]: sessionId } })),
      set: (patch) => set(patch),
    }),
    { name: 'scc-settings' },
  ),
);

// Apply the theme class to <html> whenever it changes.
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

// Convert hex color to space-separated RGB channels for Tailwind CSS variable format.
function toChannels(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function darkenHex(hex: string, amount = 0.15): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function applyAccentColor(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--color-accent', toChannels(hex));
  root.style.setProperty('--color-accent-hover', toChannels(darkenHex(hex)));
}

// Applies a theme preset's background/card/border palette (everything but
// accent, which is tracked separately so it stays customizable on its own).
export function applyThemePalette(themeId: string) {
  const preset = THEME_PRESETS.find((p) => p.id === themeId) ?? THEME_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty('--color-bg', toChannels(preset.bg));
  root.style.setProperty('--color-card', toChannels(preset.card));
  root.style.setProperty('--color-card-hover', toChannels(preset.cardHover));
  root.style.setProperty('--color-border', toChannels(preset.border));
}
