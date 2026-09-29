import { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useWorldStore } from './store/worldStore';
import { readVisitorContext } from './lib/locale';
import Globe from './components/Globe';
import CountryPanel from './components/CountryPanel';
import AppHeader from './components/AppHeader';

// Secondary routes are split out of the initial bundle so the landing globe
// paints as fast as possible. Each loads on first navigation to its route.
const WorldDashboard = lazy(() => import('./pages/WorldDashboard'));
const WallPage = lazy(() => import('./pages/WallPage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const HallOfWorldsPage = lazy(() => import('./pages/HallOfWorldsPage'));
const GovernmentPage = lazy(() => import('./pages/GovernmentPage'));

function RouteFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-deep-space, #0b1020)',
        color: '#e6ebff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        opacity: 0.7,
      }}
    >
      Loading…
    </div>
  );
}

function GlobePage() {
  const { globeReady, selectedCountry, selectCountry } = useWorldStore();
  const openedOn = useRef(false);

  // Open on the visitor's own country once the globe can actually fly there.
  // Guessed from the browser timezone — no permission prompt, no network call.
  useEffect(() => {
    if (!globeReady || openedOn.current || selectedCountry) return;
    const { iso3 } = readVisitorContext();
    if (!iso3) return;
    openedOn.current = true;
    selectCountry(iso3);
  }, [globeReady, selectedCountry, selectCountry]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Globe />
      <AppHeader />
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
  }, [init]);

  return (
    // basename tracks Vite's base so routes resolve both at '/' in dev and
    // under the '/RealityShift/' subpath GitHub Pages serves from.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<GlobePage />} />
          <Route path="/world" element={<WorldDashboard />} />
          <Route path="/wall" element={<WallPage />} />
          <Route path="/wall/:worldId" element={<WallPage />} />
          <Route path="/play/:worldId" element={<GamePage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/hall" element={<HallOfWorldsPage />} />
          <Route path="/gov/:code" element={<GovernmentPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
