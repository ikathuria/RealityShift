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
    <div style={{ marginTop: 'var(--rs-space-3)' }}>
      <h3 className="game-eyebrow" style={{ margin: '0 0 var(--rs-space-2)' }}>Last simulated year</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {log.map((r, i) => (
          <li key={i} style={{ display: 'flex', gap: 'var(--rs-space-2)', alignItems: 'center', fontSize: 'var(--rs-text-xs)', marginBottom: 'var(--rs-space-1)', fontFamily: 'var(--rs-font-body)' }}>
            <span style={{ color: r.status === 'ok' ? 'var(--rs-good-on-dark)' : 'var(--rs-bad-on-dark)', fontWeight: 800 }}>
              {r.status === 'ok' ? '✓' : '✗'}
              <span className="rs-sr-only">{r.status === 'ok' ? 'done' : 'failed'}</span>
            </span>
            <span style={{ color: r.status === 'ok' ? 'var(--rs-text-on-dark)' : 'var(--rs-bad-on-dark)', fontWeight: 700 }}>{r.country}</span>
            {r.error && <span style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-2xs)' }}>{r.error.slice(0, 40)}</span>}
          </li>
        ))}
      </ul>
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
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--rs-space)', color: 'var(--rs-text-on-dark)' }}>
        <div role="status" className="rs-paper" style={{ textAlign: 'center', padding: 'var(--rs-space-6)' }}>
          <h1 className="game-font-display" style={{ fontSize: 'var(--rs-text-xl)', margin: 0 }}>Opening your fork…</h1>
          <p style={{ margin: 'var(--rs-space-2) 0 0', fontSize: 'var(--rs-text-sm)', color: 'var(--rs-muted-on-paper)' }}>
            Fetching your saved worlds and loading this one’s events.
          </p>
        </div>
      </main>
    );
  }

  const playerData = countryData[activeFork.countryCode];

  return (
    <main style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', width: '100vw', height: '100vh', background: 'var(--rs-space)', color: 'var(--rs-text-on-dark)' }}>
      {/* Command sidebar — a full-width top panel on mobile, left rail on desktop */}
      <aside aria-label="Command desk" className="game-panel" style={{
        width: isMobile ? '100%' : 340, flexShrink: 0, borderRadius: 0, borderTop: 0, borderLeft: 0,
        borderBottom: isMobile ? undefined : 0,
        maxHeight: isMobile ? '48vh' : undefined,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ padding: 'var(--rs-space-5) var(--rs-space-4) var(--rs-space-3)', borderBottom: '1px solid var(--rs-hud-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--rs-space-2)', marginBottom: 'var(--rs-space-3)' }}>
            <Link
              to="/"
              onClick={() => exitFork()}
              className="game-button game-button-dark"
            >
              ← Back to reality
            </Link>
            <span className="rs-split-chip" style={{ background: 'var(--rs-fork)' }}>
              Your fork · {activeFork.year}
            </span>
          </div>

          <h1 className="game-font-display" style={{ fontSize: 'var(--rs-text-2xl)', lineHeight: 1.05, margin: '0 0 var(--rs-space-1)' }}>
            You run {activeFork.countryCode}
          </h1>
          <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)', margin: 0 }}>
            Simulated year <strong style={{ color: 'var(--rs-text-on-dark)' }}>{activeFork.year}</strong> · No real-world data enters your universe again.
          </p>
        </div>

        {/* Policy editor */}
        <div style={{ padding: 'var(--rs-space-4)', flex: 1 }}>
          {playerData ? (
            <PolicyEditor
              baseIndicators={playerData.indicators}
              basePolicies={playerData.policies ?? {}}
            />
          ) : (
            <p role="status" style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)', textAlign: 'center', padding: 'var(--rs-space-5)', margin: 0 }}>
              Loading {activeFork.countryCode}’s budget and policies…
            </p>
          )}

          {/* Save Changes button — pulses the player's country on the globe */}
          <button
            onClick={async () => {
              await useGameStore.getState().savePolicyDraft();
              setPulseCountry(activeFork.countryCode);
            }}
            disabled={isSimulating}
            className="game-button game-button-dark"
            style={{ width: '100%', marginTop: 'var(--rs-space-3)' }}
          >
            Save policy draft
          </button>
        </div>

        {/* Simulate button */}
        <div style={{ padding: 'var(--rs-space-3) var(--rs-space-4) var(--rs-space-5)', borderTop: '1px solid var(--rs-hud-line)' }}>
          <button
            onClick={() => session && simulateYear(session.access_token)}
            disabled={isSimulating || !session}
            className="game-button rs-button-lg"
            style={{ width: '100%' }}
          >
            {isSimulating ? 'Simulating the year…' : 'Simulate the next year!'}
          </button>

          {isSimulating && (
            <p role="status" style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)', textAlign: 'center', margin: 'var(--rs-space-2) 0 0' }}>
              Your neighbours’ AI leaders are reading your moves and plotting theirs.
            </p>
          )}

          <SimulateLog log={simulateLog} />

          {/* Opt-in: publish this fork to the public Hall of Worlds */}
          <PublishToHall fork={activeFork} />

          {/* World events in this fork */}
          {worldEvents.length > 0 && (
            <section style={{ marginTop: 'var(--rs-space-4)' }}>
              <h2 className="game-eyebrow" style={{ margin: '0 0 var(--rs-space-2)' }}>Meanwhile, in your fork</h2>
              <WorldEventsFeed events={worldEvents} maxHeight={220} />
            </section>
          )}
        </div>
      </aside>

      {/* Globe */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Globe />
        {selectedCountry && !selectedRegion && <CountryPanel />}
        {selectedRegion && <RegionPanel />}

        {/* Fork banner */}
        <div
          className="rs-split-chip"
          style={{
            position: 'absolute', top: 'var(--rs-space-4)', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--rs-fork)',
            pointerEvents: 'none',
            zIndex: 30,
            whiteSpace: 'nowrap',
          }}
        >
          Your fork · {activeFork.year} · Pick a nation to inspect
        </div>
      </div>
    </main>
  );
}
