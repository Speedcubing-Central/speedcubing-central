import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { PageHeader } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../store/auth';
import { useSettings, DEFAULT_ACCENT, THEME_PRESETS } from '../../store/settings';
import { api } from '../../lib/api';
import { toast } from '../../store/toast';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 flex flex-col gap-4">
      <h2 className="font-semibold text-base">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme, accentColor, themeId, setThemeId, set } = useSettings();
  const navigate = useNavigate();

  // Display name
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);

  // Email
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  async function saveName() {
    if (!displayName.trim()) return;
    setSavingName(true);
    try {
      const { data } = await api.put('/profile/me', { displayName: displayName.trim() });
      setUser(data.user);
      toast.success('Display name updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  }

  async function saveEmail() {
    if (!email.trim()) return;
    setSavingEmail(true);
    try {
      const { data } = await api.put('/auth/email', { email: email.trim() });
      setUser(data.user);
      toast.success('Email updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to update email');
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword() {
    if (newPw !== confirmPw) { toast.error('New passwords do not match'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSavingPw(true);
    try {
      await api.put('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      toast.success('Password updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  }

  async function onLogout() {
    await logout();
    toast.info('Logged out');
    navigate('/');
  }

  return (
    <div className="max-w-xl flex flex-col gap-5">
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />

      {/* Appearance */}
      <Section title="Appearance">
        <Field label="Theme">
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  theme === t
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-gray-200 bg-gray-100 text-gray-600 hover:text-gray-900 dark:border-border dark:bg-card-hover dark:text-muted dark:hover:text-gray-100'
                }`}
              >
                <Icon name={t === 'dark' ? 'moon' : 'sun'} size={16} />
                {t === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Color theme" hint="A full palette, not just the accent — only visible in dark mode.">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setThemeId(p.id)}
                title={p.name}
                className={clsx(
                  'rounded-lg border-2 p-1.5 flex flex-col items-center gap-1.5 transition-colors',
                  themeId === p.id ? 'border-accent' : 'border-transparent hover:border-gray-300 dark:hover:border-border',
                )}
              >
                <div className="w-full h-8 rounded-md overflow-hidden flex" style={{ background: p.bg }}>
                  <div className="flex-1" style={{ background: p.card }} />
                  <div className="w-2.5 shrink-0" style={{ background: p.accent }} />
                </div>
                <span className="text-xs font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Accent color" hint="Primary highlight color used throughout the app.">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer relative shrink-0" title="Pick a color">
              <div
                className="w-10 h-10 rounded-lg border-2 border-white/20 dark:border-white/10 shadow-sm"
                style={{ backgroundColor: accentColor }}
              />
              <input
                type="color"
                value={accentColor}
                onChange={(e) => set({ accentColor: e.target.value })}
                className="sr-only"
              />
            </label>
            <span className="font-mono text-sm text-muted">{accentColor.toUpperCase()}</span>
            {accentColor.toLowerCase() !== DEFAULT_ACCENT && (
              <button
                className="btn-ghost text-xs px-3 py-1.5"
                onClick={() => set({ accentColor: DEFAULT_ACCENT })}
              >
                Reset
              </button>
            )}
          </div>
        </Field>
      </Section>

      {/* Account — only shown when logged in */}
      {user ? (
        <>
          <Section title="Account">
            <Field label="Display name">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                />
                <button className="btn-primary shrink-0" onClick={saveName} disabled={savingName}>
                  {savingName ? 'Saving…' : 'Save'}
                </button>
              </div>
            </Field>

            <Field label="Email">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
                />
                <button className="btn-primary shrink-0" onClick={saveEmail} disabled={savingEmail}>
                  {savingEmail ? 'Saving…' : 'Save'}
                </button>
              </div>
            </Field>

            {user.wcaId ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 border border-gray-200 dark:bg-card-hover dark:border-border">
                <Icon name="globe" size={18} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">WCA Account Connected</div>
                  <div className="text-xs text-muted">{user.wcaId}</div>
                </div>
              </div>
            ) : (
              <Field label="WCA Account" hint="Connect your WCA account to sync your official results.">
                <a
                  href="/api/auth/wca"
                  className="btn-ghost inline-flex items-center gap-2 w-fit"
                >
                  <Icon name="globe" size={16} />
                  Connect WCA Account
                </a>
              </Field>
            )}
          </Section>

          <Section title="Change Password">
            <Field label="Current password">
              <input
                className="input"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password" hint="Minimum 8 characters.">
              <input
                className="input"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                className="input"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                onKeyDown={(e) => e.key === 'Enter' && savePassword()}
              />
            </Field>
            <button className="btn-primary w-fit" onClick={savePassword} disabled={savingPw || !currentPw || !newPw || !confirmPw}>
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>
          </Section>

          <Section title="Session">
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors w-fit"
            >
              <Icon name="logout" size={16} />
              Log out
            </button>
          </Section>
        </>
      ) : (
        <Section title="Account">
          <p className="text-sm text-muted">You are not logged in.</p>
          <a href="/login" className="btn-primary w-fit">Log in</a>
        </Section>
      )}
    </div>
  );
}
