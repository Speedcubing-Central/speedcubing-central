import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { TILES } from './tiles';

// Shown at "/" to a signed-out visitor (see App.tsx's HomeRoute — a signed-in
// visitor gets HomePage instead). This is the site's actual front door: a
// standalone marketing page, not an in-app screen — Layout.tsx skips the
// sidebar/nav chrome for it entirely, so this owns its own header (logo +
// sign-in links) instead of relying on the sidebar for branding.
//
// The feature grid intentionally does NOT link into the app (unlike
// HomePage's identical-looking tiles) — this page is meant to be read as a
// showcase of what the site offers, with exactly one way in (the "Try the
// Timer" CTA, or the header's sign-in links), not a grid of shortcuts. It's
// still the exact same TILES data HomePage uses (see its doc comment) so
// the feature set is never described two different ways.
export default function LandingPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2">
          <Logo size={32} className="shrink-0" />
          <span className="font-extrabold text-lg leading-tight">
            Speedcubing <span className="text-accent">Central</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost px-4 py-2 text-sm">
            Log in
          </Link>
          <Link to="/login?mode=register" className="btn-primary px-4 py-2 text-sm">
            Create account
          </Link>
        </div>
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

      <section>
        <h2 className="text-center text-2xl font-extrabold mb-8">Everything you need, in one place</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TILES.map((t) => (
            <div key={t.label} className="card p-6 flex flex-col gap-4 text-left">
              <span className="w-11 h-11 rounded-lg bg-accent/15 text-accent grid place-items-center">
                <Icon name={t.icon} size={24} />
              </span>
              <div>
                <div className="font-bold text-lg">{t.label}</div>
                <div className="text-muted text-sm mt-1">{t.description}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
