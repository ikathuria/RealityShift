import Globe from './components/Globe';
import CountryPanel from './components/CountryPanel';

export default function App() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Globe />
      <CountryPanel />
    </div>
  );
}
