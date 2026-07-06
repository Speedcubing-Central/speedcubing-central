import { Link } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { Icon, type IconName } from '../../components/Icon';

const TILES: { to: string; icon: IconName; label: string; description: string }[] = [
  { to: '/timer', icon: 'timer', label: 'Timer', description: 'Time your solves with inspection, sessions, and live averages.' },
  { to: '/calculator', icon: 'calculator', label: 'Calculator', description: 'Calculate Ao5 and Mo3 averages and find your target time.' },
  { to: '/algorithms', icon: 'cube', label: 'Algorithms', description: 'Browse and drill algorithms for 3×3 and 2×2, with more puzzles and sets coming soon.' },
  { to: '/battle', icon: 'swords', label: 'Battle', description: 'Compete head-to-head in real-time with other solvers.' },
  { to: '/reconstruction', icon: 'film', label: 'Reconstruction', description: '3D playback of any scramble + solution, move by move.' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold">Welcome back, {user?.displayName}.</h1>
        <p className="text-muted mt-1">What would you like to do?</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="card p-6 flex flex-col gap-4 hover:border-accent/50 transition-colors group"
          >
            <span className="w-12 h-12 rounded-xl bg-accent/15 text-accent grid place-items-center group-hover:bg-accent/25 transition-colors">
              <Icon name={t.icon} size={26} />
            </span>
            <div>
              <div className="font-bold text-lg">{t.label}</div>
              <div className="text-sm text-muted mt-1 leading-relaxed">{t.description}</div>
            </div>
            <div className="flex items-center gap-1 text-accent text-sm font-semibold mt-auto">
              Open <Icon name="arrowRight" size={14} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
