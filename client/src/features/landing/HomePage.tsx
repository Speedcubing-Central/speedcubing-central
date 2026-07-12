import { Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { Icon, type IconName } from '../../components/Icon';

// Single source of truth for the site's feature set — the tile grid below
// is shared by both logged-out and logged-in visitors (see App.tsx's
// HomeRoute). This used to be two separate components (Landing/Dashboard)
// with their own hand-written feature copy, which drifted out of sync with
// each other and with the sidebar nav (e.g. "Pro Timer"/"Alg Trainer"/"WCA
// Results"/"Battle Mode" here vs. "Timer"/"Algorithms"/"Results"/"Battle"
// in Layout.tsx) — exactly the kind of inconsistency that makes the site
// look unfinished and gives wrong answers to anyone (human or AI) skimming
// the page for what it does. Labels below match Layout.tsx's NAV_ITEMS
// verbatim for that reason. Only the header above the tiles still differs
// by auth state (marketing hero + sign-in CTA for guests, a plain welcome
// line for logged-in users) — that's inherently tied to `user` and isn't
// the kind of content that can drift the way duplicated feature copy did.
// Descriptions are deliberately general rather than enumerating exact
// mechanics (specific average sizes, algorithm-set names, player counts,
// ...) — those are the parts most likely to change as the app grows, and a
// stale enumeration here is exactly what previously made the page actively
// wrong (e.g. advertising a ZBLL set that doesn't exist, or "head-to-head"
// Battle after it grew past 2 players). Prefer describing what a feature is
// for over what it currently supports down to the last detail.
const TILES: { to: string; icon: IconName; label: string; description: string }[] = [
  { to: '/timer', icon: 'timer', label: 'Timer', description: 'Spacebar & touch timing, inspection, and live rolling averages across as many sessions as you need.' },
  { to: '/calculator', icon: 'calculator', label: 'Calculator', description: 'Calculate your averages and means, and find the time you need for a new PB.' },
  { to: '/algorithms', icon: 'cube', label: 'Algorithms', description: 'Browse and drill algorithms for multiple puzzles, with spaced-repetition training to help them stick.' },
  { to: '/battle', icon: 'swords', label: 'Battle', description: 'Compete against others on identical scrambles in real time.' },
  { to: '/reconstruction', icon: 'film', label: 'Reconstruction', description: '3D playback of any scramble + solution, move by move.' },
  { to: '/results', icon: 'trophy', label: 'Results', description: 'Look up any competitor and browse their full result history.' },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      {user ? (
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold">Welcome back, {user.displayName}.</h1>
          <p className="text-muted mt-1">What would you like to do?</p>
        </div>
      ) : (
        <section className="text-center py-12 md:py-20">
          <div className="inline-block px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-semibold mb-4">
            The all-in-one speedcubing platform
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
            Train. Compete. <span className="text-accent">Improve.</span>
          </h1>
          <p className="text-muted max-w-xl mx-auto mt-4 text-lg">
            A timer, algorithm trainer, WCA results lookup, and live battles — everything a cuber needs in
            one place.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <Link to="/timer" className="btn-primary px-6 py-3 text-base">
              Start Timing <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/login" className="btn-ghost px-6 py-3 text-base">
              Sign in with WCA
            </Link>
          </div>
        </section>
      )}

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="card p-6 flex flex-col gap-4 hover:border-accent/50 transition-colors group text-left"
          >
            <span className="w-11 h-11 rounded-lg bg-accent/15 text-accent grid place-items-center group-hover:bg-accent/25 transition-colors">
              <Icon name={t.icon} size={24} />
            </span>
            <div>
              <div className="font-bold text-lg">{t.label}</div>
              <div className="text-muted text-sm mt-1">{t.description}</div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
