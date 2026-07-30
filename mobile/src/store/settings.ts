import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_PRESETS, getPalette, type Palette } from '../theme';

export type Theme = 'dark' | 'light';
export type InspectionDirection = 'down' | 'up';
export type EntryMode = 'keyboard' | 'typing';
export type TimerUpdate = 'centiseconds' | 'deciseconds' | 'seconds' | 'hidden';

export const DEFAULT_ACCENT = '#2b72ff';

// Mirror of client/src/store/settings.ts, with the same keys and the same
// defaults so the two apps behave identically out of the box.
//
// Two deliberate differences:
//
//  * Storage is AsyncStorage rather than localStorage. These are display
//    preferences, not credentials, so unencrypted storage is fine. Tokens go
//    to expo-secure-store instead (see lib/tokens.ts).
//  * Settings are per-device, exactly as on web (the web client persists them
//    to localStorage, which is also per-browser). This is intentional and is
//    NOT the kind of client-side state that could make a user's *data* diverge
//    across platforms: solves, sessions and reconstructions all come from the
//    server. Only "do I want inspection on" is local.
//
// `entryMode` is carried over for parity of the underlying data flow, but note
// mobile's keyboard mode means touch-and-hold on the timer surface. There's no
// spacebar on a phone. See features/timer/useTimerEngine.ts.
interface SettingsState {
  theme: Theme;
  accentColor: string;
  themeId: string;
  defaultEvent: string;
  currentEvent: string;
  lastSessionByEvent: Record<string, string>;

  inspection: boolean;
  inspectionDirection: InspectionDirection;
  inspectionVoice: boolean;
  entryMode: EntryMode;
  timerUpdate: TimerUpdate;
  solvePrecision: 2 | 3;
  holdToStart: boolean;
  holdDuration: number;
  startSound: boolean;
  celebratePBs: boolean;
  carrotNotation: boolean;

  showBPA: boolean;
  showWPA: boolean;
  showTarget: boolean;

  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setThemeId: (id: string) => void;
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

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setThemeId: (themeId) => {
        const preset = THEME_PRESETS.find((p) => p.id === themeId) ?? THEME_PRESETS[0];
        set({ themeId, accentColor: preset.accent });
      },
      setCurrentEvent: (currentEvent) => set({ currentEvent }),
      setLastSessionForEvent: (eventId, sessionId) =>
        set((s) => ({ lastSessionByEvent: { ...s.lastSessionByEvent, [eventId]: sessionId } })),
      set: (patch) => set(patch),
    }),
    {
      name: 'scc-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist preferences, never the derived setters.
      partialize: (s) => ({
        theme: s.theme,
        accentColor: s.accentColor,
        themeId: s.themeId,
        defaultEvent: s.defaultEvent,
        currentEvent: s.currentEvent,
        lastSessionByEvent: s.lastSessionByEvent,
        inspection: s.inspection,
        inspectionDirection: s.inspectionDirection,
        inspectionVoice: s.inspectionVoice,
        entryMode: s.entryMode,
        timerUpdate: s.timerUpdate,
        solvePrecision: s.solvePrecision,
        holdToStart: s.holdToStart,
        holdDuration: s.holdDuration,
        startSound: s.startSound,
        celebratePBs: s.celebratePBs,
        carrotNotation: s.carrotNotation,
        showBPA: s.showBPA,
        showWPA: s.showWPA,
        showTarget: s.showTarget,
      }),
    },
  ),
);

// Convenience hook: the resolved palette for the current theme settings.
export function usePalette(): Palette {
  const theme = useSettings((s) => s.theme);
  const themeId = useSettings((s) => s.themeId);
  const accentColor = useSettings((s) => s.accentColor);
  return getPalette(themeId, theme, accentColor);
}
