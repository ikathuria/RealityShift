import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useIsMobile } from '../lib/useIsMobile';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { useWorldStore } from '../store/worldStore';
import Globe from '../components/Globe';
import CountryPanel from '../components/CountryPanel';
import PolicyEditor from '../components/PolicyEditor';
import WorldEventsFeed from '../components/WorldEventsFeed';
import RegionPanel from '../components/RegionPanel';
import PublishToHall from '../components/PublishToHall';
import { useRegionStore } from '../store/regionStore';

function SimulateLog({ log }: { log: { country: string; status: string; error?: string }[] }) {
  if (!log.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="game-badge game-badge-yellow" style={{ marginBottom: 8, display: 'inline-flex' }}>
        SIMULATION LOG
      </div>
      {log.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, marginBottom: 4, fontFamily: 'var(--font-heading)' }}>
          <span style={{ color: r.status === 'ok' ? 'var(--accent-green)' : 'var(--accent-magenta)', fontWeight: 800 }}>
            {r.status === 'ok' ? '✓' : '✗'}
          </span>
          <span style={{ color: r.status === 'ok' ? '#fff' : 'var(--accent-magenta)', fontWeight: 700 }}>{r.country}</span>
          {r.error && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{r.error.slice(0, 40)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function GamePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { session } = useAuthStore();
  const { activeFork, playerForks, loadPlayerForks, enterFork, exitFork, simulateYear, isSimulating, simulateLog } = useGameStore();
  const { selectedCountry, countryData, worldEvents, loadWorldEvents, setPulseCountry } = useWorldStore();
  const { selectedRegion } = useRegionStore();

  // Guard: must be logged in
  useEffect(() => {
    if (!session) { navigate('/'); return; }
    if (session.user) loadPlayerForks(session.user.id);
  }, [session, navigate, loadPlayerForks]);

  // Find and enter the fork
  useEffect(() => {
    if (!worldId || !playerForks.length) return;
    const fork = playerForks.find(f => f.worldId === worldId);
    if (!fork) return;
    if (activeFork?.worldId !== worldId) {
      enterFork(fork);
      loadWorldEvents(worldId, 30);
    }
  }, [worldId, playerForks, activeFork?.worldId, enterFork, loadWorldEvents]);

  // Cleanup on unmount
  useEffect(() => () => exitFork(), [exitFork]);

  if (!activeFork) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-deep-space)', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, filter: 'drop-shadow(0 0 10px rgba(0,240,255,0.5))' }}>🌍</div>
          <div className="game-font-heading" style={{ fontSize: 20, color: 'var(--accent-yellow)' }}>LOADING PARALLEL UNIVERSE…</div>
        </div>
      </div>
    );
  }

  const playerData = countryData[activeFork.countryCode];

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', width: '100vw', height: '100vh', background: 'var(--bg-deep-space)', color: '#fff' }}>
      {/* Command sidebar — a full-width top panel on mobile, left rail on desktop */}
      <div className="game-panel" style={{
        width: isMobile ? '100%' : 340, flexShrink: 0, borderRadius: 0, borderTop: 0, borderLeft: 0,
        borderBottom: isMobile ? undefined : 0,
        maxHeight: isMobile ? '48vh' : undefined,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 16px 12px', borderBottom: '2px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Link
              to="/"
              onClick={() => exitFork()}
              className="game-button game-button-dark"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              ← EXIT GAME
            </Link>
            <span className="game-badge game-badge-magenta">
              PARALLEL FORK
            </span>
          </div>

          <div className="game-font-heading" style={{ fontSize: 20, color: 'var(--accent-yellow)', marginBottom: 2 }}>
            COMMANDING {activeFork.countryCode}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-heading)' }}>
            SIMULATED YEAR <strong style={{ color: '#fff' }}>{activeFork.year}</strong> &nbsp;·&nbsp; NO REAL-WORLD DATA INJECTED
          </div>
        </div>

        {/* Policy editor */}
        <div style={{ padding: '14px 16px', flex: 1 }}>
          {playerData ? (
            <PolicyEditor
              baseIndicators={playerData.indicators}
              basePolicies={playerData.policies ?? {}}
            />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading country data…</div>
          )}

          {/* Save Changes button — pulses the player's country on the globe */}
          <button
            onClick={async () => {
              await useGameStore.getState().savePolicyDraft();
              setPulseCountry(activeFork.countryCode);
            }}
            disabled={isSimulating}
            className="game-button game-button-dark"
            style={{
              width: '100%', padding: '10px 0', fontSize: 12, marginTop: 12,
            }}
          >
            💾 SAVE POLICY DRAFT
          </button>
        </div>

        {/* Simulate button */}
        <div style={{ padding: '12px 16px 20px', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => session && simulateYear(session.access_token)}
            disabled={isSimulating || !session}
            className="game-button game-button-cyan"
            style={{
              width: '100%', padding: '14px 0', fontSize: 14,
              boxShadow: 'var(--hud-shadow), var(--hud-shadow-glow-cyan)',
            }}
          >
            {isSimulating ? '⏳ SIMULATING WORLD…' : '▶ SIMULATE YEAR →'}
          </button>

          {isSimulating && (
            <div style={{ color: 'var(--accent-yellow)', fontSize: 11, textAlign: 'center', marginTop: 8, fontFamily: 'var(--font-heading)' }}>
              ⚡ RUNNING AI AGENTS FOR NEIGHBORING NATIONS…
            </div>
          )}

          <SimulateLog log={simulateLog} />

          {/* Opt-in: publish this fork to the public Hall of Worlds */}
          <PublishToHall fork={activeFork} />

          {/* World events in this fork */}
          {worldEvents.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="game-badge game-badge-yellow" style={{ marginBottom: 8, display: 'inline-flex' }}>
                FORK WORLD EVENTS
              </div>
              <WorldEventsFeed events={worldEvents} maxHeight={220} />
            </div>
          )}
        </div>
      </div>

      {/* Globe */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Globe />
        {selectedCountry && !selectedRegion && <CountryPanel />}
        {selectedRegion && <RegionPanel />}

        {/* Fork banner */}
        <div
          className="game-badge"
          style={{
            position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-hud-panel)',
            border: '2px solid var(--game-border-ink)',
            outline: '1px solid var(--accent-cyan)',
            borderRadius: 'var(--radius-game-pill)',
            padding: '6px 18px', fontSize: 12, color: '#fff',
            pointerEvents: 'none',
            boxShadow: 'var(--hud-shadow), var(--hud-shadow-glow-cyan)',
            zIndex: 30,
          }}
        >
          🌐 PARALLEL UNIVERSE · YEAR {activeFork.year} · CLICK A NATION TO COMMAND
        </div>
      </div>
    </div>
  );
}
