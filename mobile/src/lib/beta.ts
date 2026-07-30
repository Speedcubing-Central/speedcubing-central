import { useAuth } from '../store/auth';
import { useServerConfig } from '../store/serverConfig';

// ── Mirroring the web client's beta gating ────────────────────────────────
//
// Verified against the actual current implementation rather than assumed.
// This is NOT a per-feature `betaAccess` check on the web side. As of now it's
// still two cooperating layers:
//
//   1. Deployment layer. `BETA_SITE` (server/src/env.ts) / `VITE_BETA_SITE`
//      (client/src/lib/betaSite.ts's IS_BETA_SITE) marks a whole deployment as
//      the beta site. Beta-only features don't merely hide on the main site.
//      They don't exist there at all: the Team Relay routes and button
//      (client/src/App.tsx, features/relays/RelaysPage.tsx), the relay team
//      REST endpoints (server/src/routes/relays.ts), the Socket.io relay
//      handlers (server/src/socket.ts), and the Square-1 alg set
//      (features/alg-trainer/AlgTrainerPage.tsx's `available: IS_BETA_SITE`)
//      are all absent unless the flag is set.
//   2. Per-user layer. `User.betaAccess` decides who may use the beta site once
//      they reach it, enforced whole-site, not per-feature, by
//      client/src/App.tsx's RequireBetaAccess and server-side by
//      server/src/auth/betaGate.ts (applied to all of /api except /api/health
//      and /api/auth) plus the same check inside Socket.io's io.use().
//
// So on the web the two layers compose to: a beta-only feature is usable
// exactly when you're on the beta deployment AND your account has betaAccess.
// Nobody without betaAccess ever gets past RequireBetaAccess to see the Team
// Relay button in the first place.
//
// Mobile reproduces that composition rather than inventing a third scheme. The
// only necessary adaptation is *how* layer 1 is detected: a single app binary
// can't be "the beta build" the way a Vite build can, so instead of a
// compile-time constant it asks the server it's actually pointed at
// (GET /api/auth/config -> betaSite; see store/serverConfig.ts). Layer 2 is
// identical. The same `betaAccess` field off the same /auth/me payload.
//
// Net effect, which is what was asked for: the Team Relay button/flow and the
// Square-1 algorithm set are hidden for users without betaAccess, while the
// rest of Relays and the rest of the Algorithm Trainer are fully available to
// everyone, exactly as on web.

export interface BetaState {
  // Layer 1: is the server we're talking to the beta deployment?
  isBetaSite: boolean;
  // Layer 2: does the signed-in account have beta access?
  hasBetaAccess: boolean;
  // Both layers satisfied. The gate every beta-only feature checks.
  betaFeaturesEnabled: boolean;
  // True when we're on the beta site but this user isn't allowed in. Drives
  // the whole-app block screen, mirroring RequireBetaAccess on web.
  blockedFromBetaSite: boolean;
}

export function useBeta(): BetaState {
  const user = useAuth((s) => s.user);
  const authLoading = useAuth((s) => s.loading);
  const isBetaSite = useServerConfig((s) => s.betaSite);
  const configLoaded = useServerConfig((s) => s.loaded);

  const hasBetaAccess = !!user?.betaAccess;
  return {
    isBetaSite,
    hasBetaAccess,
    betaFeaturesEnabled: isBetaSite && hasBetaAccess,
    // Only assert "blocked" once both the server config and the auth check
    // have actually resolved. Otherwise the block screen would flash on
    // every cold start before we know who the user is.
    blockedFromBetaSite: configLoaded && !authLoading && isBetaSite && !hasBetaAccess,
  };
}
