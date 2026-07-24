import { Modal } from '../../components/Modal';

const BINDS: { keys: string[]; label: string }[] = [
  { keys: ['Space'], label: 'Hold to start, release to stop (keyboard entry mode)' },
  { keys: ['Escape'], label: 'Cancel an accidental start' },
  { keys: ['Enter'], label: 'Next scramble, or submit a typed time' },
  { keys: ['Ctrl', 'Shift', '1'], label: 'Mark the last solve OK' },
  { keys: ['Ctrl', 'Shift', '2'], label: 'Mark the last solve +2' },
  { keys: ['Ctrl', 'Shift', '3'], label: 'Mark the last solve DNF' },
  { keys: ['Ctrl', 'Shift', 'Backspace'], label: 'Delete the last solve' },
  { keys: ['?'], label: 'Show this list' },
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-gray-300 dark:border-border bg-gray-50 dark:bg-bg px-2 py-1 font-mono text-xs font-semibold text-gray-700 dark:text-gray-200">
      {children}
    </kbd>
  );
}

export function KeybindsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <ul className="space-y-3">
        {BINDS.map((b) => (
          <li key={b.label} className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted">{b.label}</span>
            <span className="flex items-center gap-1 shrink-0">
              {b.keys.map((k, i) => (
                <span key={k} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted text-xs">+</span>}
                  <Key>{k}</Key>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted mt-4">
        Ctrl+Shift+1/2/3/Backspace apply to whatever solve is currently shown as "Last solve," and
        work even while the manual-entry box has focus.
      </p>
    </Modal>
  );
}
