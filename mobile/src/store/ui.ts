import { create } from 'zustand';

// Transient UI state that outlives no session and belongs to no screen.
//
// The mobile counterpart of client/src/store/ui.ts, which carries `focusMode`
// for the same reason: the Timer needs to tell chrome it does not own to get
// out of the way, and threading a flag up through a navigator to do that is
// worse than a one-field store.
interface UiState {
  /**
   * True while an attempt is live (inspecting, holding, armed or running).
   *
   * The Timer already hides its own chrome at this point. The tab bar is not
   * its to hide, though: it belongs to the root navigator, and the bar is fully
   * custom, so React Navigation's `tabBarStyle: { display: 'none' }` never
   * reaches it. This is how the two agree.
   */
  immersive: boolean;
  setImmersive: (immersive: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
}));
