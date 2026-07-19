import { useState, type ReactNode } from 'react';

// The Relays tab is still being polished — gate it behind a shared passcode
// so it doesn't show up as a finished feature to casual visitors while
// that's in progress. This is a UI-level speed bump (the passcode ships in
// the client bundle, and the API routes underneath aren't gated), not real
// access control — there's no sensitive data behind it, just an unfinished
// feature.
const RELAY_PASSCODE = 'DTN8G3D5';
const UNLOCK_STORAGE_KEY = 'scc-relay-unlocked';

function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function RelayAccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.trim().toUpperCase() === RELAY_PASSCODE) {
      try {
        localStorage.setItem(UNLOCK_STORAGE_KEY, 'true');
      } catch {
        /* private browsing / storage disabled — still unlock for this session */
      }
      setUnlocked(true);
    } else {
      setError(true);
      setCode('');
    }
  }

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="card p-8">
        <div className="flex justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-accent">
            <rect x="4" y="10.5" width="16" height="10" rx="2" />
            <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-1 text-center">Relays is locked</h1>
        <p className="text-sm text-muted text-center mb-6">
          This tab is still being polished. Enter the passcode to continue.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label">Passcode</label>
            <input
              className="input text-center tracking-widest font-mono uppercase"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(false);
              }}
              autoFocus
              autoComplete="off"
              maxLength={16}
            />
            {error && <p className="text-xs text-red-500 mt-1">Incorrect passcode.</p>}
          </div>
          <button className="btn-primary mt-1">Unlock</button>
        </form>
      </div>
    </div>
  );
}
