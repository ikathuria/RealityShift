import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Globe from './components/Globe';
import CountryPanel from './components/CountryPanel';
import WorldDashboard from './pages/WorldDashboard';
import GamePage from './pages/GamePage';

function GlobePage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Globe />
      <CountryPanel />
    </div>
  );
}

export default function App() {
  const { init } = useAuthStore();

  // Subscribe to Supabase auth state once on mount
  useEffect(() => {
    const unsubscribe = init();
    return unsubscribe;
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GlobePage />} />
        <Route path="/world" element={<WorldDashboard />} />
        <Route path="/play/:worldId" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}
