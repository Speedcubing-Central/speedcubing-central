import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/ToastContainer';
import { useAuth } from './store/auth';
import { useSettings, applyTheme, applyAccentColor } from './store/settings';

import Landing from './features/landing/Landing';
import Dashboard from './features/landing/Dashboard';
import TimerPage from './features/timer/TimerPage';
import CalculatorPage from './features/calculator/CalculatorPage';
import AlgTrainerPage from './features/alg-trainer/AlgTrainerPage';
import BattleLobby from './features/battle/BattleLobby';
import BattleRoom from './features/battle/BattleRoom';
import ReconstructionPage from './features/reconstruction/ReconstructionPage';
import LoginPage from './features/auth/LoginPage';
import SettingsPage from './features/settings/SettingsPage';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  return user ? <Dashboard /> : <Landing />;
}

export default function App() {
  const init = useAuth((s) => s.init);
  const theme = useSettings((s) => s.theme);
  const accentColor = useSettings((s) => s.accentColor);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/timer" element={<TimerPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/alg-trainer" element={<AlgTrainerPage />} />
        <Route path="/battle" element={<BattleLobby />} />
        <Route path="/battle/:code" element={<BattleRoom />} />
        <Route path="/reconstruction" element={<ReconstructionPage />} />
        <Route path="/reconstruction/:id" element={<ReconstructionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </Layout>
  );
}
