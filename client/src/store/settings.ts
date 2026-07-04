import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_ACCENT = '#2b72ff';

export type Theme = 'dark' | 'light';
export type InspectionDirection = 'down' | 'up';
export type EntryMode = 'keyboard' | 'typing';
export type TimerUpdate = 'centiseconds' | 'deciseconds' | 'seconds' | 'hidden';

interface SettingsState {
  theme: Theme;
  accentColor: string;
  defaultEvent: string;
  currentEvent: string;
  letteringScheme: 'speffz' | 'custom';

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

  // Stats table column toggles
  showBPA: boolean;
  showWPA: boolean;
  showTarget: boolean;

  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setDefaultEvent: (e: string) => void;
  setCurrentEvent: (e: string) => void;
  setLetteringScheme: (s: 'speffz' | 'custom') => void;
  set: (patch: Partial<SettingsState>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      accentColor: DEFAULT_ACCENT,
      defaultEvent: '333',
      currentEvent: '333',
      letteringScheme: 'speffz',

      inspection: false,
      inspectionDirection: 'down',
      inspectionVoice: false,
      entryMode: 'keyboard',
      timerUpdate: 'centiseconds',
      solvePrecision: 2,
      holdToStart: true,
      holdDuration: 550,
      startSound: false,

      showBPA: true,
      showWPA: true,
      showTarget: true,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setDefaultEvent: (defaultEvent) => set({ defaultEvent }),
      setCurrentEvent: (currentEvent) => set({ currentEvent }),
      setLetteringScheme: (letteringScheme) => set({ letteringScheme }),
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
