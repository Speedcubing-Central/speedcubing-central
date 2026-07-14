import { Link } from 'react-router-dom';
import type { PublicUser } from '@scc/shared';
import { Icon } from '../../components/Icon';
import { TILES } from './tiles';

// The logged-in home screen — always just a short welcome line and the
// tile grid, no marketing fluff. Only ever rendered for an authenticated
// user (see App.tsx's HomeRoute, which shows LandingPage to guests
// instead), so `user` is required rather than read from useAuth() and
// branched on internally — that keeps this component's output identical
// on every render instead of carrying its own guest-vs-authed conditional.
export default function HomePage({ user }: { user: PublicUser }) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome back, {user.displayName}.</h1>
        <p className="text-muted mt-1">What would you like to do?</p>
      </div>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="card card-interactive p-6 flex flex-col gap-4 group text-left"
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
