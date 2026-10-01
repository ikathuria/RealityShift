import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorldStore } from '../store/worldStore';
import type { Divergence } from '../store/worldStore';
import DivergenceCard from '../components/DivergenceCard';
import WorldEventsFeed from '../components/WorldEventsFeed';
import CountryLeaderboard from '../components/CountryLeaderboard';
import CountryTable from '../components/CountryTable';
import CountryPanel from '../components/CountryPanel';
import RegionPanel from '../components/RegionPanel';
import TimelineScrubber from '../components/TimelineScrubber';
import { useRegionStore } from '../store/regionStore';

const WORKER_URL = (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 140, padding: 'var(--rs-space-3)',
      border: '2px solid var(--rs-hud-line)', borderRadius: 'var(--rs-radius-md)',
    }}>
      <dt className="game-eyebrow" style={{ fontSize: 'var(--rs-text-2xs)', marginBottom: 'var(--rs-space-1)' }}>{label}</dt>
      <dd style={{ margin: 0 }}>
        <span style={{ display: 'block', font: '700 var(--rs-text-xl)/1 var(--rs-font-mono)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {sub && <span style={{ display: 'block', color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-xs) var(--rs-font-body)', marginTop: 'var(--rs-space-1)' }}>{sub}</span>}
      </dd>
    </div>
  );
}

function TopDivergences({ divs }: { divs: Divergence[] }) {
  const top5 = [...divs]
    .sort((a, b) => {
      const magA = Object.values(a.delta).reduce((s, v) => s + Math.abs(v), 0);
      const magB = Object.values(b.delta).reduce((s, v) => s + Math.abs(v), 0);
      return magB - magA;
    })
    .slice(0, 5);

  return (
    <>
      <h2 className="rs-sr-only">Biggest drift</h2>
      {!top5.length ? (
        <p style={{ color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-sm)/1.45 var(--rs-font-body)', textAlign: 'center', padding: 'var(--rs-space-5)', margin: 0 }}>
          No drift yet. The first monthly sync will show where the simulation split from reality.
        </p>
      ) : (
        top5.map(d => <DivergenceCard key={d.id} div={d} />)
      )}
    </>
  );
}

const TABS = [
  { id: 'top', label: 'Top drift' },
  { id: 'ranks', label: 'Ranks' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'events', label: 'Events' },
] as const;

export default function WorldDashboard() {
  const {
    recentDivergences,
    loadRecentDivergences,
    selectedCountry,
    worldEvents,
    loadWorldEvents,
    countriesTracked,
    loadCountriesTracked,
    loadAllCountries,
  } = useWorldStore();

  const { selectedRegion } = useRegionStore();
  const [activeTab, setActiveTab] = useState<'top' | 'ranks' | 'timeline' | 'events'>('top');

  // Load divergences + events + all country states on mount
  useEffect(() => {
    loadAllCountries();
    loadRecentDivergences(50);
    loadWorldEvents('live', 40);
    loadCountriesTracked('live');
  }, [loadAllCountries, loadRecentDivergences, loadWorldEvents, loadCountriesTracked]);

  // Latest simulated year, derived from the loaded divergences
  const simYear = recentDivergences.length
    ? Math.max(...recentDivergences.map(d => d.sim_year))
    : null;

  const divergedCount = recentDivergences.filter(d =>
    Object.values(d.delta).reduce((s, v) => s + Math.abs(v), 0) > 1
  ).length;

  return (
    <main style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--rs-space)', color: 'var(--rs-text-on-dark)' }}>
      {/* Left sidebar: scrolls on its own, so it is a focusable region */}
      <aside
        className="game-panel"
        tabIndex={0}
        aria-label="Divergence summary"
        style={{
          width: 380, flexShrink: 0, borderRadius: 0, borderTop: 0, borderLeft: 0, borderBottom: 0,
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <header style={{ padding: 'var(--rs-space-5) var(--rs-space-4) var(--rs-space-3)', borderBottom: '1px solid var(--rs-hud-line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--rs-space-2)', marginBottom: 'var(--rs-space-2)' }}>
            <div>
              <div className="game-eyebrow" style={{ marginBottom: 'var(--rs-space-1)' }}>
                <span className="game-badge rs-chip-real">Real</span>
                vs
                <span className="game-badge rs-chip-fork">Fork</span>
              </div>
              <h1 style={{ margin: 0, font: '700 var(--rs-text-xl)/1.05 var(--rs-font-display)', color: 'var(--rs-text-on-dark)' }}>
                Divergence dashboard
              </h1>
            </div>
            <Link to="/" className="game-button game-button-dark" style={{ minHeight: 44, padding: '0 var(--rs-space-3)', fontSize: 'var(--rs-text-sm)', whiteSpace: 'nowrap' }}>
              ← Globe
            </Link>
          </div>
          <p style={{ color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-sm)/1.45 var(--rs-font-body)', margin: '0 0 var(--rs-space-3)' }}>
            One world is real. The other is run by AI agents. Here is how far they have drifted apart.
          </p>

          <a
            href={`${WORKER_URL}/api/world/feed.xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="game-link"
            style={{ color: 'var(--rs-sun)', font: '700 var(--rs-text-sm) var(--rs-font-body)', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
          >
            Follow the drift by RSS<span className="rs-sr-only"> (opens in a new tab)</span>
          </a>
        </header>

        {/* Stats grid */}
        <dl style={{ margin: 0, padding: 'var(--rs-space-3) var(--rs-space-4)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--rs-space-2)' }}>
          <StatCard label="Sim year" value={simYear ? String(simYear) : '—'} sub="Latest agent cycle" />
          <StatCard label="Nations" value={countriesTracked !== null ? String(countriesTracked) : '—'} sub="Run by AI agents" />
          <StatCard label="Events" value={String(worldEvents.length)} sub="Between agents" />
          <StatCard label="Drifted" value={String(divergedCount)} sub={`Of ${recentDivergences.length} checked`} />
        </dl>

        {/* Tabs */}
        <div role="tablist" aria-label="Dashboard views" className="game-segmented" style={{ margin: '0 var(--rs-space-4) var(--rs-space-3)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`dash-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls="dash-tabpanel"
              onClick={() => setActiveTab(tab.id)}
              style={{ minHeight: 44 }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          role="tabpanel"
          id="dash-tabpanel"
          aria-labelledby={`dash-tab-${activeTab}`}
          style={{ flex: 1, padding: '0 var(--rs-space-4) var(--rs-space-4)' }}
        >
          {activeTab === 'top'
            ? <TopDivergences divs={recentDivergences} />
            : activeTab === 'ranks'
              ? <CountryLeaderboard />
              : activeTab === 'timeline'
                ? <><h2 className="rs-sr-only">Timeline</h2><TimelineScrubber divs={recentDivergences} /></>
                : <><h2 className="rs-sr-only">World events</h2><WorldEventsFeed events={worldEvents} /></>}
        </div>
      </aside>

      {/* Main stats table */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        <CountryTable />
        {selectedCountry && !selectedRegion && <CountryPanel />}
        {selectedRegion && <RegionPanel />}
      </div>
    </main>
  );
}
