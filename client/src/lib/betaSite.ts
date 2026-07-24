// True only when this build was produced for the beta deployment
// (beta.speedcubingcentral.com) — set via VITE_BETA_SITE at build time on
// that hosted service. Never true for the main production build. See
// server/src/env.ts's BETA_SITE for the matching server-side flag.
export const IS_BETA_SITE = import.meta.env.VITE_BETA_SITE === 'true';
