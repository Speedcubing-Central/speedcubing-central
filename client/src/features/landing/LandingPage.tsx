import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { TILES } from './tiles';

// Shown at "/" to a signed-out visitor (see App.tsx's HomeRoute — a signed-in
// visitor gets HomePage instead). This is the site's actual front door: a
// marketing pitch plus a way to jump straight into using it, rather than the
// bare welcome-and-tiles screen a returning signed-in user wants. The tile
// grid below is the exact same TILES data HomePage uses (see its doc
// comment) so the feature set is never described two different ways.
export default function LandingPage() {
  return (
    <div>
      <div className="flex justify-end gap-3 mb-6">
        <Link to="/login" className="btn-ghost px-4 py-2 text-sm">
          Log in
        </Link>
        <Link to="/login?mode=register" className="btn-primary px-4 py-2 text-sm">
          Create account
        </Link>
      </div>

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
        <div className="flex flex-col items-center gap-2 mt-8">
          <Link to="/timer" className="btn-primary px-6 py-3 text-base">
            Try the Timer <Icon name="arrowRight" size={18} />
          </Link>
          <span className="text-xs text-muted">No account needed — sign up later to save your solves</span>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
