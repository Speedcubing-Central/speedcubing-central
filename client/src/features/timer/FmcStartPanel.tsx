import { Icon } from '../../components/Icon';
import { FMC_TIME_LIMIT_MS } from './useFmcEngine';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// The idle, pre-attempt state — deliberately doesn't render the scramble at
// all (TimerPage doesn't even mount <ScramblePanel> while this is showing),
// since the scramble should stay hidden until the attempt genuinely starts,
// same as a real WCA FMC round. Once `start` is called, TimerPage swaps its
// entire body over to FmcAttemptView instead of rendering this any longer.
export function FmcStartPanel({ inputBlocked, start }: { inputBlocked: boolean; start: () => void }) {
  return (
    <div className="card flex-1 min-h-0 flex flex-col items-center justify-center gap-5 p-6">
      <div className="flex flex-col items-center gap-1">
        <div className="font-mono font-bold tabular-nums leading-none text-6xl md:text-7xl text-gray-900 dark:text-gray-100">
          {formatCountdown(FMC_TIME_LIMIT_MS)}
        </div>
        <p className="text-muted text-sm text-center">You have 60 minutes once you start the attempt</p>
      </div>
      <button className="btn-primary px-6 py-3 text-base" onClick={start} disabled={inputBlocked}>
        <Icon name="play" size={18} /> Start attempt
      </button>
    </div>
  );
}
