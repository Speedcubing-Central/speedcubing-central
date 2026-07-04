import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { useAuth } from '../store/auth';
import { useUi } from '../store/ui';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  auth?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/timer', label: 'Timer', icon: 'timer' },
  { to: '/calculator', label: 'Calculator', icon: 'calculator' },
  { to: '/alg-trainer', label: 'Algorithms', icon: 'cube' },
  { to: '/battle', label: 'Battle', icon: 'swords' },
  { to: '/reconstruction', label: 'Reconstruction', icon: 'film' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
];

// Items shown in the mobile bottom bar.
const MOBILE_NAV = ['/', '/timer', '/battle', '/alg-trainer', '/settings'];

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { focusMode, setFocusMode } = useUi();
  const location = useLocation();
  const isTimer = location.pathname === '/timer';
  const isBattle = location.pathname.startsWith('/battle/');
  const isReconstruction = location.pathname.startsWith('/reconstruction');

  const visible = NAV.filter((n) => (n.auth ? !!user : true));

  // Focus mode hides app chrome (sidebar + mobile bars) via CSS rather than by
  // restructuring the tree — restructuring would remount the page and reset state.
  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900 dark:bg-bg dark:text-gray-100">
      {/* Floating restore button — shown when the sidebar is hidden */}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          title="Show sidebar"
          className="hidden md:flex fixed top-3 left-3 z-40 items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-100 dark:border-border dark:bg-card dark:text-gray-200 dark:hover:bg-card-hover"
        >
          <Icon name="panel" size={18} />
        </button>
      )}

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden md:flex flex-col w-60 shrink-0 border-r border-gray-200 bg-white dark:border-border dark:bg-card/40 p-4 sticky top-0 h-screen',
          focusMode && '!hidden',
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <NavLink to="/" className="flex items-center gap-2 px-2">
            <Logo size={32} className="shrink-0" />
            <span className="font-extrabold text-lg leading-tight">
              Speedcubing
              <br />
              <span className="text-accent">Central</span>
            </span>
          </NavLink>
          <button
            onClick={() => setFocusMode(true)}
            title="Hide sidebar"
            className="text-gray-500 hover:text-gray-900 dark:text-muted dark:hover:text-gray-100 p-1"
          >
            <Icon name="panel" size={18} />
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
          {visible.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-muted dark:hover:bg-card-hover dark:hover:text-gray-100',
                )
              }
            >
              <Icon name={n.icon} size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="pt-4 border-t border-gray-200 dark:border-border mt-4">
          {user ? (
            <div className="px-2 text-xs text-gray-500 dark:text-muted truncate">{user.displayName}</div>
          ) : (
            <NavLink to="/login" className="btn-primary w-full">
              Log in
            </NavLink>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {/* Mobile top bar */}
        <header
          className={clsx(
            'md:hidden flex items-center justify-between px-4 h-14 border-b border-gray-200 bg-white/80 dark:border-border dark:bg-card/60 sticky top-0 z-20 backdrop-blur',
            focusMode && '!hidden',
          )}
        >
          <NavLink to="/" className="font-extrabold">
            Speedcubing<span className="text-accent">Central</span>
          </NavLink>
          <div className="flex items-center gap-3">
            <NavLink to="/settings" className="text-gray-600 dark:text-muted">
              <Icon name="gear" size={20} />
            </NavLink>
            {!user && (
              <NavLink to="/login" className="text-xs text-accent font-semibold">
                Login
              </NavLink>
            )}
          </div>
        </header>

        <div className={clsx('p-4', (isTimer || isBattle || isReconstruction) ? 'md:p-4' : 'max-w-6xl mx-auto md:p-8')}>{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className={clsx(
          'md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t border-gray-200 bg-white/95 dark:border-border dark:bg-card/95 backdrop-blur',
          focusMode && '!hidden',
        )}
      >
        {MOBILE_NAV.map((to) => {
          const item = NAV.find((n) => n.to === to)!;
          if (item.auth && !user) {
            return (
              <NavLink
                key={to}
                to="/login"
                className="flex-1 flex flex-col items-center py-2 text-xs text-gray-500 dark:text-muted gap-0.5"
              >
                <Icon name={item.icon} size={20} />
                {item.label}
              </NavLink>
            );
          }
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center py-2 text-xs gap-0.5',
                  isActive ? 'text-accent' : 'text-gray-500 dark:text-muted',
                )
              }
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
