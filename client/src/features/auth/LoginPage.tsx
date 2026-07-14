import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { toast } from '../../store/toast';
import { api, apiError } from '../../lib/api';
import { Icon } from '../../components/Icon';

const WCA_ERRORS: Record<string, string> = {
  wca_not_configured: 'WCA sign-in is not configured on this server. Use email & password below.',
  wca_no_code: 'WCA did not return an authorization code. Please try again.',
  wca_failed: 'WCA sign-in failed. Please try again or use email & password.',
};

export default function LoginPage() {
  const [params] = useSearchParams();
  // Lets a "Create account" link (e.g. LandingPage's) deep-link straight
  // into register mode via /login?mode=register instead of landing on the
  // login form and making the visitor click "Register" themselves.
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [wcaEnabled, setWcaEnabled] = useState(true);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  // Discover whether WCA OAuth is configured on the server.
  useEffect(() => {
    api
      .get('/auth/config')
      .then(({ data }) => setWcaEnabled(Boolean(data.wcaEnabled)))
      .catch(() => setWcaEnabled(false));
  }, []);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  const wcaError = params.get('error');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success('Welcome back!');
      } else {
        await register(email, password, displayName);
        toast.success('Account created!');
      }
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(apiError(err, 'Authentication failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">{mode === 'login' ? 'Log in' : 'Create account'}</h1>

        {wcaError && (
          <div className="mb-4 text-sm bg-yellow-500/15 text-yellow-500 dark:text-yellow-400 rounded-lg px-3 py-2">
            {WCA_ERRORS[wcaError] ?? 'WCA sign-in failed. Try again or use email & password.'}
          </div>
        )}

        {wcaEnabled ? (
          <a href="/api/auth/wca" className="btn-primary w-full mb-4">
            <Icon name="cube" size={18} />
            Continue with WCA
          </a>
        ) : (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-gray-200 dark:border-border bg-gray-100 dark:bg-card-hover/40 px-3 py-2 text-xs text-muted">
            <Icon name="cube" size={16} className="mt-0.5 shrink-0" />
            <span>
              WCA sign-in is unavailable on this server (no <span className="font-mono">WCA_CLIENT_ID</span>{' '}
              configured). Use email &amp; password below.
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 my-4 text-muted text-xs">
          <div className="h-px bg-border flex-1" /> OR <div className="h-px bg-border flex-1" />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'register' && (
            <div>
              <label className="label">Display name</label>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === 'register' ? 8 : 1}
              required
            />
          </div>
          <button className="btn-primary mt-2" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button
          className="text-sm text-accent mt-4 w-full text-center"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log in'}
        </button>

      </div>
    </div>
  );
}
