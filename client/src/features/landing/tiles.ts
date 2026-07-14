import type { IconName } from '../../components/Icon';

// Single source of truth for the site's feature set — shared by the
// logged-in home screen (HomePage) and the logged-out marketing page
// (LandingPage), so the two can never describe the same feature
// differently. This used to be duplicated by hand across two separate
// components (and, further back, drifted to describe removed/renamed
// features entirely) — exactly the kind of inconsistency that makes the
// site look unfinished and gives wrong answers to anyone (human or AI)
// skimming a page for what it does. Labels match Layout.tsx's NAV verbatim
// for the same reason.
//
// Descriptions are deliberately general rather than enumerating exact
// mechanics (specific average sizes, algorithm-set names, player counts,
// ...) — those are the parts most likely to change as the app grows, and a
// stale enumeration here is exactly what previously made the page actively
// wrong (e.g. advertising a ZBLL set that doesn't exist, or "head-to-head"
// Battle after it grew past 2 players). Prefer describing what a feature is
// for over what it currently supports down to the last detail.
export const TILES: { to: string; icon: IconName; label: string; description: string }[] = [
  { to: '/timer', icon: 'timer', label: 'Timer', description: 'Spacebar & touch timing, inspection, and live rolling averages across as many sessions as you need.' },
  { to: '/calculator', icon: 'calculator', label: 'Calculator', description: 'Calculate your averages and means, and find the time you need for a new PB.' },
  { to: '/algorithms', icon: 'cube', label: 'Algorithms', description: 'Browse and drill algorithms for multiple puzzles, with spaced-repetition training to help them stick.' },
  { to: '/battle', icon: 'swords', label: 'Battle', description: 'Compete against others on identical scrambles in real time.' },
  { to: '/reconstruction', icon: 'film', label: 'Reconstruction', description: '3D playback of any scramble + solution, move by move.' },
  { to: '/results', icon: 'trophy', label: 'Results', description: 'Look up any competitor and browse their full result history.' },
];
