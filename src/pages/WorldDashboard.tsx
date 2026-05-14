import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorldStore } from '../store/worldStore';
import type { Divergence } from '../store/worldStore';
import DivergenceCard from '../components/DivergenceCard';
import WorldEventsFeed from '../components/WorldEventsFeed';
import Globe from '../components/Globe';
import CountryPanel from '../components/CountryPanel';
import RegionPanel from '../components/RegionPanel';
import { useRegionStore } from '../store/regionStore';

const WORKER_URL = (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '16px 20px', flex: 1, minWidth: 160,
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>{sub}</div>}
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

  if (!top5.length) {
    return <p style={{ color: '#4b5563', fontSize: 13 }}>No divergences recorded yet. Run the monthly sync to populate this.</p>;
  }

  return (
    <div>
      {top5.map(d => <DivergenceCard key={d.id} div={d} />)}
    </div>
  );
}

function DivergenceTimeline({ divs }: { divs: Divergence[] }) {
  if (!divs.length) return null;

  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute', left: 7, top: 0, bottom: 0,
        width: 2, background: 'rgba(255,255,255,0.08)',
      }} />

      {divs.slice(0, 20).map(d => {
        const mag = Object.values(d.delta).reduce((s, v) => s + Math.abs(v), 0);
        const dot = mag > 5 ? '#f87171' : mag > 2 ? '#fbbf24' : '#34d399';
        return (
          <div key={d.id} style={{ position: 'relative', marginBottom: 16 }}>
            {/* Dot */}
            <div style={{
              position: 'absolute', left: -20, top: 4,
              width: 8, height: 8, borderRadius: '50%',
              background: dot, border: '2px solid #111',
            }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{d.country_code}</span>
              <span style={{ color: '#6b7280', fontSize: 11 }}>
                {new Date(d.published_at).toLocaleDateString()}
              </span>
            </div>
            <p style={{ color: '#9ca3af', fontSize: 12, margin: '2px 0 0', lineHeight: 1.4 }}>
              {d.narrative.split('\n\nNews used:')[0].slice(0, 120)}…
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function WorldDashboard() {
  const {
    recentDivergences,
    loadRecentDivergences,
    setChoroplethMode,
    choroplethMode,
    selectedCountry,
    worldEvents,
    loadWorldEvents,
  } = useWorldStore();

  const { selectedRegion } = useRegionStore();
  const [simYear, setSimYear] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'top' | 'timeline' | 'events'>('top');

  // Load divergences + events on mount and switch globe to divergence mode
  useEffect(() => {
    loadRecentDivergences(50);
    loadWorldEvents('live', 40);
    setChoroplethMode('divergence');
    return () => setChoroplethMode('gdp_per_capita'); // reset on unmount
  }, []);

  // Compute summary stats from divergences
  useEffect(() => {
    if (!recentDivergences.length) return;
    const years = recentDivergences.map(d => d.sim_year);
    setSimYear(Math.max(...years));
  }, [recentDivergences]);

  const divergedCount = recentDivergences.filter(d =>
    Object.values(d.delta).reduce((s, v) => s + Math.abs(v), 0) > 1
  ).length;

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a14', color: '#fff' }}>
      {/* Left sidebar */}
      <div style={{
        width: 360, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
              🌍 RealityShift
            </div>
            <Link to="/" style={{ color: '#6b7280', fontSize: 12, textDecoration: 'none' }}>
              ← Play
            </Link>
          </div>
          <div style={{ color: '#4b5563', fontSize: 12, marginBottom: 16 }}>
            Live simulation vs. reality tracker
          </div>

          {/* RSS link */}
          <a
            href={`${WORKER_URL}/api/world/feed.xml`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: '#fb923c', textDecoration: 'none',
              background: 'rgba(251,146,60,0.1)', padding: '4px 10px',
              borderRadius: 6, marginBottom: 16,
            }}
          >
            ◉ RSS Feed
          </a>
        </div>

        {/* Stats */}
        <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
          <StatCard
            label="Sim Year"
            value={simYear ? String(simYear) : '—'}
            sub="latest agent cycle"
          />
          <StatCard
            label="Divergences"
            value={String(divergedCount)}
            sub={`of ${recentDivergences.length} checked`}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px' }}>
          {(['top', 'timeline', 'events'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === tab ? '#fff' : '#6b7280',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}
            >
              {tab === 'top' ? 'Top' : tab === 'timeline' ? 'Timeline' : 'Events'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, padding: '0 16px 16px', overflowY: 'auto' }}>
          {activeTab === 'top'
            ? <TopDivergences divs={recentDivergences} />
            : activeTab === 'timeline'
              ? <DivergenceTimeline divs={recentDivergences} />
              : <WorldEventsFeed events={worldEvents} />}
        </div>
      </div>

      {/* Globe */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Globe />
        {selectedCountry && !selectedRegion && <CountryPanel />}
        {selectedRegion && <RegionPanel />}

        {/* Mode label */}
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', borderRadius: 8,
          padding: '6px 14px', fontSize: 12, color: '#9ca3af',
          pointerEvents: 'none',
        }}>
          Overlay: {choroplethMode.replace(/_/g, ' ')} · Click a country to inspect
        </div>
      </div>
    </div>
  );
}
