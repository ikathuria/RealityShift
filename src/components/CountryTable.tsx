import type React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/worldStore';
import { countryName } from '../data/countries';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import AuthModal from './AuthModal';
import { Flag } from './GameIcons';
import { isDemoWorld } from '../lib/demo';

const COLUMNS: { field: SortField; label: string }[] = [
  { field: 'name', label: 'Nation' },
  { field: 'year', label: 'Year' },
  { field: 'gdp_per_capita', label: 'GDP / capita' },
  { field: 'military_spend', label: 'Military' },
  { field: 'education_spend', label: 'Education' },
  { field: 'healthcare_spend', label: 'Healthcare' },
  { field: 'unemployment', label: 'Unemployment' },
  { field: 'divergence', label: 'Drift' },
];

const cell: React.CSSProperties = { padding: 'var(--rs-space-2) var(--rs-space-3)', borderBottom: '1px solid var(--rs-hud-line)' };
const num: React.CSSProperties = { ...cell, font: '700 var(--rs-text-sm) var(--rs-font-mono)', fontVariantNumeric: 'tabular-nums' };
const th: React.CSSProperties = {
  padding: 0, textAlign: 'left', whiteSpace: 'nowrap',
  font: '800 var(--rs-text-2xs) var(--rs-font-body)', letterSpacing: 'var(--rs-tracking-label)', textTransform: 'uppercase',
  color: 'var(--rs-muted-on-dark)', background: 'var(--rs-hud)', borderBottom: 'var(--rs-border-thin)',
};

type SortField =
  | 'name'
  | 'year'
  | 'gdp_per_capita'
  | 'military_spend'
  | 'education_spend'
  | 'healthcare_spend'
  | 'unemployment'
  | 'tax_rate'
  | 'divergence';

/** Indicator value, or null when this world has no number for it. */
function indicator(ind: Record<string, number>, key: string): number | null {
  const v = ind[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

const pct = (v: number | null, digits: number) => (v === null ? '—' : `${v.toFixed(digits)}%`);

export default function CountryTable() {
  const { countryData, recentDivergences, selectCountry, selectedCountry, loadAllCountries, allCountriesStatus, activeWorldId } = useWorldStore();
  const { createFork, enterFork } = useGameStore();
  const isSample = isDemoWorld(activeWorldId);
  const navigate = useNavigate();

  useEffect(() => {
    loadAllCountries();
  }, [loadAllCountries]);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('gdp_per_capita');
  const [sortAsc, setSortAsc] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [targetTakeover, setTargetTakeover] = useState<string | null>(null);
  const [takingOver, setTakingOver] = useState<string | null>(null);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);

  // Derive total divergence score per country
  const divergenceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of recentDivergences) {
      const mag = Object.values(d.delta).reduce((s, v) => s + Math.abs(v), 0);
      map.set(d.country_code, (map.get(d.country_code) ?? 0) + mag);
    }
    return map;
  }, [recentDivergences]);

  // Build rows array
  const rows = useMemo(() => {
    const list = Object.entries(countryData).map(([code, state]) => {
      const ind = state.indicators;
      return {
        code,
        name: countryName(code),
        year: state.year,
        gdp_per_capita: indicator(ind, 'gdp_per_capita'),
        military_spend: indicator(ind, 'military_spend'),
        education_spend: indicator(ind, 'education_spend'),
        healthcare_spend: indicator(ind, 'healthcare_spend'),
        unemployment: indicator(ind, 'unemployment'),
        tax_rate: indicator(ind, 'tax_rate'),
        divergence: divergenceMap.get(code) ?? 0,
      };
    });

    const query = search.trim().toLowerCase();
    const filtered = query
      ? list.filter(r => r.name.toLowerCase().includes(query) || r.code.toLowerCase().includes(query))
      : list;

    return filtered.sort((a, b) => {
      if (sortField === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      // Missing values always sink to the bottom, whichever way we sort.
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === null || valB === null) return valA === valB ? 0 : valA === null ? 1 : -1;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [countryData, divergenceMap, search, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleTakeOver = async (code: string) => {
    // Read auth at call time; AuthModal's onSuccess closure predates sign-in.
    const { user, session } = useAuthStore.getState();
    if (!user || !session) {
      setTargetTakeover(code);
      setShowAuth(true);
      return;
    }
    setTakingOver(code);
    setTakeoverError(null);
    try {
      const result = await createFork(code, session.access_token);
      if (typeof result === 'string') { setTakeoverError(`${countryName(code)}: ${result}`); return; }
      enterFork({ worldId: result.worldId, countryCode: code, year: result.year, createdAt: new Date().toISOString() });
      navigate(`/play/${result.worldId}`);
    } catch {
      setTakeoverError('Something went wrong forking the world. Try again.');
    } finally {
      setTakingOver(null);
    }
  };

  return (
    <>
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            if (targetTakeover) handleTakeOver(targetTakeover);
          }}
        />
      )}

      <section className="game-panel" aria-labelledby="country-table-title" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 'var(--rs-space-5)' }}>
        {/* Table control bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 'var(--rs-space-3)', marginBottom: 'var(--rs-space-4)' }}>
          <div>
            <div className="game-eyebrow" style={{ marginBottom: 'var(--rs-space-1)' }}>
              {Object.keys(countryData).length} nations with simulated state
              {isSample && <span className="game-badge" style={{ marginLeft: 'var(--rs-space-2)' }}>Sample data</span>}
            </div>
            <h2 id="country-table-title" style={{ margin: 0, font: '700 var(--rs-text-xl)/1 var(--rs-font-display)' }}>
              Nations by the numbers
            </h2>
          </div>
          <input
            type="search"
            aria-label="Search nations by name or code"
            placeholder="Search nation or code"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'var(--rs-space)',
              border: 'var(--rs-border-thin)',
              outline: '1px solid var(--rs-hud-line)',
              borderRadius: 'var(--rs-radius-md)',
              color: 'var(--rs-text-on-dark)',
              padding: '0 var(--rs-space-3)',
              minHeight: 44,
              font: '500 var(--rs-text-sm) var(--rs-font-body)',
              minWidth: 220,
            }}
          />
        </div>

        {takeoverError && (
          <p role="alert" style={{
            margin: '0 0 var(--rs-space-3)', padding: 'var(--rs-space-2) var(--rs-space-3)',
            background: 'var(--rs-fork-tint)', color: 'var(--rs-ink)', border: 'var(--rs-border-thin)',
            borderRadius: 'var(--rs-radius-sm)', font: '700 var(--rs-text-sm) var(--rs-font-body)',
          }}>
            {takeoverError}
          </p>
        )}

        {/* Scrollable data table: focusable so keyboard users can scroll it */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Nation table, scrollable"
          style={{ flex: 1, overflow: 'auto', border: 'var(--rs-border-thin)', borderRadius: 'var(--rs-radius-md)', background: 'var(--rs-hud)' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', font: '500 var(--rs-text-sm) var(--rs-font-body)', color: 'var(--rs-text-on-dark)' }}>
            <caption className="rs-sr-only">Simulated indicators for each nation this world tracks. Select a column header to sort.</caption>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th scope="col" style={{ ...th, padding: 'var(--rs-space-3)' }}>#</th>
                {COLUMNS.map(({ field, label }) => {
                  const active = sortField === field;
                  return (
                    <th
                      key={field}
                      scope="col"
                      aria-sort={active ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                      style={{ ...th, color: active ? 'var(--rs-sun)' : 'var(--rs-muted-on-dark)' }}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(field)}
                        style={{
                          all: 'unset', boxSizing: 'border-box', cursor: 'pointer', minHeight: 44, width: '100%',
                          padding: '0 var(--rs-space-3)', display: 'flex', alignItems: 'center', gap: 'var(--rs-space-1)',
                        }}
                      >
                        {label}
                        <span aria-hidden="true">{active ? (sortAsc ? '▲' : '▼') : ''}</span>
                      </button>
                    </th>
                  );
                })}
                <th scope="col" style={{ ...th, padding: 'var(--rs-space-3)', textAlign: 'right' }}>
                  <span className="rs-sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={10} style={{ ...cell, padding: 'var(--rs-space-6)', textAlign: 'center', color: 'var(--rs-muted-on-dark)' }}>
                    {search.trim()
                      ? 'No nation by that name. Try a three-letter code like FRA.'
                      : allCountriesStatus === 'error'
                        ? 'Could not load the nations table. Reload to try again.'
                        : allCountriesStatus === 'ready'
                          ? 'No nation has simulated state in this world yet.'
                          : 'Loading the nations table…'}
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const isSelected = selectedCountry === r.code;
                  return (
                    <tr
                      key={r.code}
                      onClick={() => selectCountry(r.code)}
                      aria-selected={isSelected}
                      style={{
                        background: isSelected ? 'var(--rs-real-deep)' : 'transparent',
                        boxShadow: isSelected ? 'inset 4px 0 0 var(--rs-sun)' : undefined,
                        cursor: 'pointer',
                        transition: 'background var(--rs-dur-fast)',
                      }}
                    >
                      <td style={{ ...num, color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)' }}>{i + 1}</td>
                      <th scope="row" style={{ ...cell, textAlign: 'left', font: '700 var(--rs-text-sm) var(--rs-font-body)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)' }}>
                          <Flag iso3={r.code} height={14} />
                          <span>{r.name}</span>
                          <span style={{ color: 'var(--rs-muted-on-dark)', font: '700 var(--rs-text-2xs) var(--rs-font-mono)' }}>{r.code}</span>
                        </span>
                      </th>
                      <td style={{ ...num, color: 'var(--rs-muted-on-dark)' }}>{r.year}</td>
                      <td style={num}>{r.gdp_per_capita === null ? '—' : `$${Math.round(r.gdp_per_capita).toLocaleString()}`}</td>
                      <td style={num}>{pct(r.military_spend, 2)}</td>
                      <td style={num}>{pct(r.education_spend, 2)}</td>
                      <td style={num}>{pct(r.healthcare_spend, 2)}</td>
                      <td style={num}>{pct(r.unemployment, 1)}</td>
                      <td style={cell}>
                        {r.divergence > 0 ? (
                          <span className="rs-pill rs-pill-fork" style={{ whiteSpace: 'nowrap' }}>
                            {r.divergence.toFixed(1)} pts
                          </span>
                        ) : (
                          <span style={{ color: 'var(--rs-muted-on-dark)' }} aria-label="No drift">—</span>
                        )}
                      </td>
                      <td style={{ ...cell, textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTakeOver(r.code);
                          }}
                          disabled={takingOver !== null}
                          className="game-button game-button-dark"
                          aria-label={`Take over ${r.name}`}
                          style={{ minHeight: 44, padding: '0 var(--rs-space-3)', fontSize: 'var(--rs-text-sm)', whiteSpace: 'nowrap' }}
                        >
                          {takingOver === r.code ? 'Forking…' : 'Take over'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
