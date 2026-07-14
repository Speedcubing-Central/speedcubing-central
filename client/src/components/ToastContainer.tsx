import { useToasts } from '../store/toast';
import clsx from 'clsx';
import { Icon, type IconName } from './Icon';

const KIND_ICON: Record<string, IconName> = { success: 'check', error: 'x', info: 'sparkle' };

export function ToastContainer() {
  const { toasts, remove } = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          className={clsx(
            'toast-enter flex items-start gap-2.5 text-left px-4 py-3 rounded-lg shadow-lg border text-sm font-medium',
            t.kind === 'success' && 'bg-green-600/90 border-green-500 text-white',
            t.kind === 'error' && 'bg-red-600/90 border-red-500 text-white',
            t.kind === 'info' && 'bg-card border-border text-gray-100',
          )}
        >
          <Icon name={KIND_ICON[t.kind] ?? 'sparkle'} size={16} className="shrink-0 mt-0.5 opacity-90" />
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
