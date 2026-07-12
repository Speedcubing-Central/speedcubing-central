import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'timer', title: 'Timer', desc: 'Spacebar & touch timing, inspection, live Ao5/Ao12/Ao100, multi-session.' },
  { icon: 'cube', title: 'Alg Trainer', desc: 'OLL, PLL, F2L, COLL & ZBLL with spaced-repetition drills.' },
  { icon: 'trophy', title: 'WCA Results', desc: 'Look up any competitor and browse their full result history.' },
  { icon: 'swords', title: 'Battle Mode', desc: 'Race a friend head-to-head on identical scrambles in real time.' },
  { icon: 'film', title: 'Reconstruction', desc: '3D playback of any scramble + solution, move by move.' },
];

export default function Landing() {
  return (
    <div>
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

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-6 hover:bg-gray-100 dark:hover:bg-card-hover transition-colors">
            <div className="w-11 h-11 rounded-lg bg-accent/15 text-accent grid place-items-center mb-3">
              <Icon name={f.icon} size={24} />
            </div>
            <h3 className="font-bold text-lg">{f.title}</h3>
            <p className="text-muted text-sm mt-1">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
