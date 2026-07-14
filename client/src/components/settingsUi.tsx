import clsx from 'clsx';

// Shared building blocks for settings modals (Timer, Trainer, ...) so they
// look and behave identically instead of each hand-rolling the same toggle/
// segmented-control/row markup.

export function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative w-10 h-6 rounded-full transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        checked ? 'bg-accent' : 'bg-gray-300 dark:bg-card-hover',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}

// Two/three-way pill selector.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className={clsx('flex gap-1 rounded-lg bg-gray-100 dark:bg-card-hover p-1', disabled && 'opacity-40')}>
      {options.map((opt) => (
        <button
          key={opt.value}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'px-3 py-1 rounded text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            value === opt.value ? 'bg-accent text-white shadow-sm shadow-accent/30' : 'text-muted hover:text-gray-700 dark:hover:text-gray-200',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ label, hint, children, disabled }: { label: string; hint?: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className={clsx('flex items-center justify-between gap-4 py-2.5 border-b border-border/60 last:border-0', disabled && 'opacity-50')}>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export const selectCls = 'input max-w-[150px] py-1.5';
