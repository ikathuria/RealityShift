import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useWorldStore } from '../store/worldStore';
import Globe from '../components/Globe';
import CountryPanel from '../components/CountryPanel';
import PolicyEditor from '../components/PolicyEditor';

function SimulateLog({ log }: { log: { country: string; status: string; error?: string }[] }) {
  if (!log.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Last Simulation
      </div>
      {log.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: r.status === 'ok' ? '#34d399' : '#f87171' }}>
            {r.status === 'ok' ? '✓' : '✗'}
          </span>
          <span style={{ color: r.status === 'ok' ? '#d1d5db' : '#f87171' }}>{r.country}</span>
          {r.error && <span style={{ color: '#6b7280', fontSize: 11 }}>{r.error.slice(0, 40)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function GamePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const { activeFork, playerForks, loadPlayerForks, enterFork, exitFork, simulateYear, isSimulating, simulateLog } = useGameStore();
  const { selectedCountry, countryData } = useWorldStore();

  // Guard: must be logged in
  useEffect(() => {
    if (!session) { navigate('/'); return; }
    if (session.user) loadPlayerForks(session.user.id);
  }, [session]);

  // Find and enter the fork
  useEffect(() => {
    if (!worldId || !playerForks.length) return;
    const fork = playerForks.find(f => f.worldId === worldId);
    if (!fork) return;
    if (activeFork?.worldId !== worldId) enterFork(fork);
  }, [worldId, playerForks]);

  // Cleanup on unmount
  useEffect(() => () => exitFork(), []);

  if (!activeFork) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a14', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌍</div>
          <div>Loading your parallel universe…</div>
        </div>
      </div>
    );
  }

  const playerData = countryData[activeFork.countryCode];

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a14', color: '#fff' }}>
      {/* Left sidebar */}
      <div style={{
        width: 320, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Link
              to="/"
              onClick={() => exitFork()}
              style={{ color: '#6b7280', fontSize: 12, textDecoration: 'none' }}
            >
              ← Exit Game
            </Link>
            <span style={{
              fontSize: 10, color: '#a78bfa',
              background: 'rgba(167,139,250,0.1)',
              padding: '3px 8px', borderRadius: 4,
            }}>
              PARALLEL UNIVERSE
            </span>
          </div>

          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>
            Playing as {activeFork.countryCode}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>
            Simulated Year <strong style={{ color: '#fff' }}>{activeFork.year}</strong>
            &nbsp;·&nbsp;No real-world data injected
          </div>
        </div>

        {/* Policy editor */}
        <div style={{ padding: '0 16px', flex: 1 }}>
          {playerData ? (
            <PolicyEditor
              baseIndicators={playerData.indicators}
              basePolicies={playerData.policies ?? {}}
            />
          ) : (
            <div style={{ color: '#6b7280', fontSize: 13 }}>Loading country data…</div>
          )}
        </div>

        {/* Simulate button */}
        <div style={{ padding: '12px 16px 20px' }}>
          <button
            onClick={() => session && simulateYear(session.access_token)}
            disabled={isSimulating || !session}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
              background: isSimulating ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.85)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: isSimulating ? 'default' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {isSimulating ? '⏳ Simulating world…' : '▶ Simulate Year →'}
          </button>

          {isSimulating && (
            <div style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
              Running AI agents for neighboring countries…
            </div>
          )}

          <SimulateLog log={simulateLog} />
        </div>
      </div>

      {/* Globe */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Globe />
        {selectedCountry && <CountryPanel />}

        {/* Fork banner */}
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', borderRadius: 8,
          padding: '6px 14px', fontSize: 12, color: '#9ca3af',
          pointerEvents: 'none',
        }}>
          🌐 Fork Universe · Year {activeFork.year} · Click a country to inspect
        </div>
      </div>
    </div>
  );
}
