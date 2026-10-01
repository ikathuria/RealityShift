import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useWorldStore } from '../store/worldStore';
import { countryName } from '../data/countries';
import { Flag } from './GameIcons';
import { fetchGlobalEnrichment, DC_INDICATOR_META, DC_KEYS, type DcKey } from '../data/dataCommons';

/** Metrics sourced from the sim itself (countryData / divergences). */
type SimMetric =
  | 'gdp_per_capita'
  | 'divergence'
  | 'military_spend'
  | 'education_spend'
  | 'healthcare_spend'
  | 'unemployment'
  | 'tax_rate';

// Sim + real-world (Data Commons) metrics share the one selector.
export type FilterMetric = SimMetric | DcKey;

const SIM_METRIC_CONFIG: Record<SimMetric, { label: string; fmt: (v: number) => string }> = {
  gdp_per_capita:   { label: 'GDP per capita', fmt: v => `$${Math.round(v).toLocaleString()}` },
  divergence:       { label: 'Drift score', fmt: v => `${v.toFixed(1)} pts` },
  military_spend:   { label: 'Military spend', fmt: v => `${v.toFixed(2)}%` },
  education_spend:  { label: 'Education spend', fmt: v => `${v.toFixed(2)}%` },
  healthcare_spend: { label: 'Healthcare spend', fmt: v => `${v.toFixed(2)}%` },
  unemployment:     { label: 'Unemployment', fmt: v => `${v.toFixed(1)}%` },
  tax_rate:         { label: 'Tax revenue', fmt: v => `${v.toFixed(1)}%` },
};

const SIM_METRICS = Object.keys(SIM_METRIC_CONFIG) as SimMetric[];

const inputStyle: React.CSSProperties = {
  background: 'var(--rs-space)',
  border: 'var(--rs-border-thin)',
  outline: '1px solid var(--rs-hud-line)',
  borderRadius: 'var(--rs-radius-md)',
  color: 'var(--rs-text-on-dark)',
  padding: '0 var(--rs-space-3)',
  minHeight: 44,
  font: '500 var(--rs-text-sm) var(--rs-font-body)',
  minWidth: 160,
};

/** Metric filter chip: a toggle, ≥44px tall. Real-world metrics go teal when on. */
function MetricButton({ active, real, onClick, children }: { active: boolean; real?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`game-button ${active ? (real ? 'rs-button-real' : 'rs-button-fork') : 'game-button-dark'}`}
      style={{ padding: '0 var(--rs-space-3)', fontSize: 'var(--rs-text-sm)', minHeight: 44 }}
    >
      {children}
    </button>
  );
}

// Module-level cache of the all-countries map per Data Commons metric — the
// Worker already edge-caches these, and they don't change within a session.
const dcGlobalCache = new Map<DcKey, Map<string, number>>();

function isDcMetric(m: FilterMetric): m is DcKey {
  return (DC_KEYS as string[]).includes(m);
}

function metricConfig(m: FilterMetric): { label: string; real: boolean; fmt: (v: number) => string } {
  if (isDcMetric(m)) {
    const meta = DC_INDICATOR_META[m];
    return { label: meta.label, real: true, fmt: v => `${v.toFixed(meta.decimals)} ${meta.unit}`.trim() };
  }
  return { ...SIM_METRIC_CONFIG[m], real: false };
}

export default function CountryLeaderboard() {
  const { countryData, recentDivergences, selectCountry, selectedCountry } = useWorldStore();
  const [metric, setMetric] = useState<FilterMetric>('gdp_per_capita');
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  // Bumped from the async Data Commons fetch to re-read the module cache.
  const [tick, bump] = useState(0);

  const dcLoading = isDcMetric(metric) && !dcGlobalCache.has(metric);

  // Lazily load the all-countries map for a Data Commons metric on selection.
  useEffect(() => {
    if (!isDcMetric(metric) || dcGlobalCache.has(metric)) return;
    let cancelled = false;
    fetchGlobalEnrichment(metric).then(map => {
      dcGlobalCache.set(metric, map);
      if (!cancelled) bump(v => v + 1);
    });
    return () => { cancelled = true; };
  }, [metric]);

  // Map divergence magnitudes per country code
  const divergenceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of recentDivergences) {
      const mag = Object.values(d.delta).reduce((s, v) => s + Math.abs(v), 0);
      map.set(d.country_code, (map.get(d.country_code) ?? 0) + mag);
    }
    return map;
  }, [recentDivergences]);

  // Combine country data into rankable rows
  const rows = useMemo(() => {
    const dcMap = isDcMetric(metric) ? dcGlobalCache.get(metric) : undefined;
    const list = Object.entries(countryData).map(([code, state]) => {
      let value: number;
      if (metric === 'divergence') value = divergenceMap.get(code) ?? 0;
      else if (isDcMetric(metric)) value = dcMap?.get(code) ?? 0;
      else value = state.indicators[metric] ?? 0;
      return { code, name: countryName(code), value, year: state.year };
    });

    // Filter search
    const query = search.trim().toLowerCase();
    const filtered = query
      ? list.filter(r => r.name.toLowerCase().includes(query) || r.code.toLowerCase().includes(query))
      : list;

    // A Data Commons metric ranks only countries that actually have a value;
    // sim metrics keep their existing behaviour (missing -> 0).
    const ranked = isDcMetric(metric) ? filtered.filter(r => r.value > 0) : filtered;

    // Sort
    return ranked.sort((a, b) => sortAsc ? a.value - b.value : b.value - a.value);
    // `tick` re-derives rows after the async fill of the (module-level, so
    // lint-opaque) dcGlobalCache; it's intentional, not a missing dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryData, metric, divergenceMap, search, sortAsc, tick]);

  const maxVal = useMemo(() => {
    if (!rows.length) return 1;
    return Math.max(...rows.map(r => r.value), 1);
  }, [rows]);

  const cfg = metricConfig(metric);

  return (
    <section className="game-panel" aria-labelledby="leaderboard-title" style={{ padding: 'var(--rs-space-4)' }}>
      {/* Header & search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--rs-space-3)', marginBottom: 'var(--rs-space-3)' }}>
        <div>
          <div className="game-eyebrow" style={{ marginBottom: 'var(--rs-space-1)' }}>Leaderboard</div>
          <h2 id="leaderboard-title" style={{ margin: 0, font: '700 var(--rs-text-xl)/1 var(--rs-font-display)' }}>
            Who leads the pack?
          </h2>
        </div>
        <input
          type="search"
          aria-label="Search nations"
          placeholder="Search nations"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Metric filters: sim (fork) metrics, then real-world Data Commons metrics */}
      <div className="game-eyebrow" id="lb-sim-label" style={{ marginBottom: 'var(--rs-space-2)' }}>Simulation</div>
      <div role="group" aria-labelledby="lb-sim-label" style={{ display: 'flex', gap: 'var(--rs-space-2)', flexWrap: 'wrap', marginBottom: 'var(--rs-space-3)' }}>
        {SIM_METRICS.map(m => (
          <MetricButton key={m} active={metric === m} onClick={() => setMetric(m)}>
            {SIM_METRIC_CONFIG[m].label}
          </MetricButton>
        ))}
      </div>
      <div className="game-eyebrow" id="lb-real-label" style={{ marginBottom: 'var(--rs-space-2)' }}>
        <span className="game-badge rs-chip-real">Real</span> Real world
      </div>
      <div role="group" aria-labelledby="lb-real-label" style={{ display: 'flex', gap: 'var(--rs-space-2)', flexWrap: 'wrap', marginBottom: 'var(--rs-space-2)' }}>
        {DC_KEYS.map(m => (
          <MetricButton key={m} real active={metric === m} onClick={() => setMetric(m)}>
            {DC_INDICATOR_META[m].label}
          </MetricButton>
        ))}
      </div>
      <p style={{ color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-xs) var(--rs-font-body)', margin: '0 0 var(--rs-space-4)' }}>
        Real-world figures come from Data Commons and data.un.org.
      </p>

      {/* Sort direction */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--rs-space-2)', marginBottom: 'var(--rs-space-2)', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--rs-muted-on-dark)', font: '700 var(--rs-text-sm) var(--rs-font-body)' }} aria-live="polite">
          {rows.length} nations, ranked by {cfg.label.toLowerCase()}
        </span>
        <button
          type="button"
          onClick={() => setSortAsc(!sortAsc)}
          className="game-link"
          style={{
            background: 'none', border: 0, color: 'var(--rs-sun)', cursor: 'pointer', minHeight: 44,
            font: '700 var(--rs-text-sm) var(--rs-font-body)',
          }}
        >
          {sortAsc ? '▲ Lowest first' : '▼ Highest first'}
        </button>
      </div>

      {/* Ranked list */}
      <div
        tabIndex={0}
        role="region"
        aria-label={`Nations ranked by ${cfg.label}`}
        style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 'var(--rs-space-1)' }}
      >
        {dcLoading ? (
          <p style={{ padding: 'var(--rs-space-5)', textAlign: 'center', color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-sm) var(--rs-font-body)', margin: 0 }}>
            Loading real-world figures from Data Commons…
          </p>
        ) : !rows.length ? (
          <p style={{ padding: 'var(--rs-space-5)', textAlign: 'center', color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-sm) var(--rs-font-body)', margin: 0 }}>
            {isDcMetric(metric)
              ? 'No real-world figures for this one yet. The Data Commons proxy may not be set up.'
              : 'No nation matches that search.'}
          </p>
        ) : (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {rows.map((r, index) => {
              const isSelected = selectedCountry === r.code;
              const pct = Math.min(100, Math.max(4, (r.value / maxVal) * 100));
              const rank = index + 1;
              return (
                <li key={r.code} style={{ marginBottom: 'var(--rs-space-2)' }}>
                  <button
                    type="button"
                    onClick={() => selectCountry(r.code)}
                    aria-current={isSelected ? 'true' : undefined}
                    style={{
                      width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 'var(--rs-space-3)',
                      padding: 'var(--rs-space-2) var(--rs-space-3)', cursor: 'pointer', textAlign: 'left',
                      background: 'var(--rs-hud)', color: 'var(--rs-text-on-dark)',
                      border: isSelected ? '2px solid var(--rs-sun)' : '2px solid var(--rs-hud-line)',
                      borderRadius: 'var(--rs-radius-md)',
                      transition: 'border-color var(--rs-dur-med)',
                    }}
                  >
                    <span style={{
                      font: '700 var(--rs-text-sm) var(--rs-font-mono)', minWidth: 32,
                      color: rank <= 3 ? 'var(--rs-sun)' : 'var(--rs-muted-on-dark)',
                    }}>
                      #{rank}
                    </span>
                    <Flag iso3={r.code} height={16} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--rs-space-2)', marginBottom: 'var(--rs-space-1)' }}>
                        <span style={{ font: '700 var(--rs-text-sm) var(--rs-font-body)' }}>{r.name}</span>
                        <span style={{
                          font: '700 var(--rs-text-sm) var(--rs-font-mono)', fontVariantNumeric: 'tabular-nums',
                          color: cfg.real ? 'var(--rs-real)' : 'var(--rs-fork)',
                        }}>
                          {cfg.fmt(r.value)}
                        </span>
                      </span>
                      <span className="game-stat-bar-container" style={{ display: 'block', height: 6 }}>
                        <span
                          className="game-stat-bar-fill"
                          style={{ display: 'block', height: '100%', width: `${pct}%`, background: cfg.real ? 'var(--rs-real)' : 'var(--rs-fork)' }}
                        />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
