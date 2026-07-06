import clsx from 'clsx';
import { formatScramble, sq1Pairs } from '../lib/scramble';

// Renders a scramble for display. For sq1, each "(a,b)" pair (plus its
// trailing " /", except the last) is its own non-wrapping flex item inside a
// flex-wrap container — the browser decides how many pairs fit per line
// based on the actual rendered width, so a line never gets an orphaned
// slash or pair pushed onto the next row. Other events fall back to
// formatScramble's plain (pre-wrapped) string.
export function ScrambleText({
  scramble,
  eventId,
  className,
}: {
  scramble: string;
  eventId: string;
  className?: string;
}) {
  if (!scramble) return <div className={className}>—</div>;

  if (eventId === 'sq1') {
    return (
      <div className={clsx(className, 'flex flex-wrap justify-center gap-x-2')}>
        {sq1Pairs(scramble).map((pair, i) => (
          <span key={i} className="whitespace-nowrap">
            {pair}
          </span>
        ))}
      </div>
    );
  }

  return <div className={clsx(className, 'whitespace-pre-wrap')}>{formatScramble(scramble, eventId)}</div>;
}
