import { Link } from 'react-router-dom';
import '@cubing/icons';
import { ALL_EVENTS } from '@scc/shared';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { RotatingCaseDiagram } from '../../components/CubeDiagram';
import { TILES } from './tiles';

// A scrambled-looking 3x3 for the hero's interactive centerpiece — not tied
// to any real case (this page has no notion of "solving" anything), just
// something visually busy enough to look like an actual scramble rather
// than a suspiciously tidy cube.
//
// Passed to RotatingCaseDiagram's `setup` prop, not `alg` — without an
// explicit `setup`, the component treats `alg` as a *solution* and displays
// its inverse (the standard case-diagram convention elsewhere in the app).
// `setup` is the authoritative override that's shown exactly as written, so
// it's the only way to make the cube literally show the state this
// scramble produces, not the state its inverse would.
const HERO_SCRAMBLE = "D' L D2 L F2 L2 U' R2 D L2 D' F L R2 U' R' U' L'";

// @cubing/icons prefixes official WCA events with "event-" and everything
// else with "unofficial-" — and the unofficial class names don't always
// match our own event ids verbatim (its redi cube glyph is
// "unofficial-redi", not "unofficial-redi_cube"), so this maps our three
// unofficial extras to their real class suffix instead of assuming a
// single "event-" prefix works for every id.
const UNOFFICIAL_ICON_CLASS: Record<string, string> = {
  kilominx: 'unofficial-kilominx',
  fto: 'unofficial-fto',
  redi_cube: 'unofficial-redi',
};

// Puzzle-icon marquee: every event the site generates scrambles for, not
// just the two most-used ones — this is the landing page's answer to "what
// does it actually cover," shown rather than enumerated in prose (prose
// listing exact events is exactly the kind of detail that goes stale, see
// tiles.ts's doc comment). Content is duplicated once so a -50% translate
// loops seamlessly (see .animate-marquee in index.css).
function PuzzleChip({ eventId, name }: { eventId: string; name: string }) {
  const iconClass = UNOFFICIAL_ICON_CLASS[eventId] ?? `event-${eventId}`;
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-card border border-border shrink-0">
      <span className={`cubing-icon ${iconClass}`} style={{ fontSize: 22, lineHeight: 1 }} />
      <span className="text-sm font-semibold">{name}</span>
    </div>
  );
}

function PuzzleMarquee() {
  const track = (
    <>
      {ALL_EVENTS.map((e) => (
        <PuzzleChip key={e.id} eventId={e.id} name={e.name} />
      ))}
    </>
  );
  return (
    <div
      className="flex gap-3 w-max animate-marquee"
      style={{ animationPlayState: 'running' }}
      onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
      onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
    >
      <div className="flex gap-3 pr-3">{track}</div>
      <div className="flex gap-3 pr-3" aria-hidden="true">
        {track}
      </div>
    </div>
  );
}

// Feature card used both for the two spotlighted features (bigger, with a
// decorative visual) and the smaller supporting grid below.
function FeatureCard({
  icon, label, description, spotlight, visual,
}: {
  icon: (typeof TILES)[number]['icon'];
  label: string;
  description: string;
  spotlight?: boolean;
  visual?: React.ReactNode;
}) {
  return (
    <div className={`card flex flex-col gap-4 ${spotlight ? 'p-6 md:p-8' : 'p-6'}`}>
      <div className="flex items-start justify-between gap-4">
        <span className={`rounded-xl bg-accent/15 text-accent grid place-items-center shrink-0 ${spotlight ? 'w-12 h-12' : 'w-11 h-11'}`}>
          <Icon name={icon} size={spotlight ? 26 : 24} />
        </span>
        {visual}
      </div>
      <div>
        <div className={`font-bold ${spotlight ? 'text-xl' : 'text-lg'}`}>{label}</div>
        <div className="text-muted text-sm mt-1.5 leading-relaxed">{description}</div>
      </div>
    </div>
  );
}

// Purely decorative mock digit readout for the Timer spotlight card — not a
// real running timer, just a glanceable "this is what it looks like" cue.
function TimerVisual() {
  return (
    <div className="font-mono text-2xl font-bold text-accent tabular-nums tracking-tight shrink-0">
      7.42
    </div>
  );
}

function AlgVisual() {
  return (
    <div className="shrink-0 rounded-lg overflow-hidden opacity-90">
      <RotatingCaseDiagram alg="R U R' U R U2 R'" size={56} defaultLat={35} puzzle="3x3x3" />
    </div>
  );
}

// Shown at "/" to a signed-out visitor (see App.tsx's HomeRoute — a signed-in
// visitor gets HomePage instead). This is the site's actual front door: a
// standalone marketing page, not an in-app screen — Layout.tsx skips the
// sidebar/nav chrome for it entirely and doesn't constrain its width, so
// this owns its own header and lays out full-bleed sections itself.
//
// The feature grid intentionally does NOT link into the app (unlike
// HomePage's identical-looking tiles) — this page is meant to be read as a
// showcase of what the site offers, with exactly one way in (the CTA
// buttons), not a grid of shortcuts. It's still the exact same TILES data
// HomePage uses (see tiles.ts) so the feature set is never described two
// different ways.
export default function LandingPage() {
  const [timerTile, calcTile, algTile, ...restTiles] = TILES;

  return (
    <div>
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 md:px-8 flex items-center justify-between py-6">
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
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full bg-accent/20 blur-[120px]"
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-4 md:px-8 pt-8 pb-16 md:pt-14 md:pb-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent text-xs font-semibold mb-5">
              <Icon name="sparkle" size={13} />
              The all-in-one speedcubing platform
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Train harder.
              <br />
              <span className="font-display italic font-medium text-accent">Solve faster.</span>
            </h1>
            <p className="text-muted max-w-lg mx-auto lg:mx-0 mt-5 text-lg leading-relaxed">
              Everything a cuber needs, all in one place.
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-3 mt-8">
              <Link to="/login?mode=register" className="btn-primary px-6 py-3 text-base w-full sm:w-auto">
                Create free account <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/timer" className="btn-ghost px-6 py-3 text-base w-full sm:w-auto">
                Try the Timer
              </Link>
            </div>
            <p className="text-xs text-muted mt-3">No account needed to start timing — sign up later to save your solves.</p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="card p-8 md:p-10">
              <RotatingCaseDiagram alg={HERO_SCRAMBLE} setup={HERO_SCRAMBLE} size={260} defaultLat={20} puzzle="3x3x3" />
            </div>
            <span className="text-xs text-muted">Drag to look around</span>
          </div>
        </div>
      </section>

      {/* Puzzle marquee */}
      <section className="border-y border-border bg-card/40 py-6 overflow-hidden">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted mb-4">
          Every WCA event, plus a few extras
        </p>
        <div className="[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <PuzzleMarquee />
        </div>
      </section>

      {/* Feature showcase */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-extrabold">Everything you need, in one place</h2>
          <p className="text-muted mt-2">No juggling five different sites and spreadsheets.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <FeatureCard icon={timerTile.icon} label={timerTile.label} description={timerTile.description} spotlight visual={<TimerVisual />} />
          <FeatureCard icon={algTile.icon} label={algTile.label} description={algTile.description} spotlight visual={<AlgVisual />} />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard icon={calcTile.icon} label={calcTile.label} description={calcTile.description} />
          {restTiles.map((t) => (
            <FeatureCard key={t.label} icon={t.icon} label={t.label} description={t.description} />
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-6xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <div className="card bg-gradient-to-br from-accent/15 via-card to-card p-10 md:p-14 text-center">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight">
            Ready to drop your <span className="font-display italic font-medium text-accent">times</span>?
          </h2>
          <p className="text-muted mt-3 max-w-md mx-auto">
            Create a free account to save your solves, sync your algorithm progress, and battle friends.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
            <Link to="/login?mode=register" className="btn-primary px-6 py-3 text-base w-full sm:w-auto">
              Create free account <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/timer" className="btn-ghost px-6 py-3 text-base w-full sm:w-auto">
              Try it first, no account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={22} className="shrink-0" />
            <span className="font-bold text-sm">
              Speedcubing <span className="text-accent">Central</span>
            </span>
          </div>
          <a
            href="https://discord.com/invite/Zhq6q6WKfH"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted hover:text-[#5865F2] transition-colors"
          >
            Join our Discord
          </a>
        </div>
      </footer>
    </div>
  );
}
