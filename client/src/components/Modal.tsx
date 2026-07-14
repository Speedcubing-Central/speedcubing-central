import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

// Lightweight accessible modal with a backdrop. Closes on Escape and backdrop click.
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const maxW = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`card w-full ${maxW} my-auto shadow-2xl`} role="dialog" aria-modal="true">
        {title && (
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <h3 className="font-bold">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-gray-100">
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
