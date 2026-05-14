import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Globe from './components/Globe';
import CountryPanel from './components/CountryPanel';
import WorldDashboard from './pages/WorldDashboard';

function GlobePage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Globe />
      <CountryPanel />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GlobePage />} />
        <Route path="/world" element={<WorldDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
