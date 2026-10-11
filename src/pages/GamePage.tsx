import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useIsMobile } from '../lib/useIsMobile';
import { useAuthStore } from '../store/authStore';
import { useGameStore, type SimulateProgress, type SimulateSummary } from '../store/gameStore';
import { countryName } from '../data/countries';
import { useWorldStore } from '../store/worldStore';
import Globe from '../components/Globe';
import CountryPanel from '../components/CountryPanel';
import PolicyEditor from '../components/PolicyEditor';
import WorldEventsFeed from '../components/WorldEventsFeed';
import RegionPanel from '../components/RegionPanel';
import PublishToHall from '../components/PublishToHall';
import { useRegionStore } from '../store/regionStore';

function SimulateSummaryView({ summary }: { summary: SimulateSummary | null }) {
  if (!summary) return null;
  const { year, reacting, results, complete, error } = summary;
  const byCode = new Map(results.map(r => [r.country_code, r]));
  const reacted = results.filter(r => r.status === 'ok').map(r => r.country_code);

  return (
    <div style={{ marginTop: 'var(--rs-space-3)' }}>
      {error && (
        <p role="alert" style={{
          margin: '0 0 var(--rs-space-2)', padding: 'var(--rs-space-2) var(--rs-space-3)', fontSize: 'var(--rs-text-xs)', fontWeight: 700,
          background: 'var(--rs-fork-tint)', color: 'var(--rs-ink)', borderRadius: 'var(--rs-radius-sm)', border: 'var(--rs-border-thin)',
        }}>
          {complete || !results.length ? error : `${year ?? 'This year'} stopped partway: ${error} Press simulate again to pick up where it left off.`}
        </p>
      )}
      {reacting.length > 0 && (
        <>
          <h3 className="game-eyebrow" style={{ margin: '0 0 var(--rs-space-2)' }}>
            {complete ? `Year ${year}: ` : ''}
            {reacted.length} of {reacting.length} countries reacted
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {reacting.map(code => {
              const r = byCode.get(code);
              const status = r?.status ?? 'pending';
              const ok = status === 'ok';
              const label = ok ? 'reacted' : status === 'error' ? 'failed' : status === 'skipped' ? 'skipped' : 'not reached';
              return (
                <li key={code} style={{ display: 'flex', gap: 'var(--rs-space-2)', alignItems: 'center', fontSize: 'var(--rs-text-xs)', marginBottom: 'var(--rs-space-1)', fontFamily: 'var(--rs-font-body)' }}>
                  <span aria-hidden="true" style={{ color: ok ? 'var(--rs-good-on-dark)' : status === 'error' ? 'var(--rs-bad-on-dark)' : 'var(--rs-muted-on-dark)', fontWeight: 800 }}>
                    {ok ? '✓' : status === 'error' ? '✗' : '–'}
                  </span>
                  <span style={{ color: ok ? 'var(--rs-text-on-dark)' : 'var(--rs-muted-on-dark)', fontWeight: 700 }}>{countryName(code)}</span>
                  <span style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-2xs)' }}>{label}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {complete && !reacting.length && (
        <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)', margin: 0 }}>
          Year {year} is done. No other country had reason to react this time.
        </p>
      )}
    </div>
  );
}

function progressText(p: SimulateProgress | null): string {
  if (!p) return '';
  if (!p.reacting) return 'Saving your draft and working out who reacts…';
  if (!p.reacting.length) return 'Advancing your country…';
  const total = p.reacting.length;
  if (!p.current.length) return `Wrapping up year ${p.year}…`;
  return `Simulating ${Math.min(p.done + 1, total)}–${Math.min(p.done + p.current.length, total)} of ${total}: ${p.current.join(', ')}…`;
}

type OpenState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'forbidden'; isPublic: boolean }
  | { status: 'error'; error: string };

function CenteredMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--rs-space)', color: 'var(--rs-text-on-dark)', padding: 'var(--rs-space-4)', boxSizing: 'border-box' }}>
      <div role="status" className="rs-paper" style={{ textAlign: 'center', padding: 'var(--rs-space-6)', maxWidth: 420 }}>
        <h1 className="game-font-display" style={{ fontSize: 'var(--rs-text-xl)', margin: 0 }}>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export default function GamePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { session, loading: authLoading } = useAuthStore();
  const { activeFork, openFork, enterFork, exitFork, simulateYear, isSimulating, simulateProgress, lastSimulation, resumeFrom } = useGameStore();
  const { selectedCountry, countryData, countryStatus, worldEvents, loadWorldEvents, setPulseCountry } = useWorldStore();
  const { selectedRegion } = useRegionStore();
  const [openState, setOpenState] = useState<OpenState>({ status: 'loading' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const userId = session?.user.id ?? null;

  // Guard: must be logged in. Wait for the stored session to be restored
  // first, or a reload of /play/:id bounces a signed-in player to the globe.
  useEffect(() => {
    if (!authLoading && !userId) navigate('/');
  }, [authLoading, userId, navigate]);

  // Fetch the world directly (not via a cached list) and enter it, or explain
  // why we can't.
  useEffect(() => {
    if (authLoading || !userId || !worldId) return;
    if (useGameStore.getState().activeFork?.worldId === worldId) {
      loadWorldEvents(worldId, 30);
      return;
    }
    let cancelled = false;
    openFork(worldId, userId).then(result => {
      if (cancelled) return;
      if (result.status === 'ok') {
        enterFork(result.fork);
        loadWorldEvents(worldId, 30);
      } else {
        setOpenState(result);
      }
    });
    return () => { cancelled = true; };
  }, [authLoading, userId, worldId, openFork, enterFork, loadWorldEvents]);

  // Cleanup on unmount
  useEffect(() => () => exitFork(), [exitFork]);

  if (!activeFork || activeFork.worldId !== worldId) {
    if (openState.status === 'not_found') {
      return (
        <CenteredMessage title="No such world">
          <p style={{ margin: 'var(--rs-space-2) 0 var(--rs-space-4)', fontSize: 'var(--rs-text-sm)', color: 'var(--rs-muted-on-paper)' }}>
            This fork doesn’t exist, or it belongs to someone else and isn’t published.
          </p>
          <Link to="/" className="game-button">Back to the globe</Link>
        </CenteredMessage>
      );
    }
    if (openState.status === 'forbidden') {
      return (
        <CenteredMessage title="This isn’t your world">
          <p style={{ margin: 'var(--rs-space-2) 0 var(--rs-space-4)', fontSize: 'var(--rs-text-sm)', color: 'var(--rs-muted-on-paper)' }}>
            Only the player who forked it can run it.{openState.isPublic ? ' You can still read its front pages.' : ''}
          </p>
          <div style={{ display: 'flex', gap: 'var(--rs-space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {openState.isPublic && <Link to={`/wall/${worldId}`} className="game-button">See its front pages</Link>}
            <Link to="/" className="game-button game-button-dark">Back to the globe</Link>
          </div>
        </CenteredMessage>
      );
    }
    if (openState.status === 'error') {
      return (
        <CenteredMessage title="Couldn’t open this fork">
          <p role="alert" style={{ margin: 'var(--rs-space-2) 0 var(--rs-space-4)', fontSize: 'var(--rs-text-sm)', color: 'var(--rs-muted-on-paper)' }}>
            {openState.error}
          </p>
          <Link to="/" className="game-button">Back to the globe</Link>
        </CenteredMessage>
      );
    }
    return (
      <CenteredMessage title="Opening your fork…">
        <p style={{ margin: 'var(--rs-space-2) 0 0', fontSize: 'var(--rs-text-sm)', color: 'var(--rs-muted-on-paper)' }}>
          Loading this world and its events.
        </p>
      </CenteredMessage>
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
            You run {countryName(activeFork.countryCode)}
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
              {countryStatus[activeFork.countryCode] === 'missing'
                ? `${countryName(activeFork.countryCode)} has no state in this fork yet.`
                : countryStatus[activeFork.countryCode] === 'error'
                  ? `Could not load ${countryName(activeFork.countryCode)}’s budget. Reload to try again.`
                  : `Loading ${countryName(activeFork.countryCode)}’s budget and policies…`}
            </p>
          )}

          {/* Save Changes button — pulses the player's country on the globe */}
          <button
            onClick={async () => {
              const err = await useGameStore.getState().savePolicyDraft();
              setSaveError(err);
              if (!err) setPulseCountry(activeFork.countryCode);
            }}
            disabled={isSimulating}
            className="game-button game-button-dark"
            style={{ width: '100%', marginTop: 'var(--rs-space-3)' }}
          >
            Save policy draft
          </button>
          {saveError && (
            <p role="alert" style={{ color: 'var(--rs-bad-on-dark)', fontSize: 'var(--rs-text-xs)', fontWeight: 700, margin: 'var(--rs-space-2) 0 0' }}>
              {saveError}
            </p>
          )}
        </div>

        {/* Simulate button */}
        <div style={{ padding: 'var(--rs-space-3) var(--rs-space-4) var(--rs-space-5)', borderTop: '1px solid var(--rs-hud-line)' }}>
          <button
            onClick={() => session && simulateYear(session.access_token)}
            disabled={isSimulating || !session}
            className="game-button rs-button-lg"
            style={{ width: '100%' }}
          >
            {isSimulating
              ? 'Simulating the year…'
              : resumeFrom?.worldId === activeFork.worldId ? 'Finish simulating this year' : 'Simulate the next year!'}
          </button>

          {isSimulating && (
            <p role="status" style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)', textAlign: 'center', margin: 'var(--rs-space-2) 0 0' }}>
              {progressText(simulateProgress)}
            </p>
          )}

          {!isSimulating && <SimulateSummaryView summary={lastSimulation} />}

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
