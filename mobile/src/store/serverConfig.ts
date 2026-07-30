import { create } from 'zustand';
import { api } from '../lib/api';

// What the server we're pointed at tells us about itself (GET /api/auth/config).
//
// The web client gets both of these at build time, wcaEnabled indirectly and
// `betaSite` from VITE_BETA_SITE (client/src/lib/betaSite.ts), because the
// main site and the beta site are two separate builds of this repo. A mobile
// binary can't work that way: it's one build whose API base URL decides which
// deployment it's talking to, so it has to ask at runtime. See
// server/src/routes/auth.ts's /config handler.
interface ServerConfigState {
  wcaEnabled: boolean;
  // True when the server this build points at is the beta deployment, i.e.
  // the runtime equivalent of the web client's IS_BETA_SITE.
  betaSite: boolean;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useServerConfig = create<ServerConfigState>((set) => ({
  wcaEnabled: false,
  betaSite: false,
  loaded: false,
  load: async () => {
    try {
      const { data } = await api.get<{ wcaEnabled?: boolean; betaSite?: boolean }>('/auth/config');
      set({ wcaEnabled: !!data.wcaEnabled, betaSite: !!data.betaSite, loaded: true });
    } catch {
      // Unreachable server: assume the safe defaults (no WCA login button, not
      // the beta site). Defaulting betaSite to false means beta-only features
      // stay hidden when we can't confirm otherwise, which is the correct
      // direction to fail in for a gate.
      set({ wcaEnabled: false, betaSite: false, loaded: true });
    }
  },
}));
