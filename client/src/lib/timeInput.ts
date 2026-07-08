import type { Penalty } from '@scc/shared';

// Parse a time string. For pure-digit inputs (no . or :), use precision to
// interpret: the last `precision` digits are the fractional part.
// e.g. precision=2, "1258" → 12.58s; "12684" → 1:26.84
export function parseTimeInput(raw: string, precision: number): { time: number; penalty: Penalty } | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^dnf$/i.test(t)) return { time: 0, penalty: 'DNF' };

  let penalty: Penalty = 'NONE';
  let s = t;
  if (s.endsWith('+')) {
    penalty = 'PLUS2';
    s = s.slice(0, -1);
  }

  let ms: number;

  if (/^\d+$/.test(s) && precision > 0) {
    const frac = parseInt(s.slice(-precision).padStart(precision, '0'), 10);
    const intStr = s.slice(0, -precision) || '0';
    const intSec = parseInt(intStr, 10);
    const minutes = Math.floor(intSec / 100);
    const seconds = intSec % 100;
    ms = (minutes * 60 + seconds) * 1000 + frac * Math.pow(10, 3 - precision);
  } else if (/^\d+$/.test(s) && precision === 0) {
    ms = parseInt(s, 10) * 1000;
  } else if (s.includes(':')) {
    const [m, sec] = s.split(':');
    ms = (parseInt(m, 10) * 60 + parseFloat(sec)) * 1000;
  } else {
    ms = parseFloat(s) * 1000;
  }

  if (isNaN(ms) || ms < 0) return null;
  return { time: Math.round(ms), penalty };
}
