import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/ToastContainer';
import { useAuth } from './store/auth';
import { useSettings, applyTheme, applyAccentColor, applyThemePalette } from './store/settings';

import HomePage from './features/landing/HomePage';
import LandingPage from './features/landing/LandingPage';
import TimerPage from './features/timer/TimerPage';
import CalculatorPage from './features/calculator/CalculatorPage';
import AlgTrainerPage from './features/alg-trainer/AlgTrainerPage';
import AlgStatsPage from './features/alg-trainer/AlgStatsPage';
import BattleLobby from './features/battle/BattleLobby';
import BattleRoom from './features/battle/BattleRoom';
import RelaysPage from './features/relays/RelaysPage';
import SoloRelayRunner from './features/relays/SoloRelayRunner';
import RelayLobby from './features/relays/RelayLobby';
import RelayRoom from './features/relays/RelayRoom';
import SharedCustomRelayPage from './features/relays/SharedCustomRelayPage';
import { RelayAccessGate } from './features/relays/RelayAccessGate';
import ReconstructionPage from './features/reconstruction/ReconstructionPage';
import ResultsPage from './features/results/ResultsPage';
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
  return user ? <HomePage user={user} /> : <LandingPage />;
}

export default function App() {
  const init = useAuth((s) => s.init);
  const theme = useSettings((s) => s.theme);
  const accentColor = useSettings((s) => s.accentColor);
  const themeId = useSettings((s) => s.themeId);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyThemePalette(themeId);
  }, [themeId]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/timer" element={<TimerPage />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/alg-trainer" element={<Navigate to="/algorithms" replace />} />
        <Route path="/algorithms" element={<AlgTrainerPage />} />
        <Route path="/algorithms/:tab" element={<AlgTrainerPage />} />
        <Route path="/algorithms/:tab/:puzzle" element={<AlgTrainerPage />} />
        <Route path="/algorithms/:tab/:puzzle/:setId" element={<AlgTrainerPage />} />
        <Route path="/algorithms/trainer/:puzzle/:setId/stats" element={<AlgStatsPage />} />
        <Route path="/battle" element={<BattleLobby />} />
        <Route path="/battle/:code" element={<BattleRoom />} />
        <Route
          path="/relays"
          element={
            <RelayAccessGate>
              <Outlet />
            </RelayAccessGate>
          }
        >
          <Route index element={<RelaysPage />} />
          <Route path="run" element={<SoloRelayRunner />} />
          <Route path="team" element={<RelayLobby />} />
          <Route path="team/:code" element={<RelayRoom />} />
          <Route path="share/:id" element={<SharedCustomRelayPage />} />
        </Route>
        <Route path="/reconstruction" element={<ReconstructionPage />} />
        <Route path="/reconstruction/:id" element={<ReconstructionPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/:wcaId" element={<ResultsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </Layout>
  );
}
