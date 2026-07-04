import { useState, useMemo, useRef } from 'react';
import { trimmedAverage, mean, formatTime, type TimedSolve, type Penalty } from '@scc/shared';

type Mode = 'ao5' | 'mo3';

function parseInput(s: string): TimedSolve | null {
  const t = s.trim();
  if (!t) return null;
  if (/^dnf$/i.test(t)) return { time: 0, penalty: 'DNF' };
  let penalty: Penalty = 'NONE';
  let raw = t;
  if (raw.endsWith('+')) { penalty = 'PLUS2'; raw = raw.slice(0, -1); }
  let ms: number;
  if (raw.includes(':')) {
    const [min, sec] = raw.split(':');
    ms = (parseInt(min, 10) * 60 + parseFloat(sec)) * 1000;
  } else {
    ms = parseFloat(raw) * 1000;
  }
  if (isNaN(ms) || ms < 0) return null;
  return { time: Math.round(ms), penalty };
}

function effMs(s: TimedSolve): number {
  if (s.penalty === 'DNF') return Infinity;
  return s.time + (s.penalty === 'PLUS2' ? 2000 : 0);
}

function fmtTime(ms: number | null, isDNF: boolean): string {
  if (isDNF) return 'DNF';
  if (ms === null) return '—';
  return formatTime(Math.round(ms));
}

// Given 4 known ao5 solves, compute the required 5th solve time to hit goalMs.
// Returns a formatted time, "Impossible", or "Guaranteed".
function ao5Target(solves4: TimedSolve[], goalMs: number): string {
  const bpa = trimmedAverage([...solves4, { time: 0, penalty: 'NONE' }]);
  const wpa = trimmedAverage([...solves4, { time: 0, penalty: 'DNF' }]);
  const bpaMs = bpa.isDNF ? Infinity : (bpa.value ?? Infinity);
  const wpaMs = wpa.isDNF ? Infinity : (wpa.value ?? Infinity);
  if (bpaMs > goalMs) return 'Impossible';
  if (wpaMs <= goalMs) return 'Guaranteed';
  // Target: X = 3*goal − s2 − s3  (2nd and 3rd smallest finite times)
  const finite = solves4.map(effMs).filter(isFinite).sort((a, b) => a - b);
  const s2 = finite[1] ?? 0;
  const s3 = finite[2] ?? 0;
  const target = 3 * goalMs - s2 - s3;
  if (target <= 0) return 'Impossible';
  return formatTime(Math.round(target));
}

// Given 2 known mo3 solves, compute the required 3rd solve time to hit goalMs.
function mo3Target(solves2: TimedSolve[], goalMs: number): string {
  if (solves2.some(s => s.penalty === 'DNF')) return 'Impossible';
  const sum = solves2.reduce((acc, s) => acc + effMs(s), 0);
  const target = 3 * goalMs - sum;
  if (target <= 0) return 'Impossible';
  return formatTime(Math.round(target));
}

export default function CalculatorPage() {
  const [mode, setMode] = useState<Mode>('ao5');
  const [times, setTimes] = useState(['', '', '', '', '']);
  const [goal, setGoal] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const count = mode === 'ao5' ? 5 : 3;

  const parsed = useMemo(
    () => times.slice(0, count).map(parseInput),
    [times, count],
  );

  const goalSolve = useMemo(() => parseInput(goal), [goal]);

  // How many valid (non-null) parses are there?
  const validCount = parsed.filter(Boolean).length;
  const allFilled = validCount === count;

  // First 4 (ao5) or first 2 (mo3) valid solves — for BPA/WPA/target
  const firstGroup = useMemo(() => {
    const needed = mode === 'ao5' ? 4 : 2;
    return parsed.filter((s): s is TimedSolve => s !== null).slice(0, needed);
  }, [parsed, mode]);

  // BPA / WPA from the first 4 ao5 solves (shown with 4 or 5)
  const bpa = useMemo(() => {
    if (mode !== 'ao5' || firstGroup.length < 4) return null;
    return trimmedAverage([...firstGroup, { time: 0, penalty: 'NONE' }]);
  }, [mode, firstGroup]);

  const wpa = useMemo(() => {
    if (mode !== 'ao5' || firstGroup.length < 4) return null;
    return trimmedAverage([...firstGroup, { time: 0, penalty: 'DNF' }]);
  }, [mode, firstGroup]);

  // Main result (all solves filled)
  const mainResult = useMemo(() => {
    if (!allFilled) return null;
    const solves = parsed.filter((s): s is TimedSolve => s !== null);
    return mode === 'ao5' ? trimmedAverage(solves) : mean(solves);
  }, [parsed, allFilled, mode]);

  // Target (one solve remaining + goal set)
  const target = useMemo(() => {
    if (allFilled) return null; // already complete
    if (!goalSolve || goalSolve.penalty === 'DNF') return null;
    const goalMs = effMs(goalSolve);
    if (mode === 'ao5') {
      if (firstGroup.length < 4) return null;
      return ao5Target(firstGroup, goalMs);
    } else {
      if (firstGroup.length < 2) return null;
      return mo3Target(firstGroup, goalMs);
    }
  }, [allFilled, goalSolve, mode, firstGroup]);

  const handleChange = (i: number, val: string) => {
    setTimes(prev => { const next = [...prev]; next[i] = val; return next; });
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = inputRefs.current[i + 1];
      if (next) next.focus();
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setTimes(['', '', '', '', '']);
    setGoal('');
  };

  const clear = () => {
    setTimes(['', '', '', '', '']);
    setGoal('');
    inputRefs.current[0]?.focus();
  };

  // Decide what to show
  const showBPAWPA = mode === 'ao5' && firstGroup.length >= 4;
  const showTarget = target !== null;
  const showMain = allFilled && mainResult !== null;
  const hasResults = showMain || showBPAWPA || showTarget;

  return (
    <div className="max-w-md mx-auto">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {(['ao5', 'mo3'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={mode === m ? 'btn-primary' : 'btn-ghost'}
          >
            {m === 'ao5' ? 'Ao5' : 'Mo3'}
          </button>
        ))}
      </div>

      {/* Input card */}
      <div className="card p-5 mb-4">
        <p className="text-xs text-muted mb-4">
          Supports <span className="font-mono">12.34</span>, <span className="font-mono">1:23.45</span>, <span className="font-mono">DNF</span>, <span className="font-mono">12.34+</span> (for +2).
          Press Enter to advance.
        </p>

        {/* Time inputs */}
        <div className={`grid gap-3 mb-5 ${count === 5 ? 'grid-cols-5' : 'grid-cols-3'}`}>
          {Array.from({ length: count }, (_, i) => {
            const val = times[i] ?? '';
            const ok = parseInput(val);
            const invalid = val.trim() !== '' && ok === null;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted">{i + 1}</span>
                <input
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  value={val}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  placeholder="—"
                  className={[
                    'input font-mono text-center w-full px-1',
                    invalid ? 'border-red-500' : ok ? 'border-accent/50' : '',
                  ].join(' ')}
                />
              </div>
            );
          })}
        </div>

        {/* Goal input */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted whitespace-nowrap">Goal</label>
          <input
            ref={el => { inputRefs.current[count] = el; }}
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); inputRefs.current[0]?.focus(); } }}
            placeholder="e.g. 10.00"
            className={[
              'input font-mono flex-1',
              goalSolve ? 'border-accent/50' : goal.trim() ? 'border-red-500' : '',
            ].join(' ')}
          />
          <button onClick={clear} className="btn-ghost text-sm">Clear</button>
        </div>
      </div>

      {/* Results card */}
      {hasResults && (
        <div className="card p-5 space-y-4">
          {/* Main result */}
          {showMain && (
            <div className="text-center pb-4 border-b border-border">
              <div className="text-xs text-muted uppercase tracking-widest mb-1">
                {mode === 'ao5' ? 'Average of 5' : 'Mean of 3'}
              </div>
              <div className={`text-5xl font-mono font-bold ${mainResult!.isDNF ? 'text-red-400' : 'text-accent'}`}>
                {fmtTime(mainResult!.value, mainResult!.isDNF)}
              </div>
            </div>
          )}

          {/* BPA / WPA (ao5) */}
          {showBPAWPA && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="BPA" value={fmtTime(bpa!.value, bpa!.isDNF)} />
              <StatCard label="WPA" value={fmtTime(wpa!.value, wpa!.isDNF)} />
            </div>
          )}

          {/* Target */}
          {showTarget && (
            <StatCard
              label={`Target to reach ${goalSolve ? fmtTime(effMs(goalSolve), false) : '—'}`}
              value={target!}
              accent={target === 'Impossible' ? 'red' : target === 'Guaranteed' ? 'green' : undefined}
              large
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  large,
}: {
  label: string;
  value: string;
  accent?: 'red' | 'green';
  large?: boolean;
}) {
  const valueClass = [
    'font-mono font-semibold',
    large ? 'text-xl' : 'text-base',
    accent === 'red' ? 'text-red-400' : accent === 'green' ? 'text-green-400' : '',
  ].join(' ');
  return (
    <div className="bg-gray-50 dark:bg-bg border border-gray-200 dark:border-border rounded-lg p-3">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className={valueClass}>{value}</div>
    </div>
  );
}
