import { create } from 'zustand';

// Transient UI state that outlives no session and belongs to no screen.
//
// The mobile counterpart of client/src/store/ui.ts, which carries `focusMode`
// for the same reason: the Timer needs to tell chrome it does not own to get
// out of the way, and threading a flag up through a navigator to do that is
// worse than a small store.
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
  /**
   * The colour the Timer screen is currently painted, or null when it is not
   * running an attempt.
   *
   * The Timer tints its whole background by phase, Stackmat-style: yellow under
   * your hands, green when it is armed, a wash of accent while running. That
   * tint is the screen's background, so it stops at the screen's edge, and the
   * tab bar sits outside it. Publishing the colour lets the bar's area be
   * painted to match, which is the difference between the tint covering the
   * display and stopping short in a band at the bottom.
   */
  timerTint: string | null;
  /** Set together, so a phase change is one store update rather than two. */
  setTimerImmersion: (immersive: boolean, timerTint: string | null) => void;
}

export const useUi = create<UiState>((set) => ({
  immersive: false,
  timerTint: null,
  setTimerImmersion: (immersive, timerTint) => set({ immersive, timerTint }),
}));
