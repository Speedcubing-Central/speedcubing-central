import clsx from 'clsx';
import { WCA_EVENTS, UNOFFICIAL_EVENTS } from '@scc/shared';
import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EventSelector({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <select className={clsx('input max-w-[200px]', className)} value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label="WCA Events">
        {WCA_EVENTS.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </optgroup>
      <optgroup label="Unofficial Events">
        {UNOFFICIAL_EVENTS.map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </optgroup>
    </select>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

// Dashed border (vs. a regular .card's solid one) reads as "nothing's here
// yet," not just another content panel — an empty state is a placeholder,
// not a result. `icon` is optional so existing call sites are unaffected.
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: IconName }) {
  return (
    <div className="p-10 text-center rounded-xl border border-dashed border-border">
      {icon && (
        <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-card-hover text-muted flex items-center justify-center">
          <Icon name={icon} size={20} />
        </div>
      )}
      <p className="font-semibold text-lg">{title}</p>
      {hint && <p className="text-muted text-sm mt-2 max-w-sm mx-auto">{hint}</p>}
    </div>
  );
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'green' | 'red' | 'gray' | 'accent' | 'yellow' }) {
  return (
    <span
      className={clsx(
        'inline-block px-2 py-0.5 rounded text-xs font-semibold',
        color === 'green' && 'bg-green-500/20 text-green-400',
        color === 'red' && 'bg-red-500/20 text-red-400',
        color === 'yellow' && 'bg-yellow-500/20 text-yellow-400',
        color === 'accent' && 'bg-accent/20 text-accent',
        color === 'gray' && 'bg-gray-100 text-gray-500 dark:bg-card-hover dark:text-muted',
      )}
    >
      {children}
    </span>
  );
}
