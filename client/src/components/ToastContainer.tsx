import { useToasts } from '../store/toast';
import clsx from 'clsx';

export function ToastContainer() {
  const { toasts, remove } = useToasts();
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          className={clsx(
            'toast-enter text-left px-4 py-3 rounded-lg shadow-lg border text-sm font-medium',
            t.kind === 'success' && 'bg-green-600/90 border-green-500 text-white',
            t.kind === 'error' && 'bg-red-600/90 border-red-500 text-white',
            t.kind === 'info' && 'bg-card border-border text-gray-100',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
