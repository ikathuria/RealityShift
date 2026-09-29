import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/worldStore';
import { countryName } from '../data/countries';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import AuthModal from './AuthModal';

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

function fmtVal(field: SortField, val: number): string {
  if (field === 'gdp_per_capita') return `$${Math.round(val).toLocaleString()}`;
  if (field === 'divergence') return `${val.toFixed(1)} pts`;
  if (field === 'year') return `${val}`;
  if (field === 'name') return '';
  return `${val.toFixed(1)}%`;
}

export default function CountryTable() {
  const { countryData, recentDivergences, selectCountry, selectedCountry, loadAllCountries } = useWorldStore();
  const { user, session } = useAuthStore();
  const { createFork, enterFork } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadAllCountries();
  }, [loadAllCountries]);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('gdp_per_capita');
  const [sortAsc, setSortAsc] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [targetTakeover, setTargetTakeover] = useState<string | null>(null);

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
        gdp_per_capita: ind.gdp_per_capita ?? 0,
        military_spend: ind.military_spend ?? 0,
        education_spend: ind.education_spend ?? 0,
        healthcare_spend: ind.healthcare_spend ?? 0,
        unemployment: ind.unemployment ?? 0,
        tax_rate: ind.tax_rate ?? 0,
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
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;
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
    if (!user || !session) {
      setTargetTakeover(code);
      setShowAuth(true);
      return;
    }
    const result = await createFork(code, session.access_token);
    if (typeof result === 'string') return;
    enterFork({ worldId: result.worldId, countryCode: code, year: result.year, createdAt: new Date().toISOString() });
    navigate(`/play/${result.worldId}`);
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

      <div className="game-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: 20 }}>
        {/* Table Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div>
            <div className="game-badge game-badge-yellow" style={{ marginBottom: 4 }}>
              WORLD DATABASE TABLE · {rows.length} NATIONS TRACKED
            </div>
            <div className="game-font-heading" style={{ fontSize: 20, color: '#fff' }}>
              ALL COUNTRY SIMULATION INDICATORS
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="🔍 Search nation or code..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'var(--bg-hud-card)',
                border: '2px solid var(--game-border-ink)',
                borderRadius: 'var(--radius-game-sm)',
                color: '#fff',
                padding: '8px 14px',
                fontSize: 13,
                fontFamily: 'var(--font-heading)',
                outline: 'none',
                minWidth: 220,
              }}
            />
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div style={{ flex: 1, overflow: 'auto', border: '2px solid var(--game-border-ink)', borderRadius: 'var(--radius-game-md)', background: '#090d1a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#12182b', borderBottom: '3px solid var(--game-border-ink)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>#</th>
                <th onClick={() => handleSort('name')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'name' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  NATION {sortField === 'name' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('year')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'year' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  YEAR {sortField === 'year' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('gdp_per_capita')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'gdp_per_capita' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  GDP / CAPITA {sortField === 'gdp_per_capita' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('military_spend')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'military_spend' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  MILITARY {sortField === 'military_spend' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('education_spend')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'education_spend' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  EDUCATION {sortField === 'education_spend' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('healthcare_spend')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'healthcare_spend' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  HEALTHCARE {sortField === 'healthcare_spend' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('unemployment')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'unemployment' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  UNEMPLOYMENT {sortField === 'unemployment' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th onClick={() => handleSort('divergence')} style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: sortField === 'divergence' ? 'var(--accent-yellow)' : '#fff', cursor: 'pointer' }}>
                  DIVERGENCE {sortField === 'divergence' ? (sortAsc ? '▲' : '▼') : ''}
                </th>
                <th style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: 'var(--text-muted)', textAlign: 'right' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr>
                  <td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No matching country records found.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const isSelected = selectedCountry === r.code;
                  return (
                    <tr
                      key={r.code}
                      onClick={() => selectCountry(r.code)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: isSelected ? 'rgba(0, 240, 255, 0.12)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: 'var(--text-muted)', fontSize: 11 }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{r.name}</span>
                          <span className="game-badge" style={{ fontSize: 9, padding: '1px 5px' }}>{r.code}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', color: 'var(--accent-yellow)' }}>
                        {r.year}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                        {fmtVal('gdp_per_capita', r.gdp_per_capita)}
                      </td>
                      <td style={{ padding: '12px 14px', color: r.military_spend > 3 ? 'var(--accent-magenta)' : '#fff' }}>
                        {r.military_spend.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {r.education_spend.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {r.healthcare_spend.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px 14px', color: r.unemployment > 10 ? 'var(--accent-magenta)' : 'var(--text-secondary)' }}>
                        {r.unemployment.toFixed(1)}%
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {r.divergence > 0 ? (
                          <span className="game-badge game-badge-yellow" style={{ fontSize: 10 }}>
                            ⚡ {r.divergence.toFixed(1)} pts
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTakeOver(r.code);
                          }}
                          className="game-button game-button-green"
                          style={{ padding: '4px 10px', fontSize: 10, height: 26 }}
                        >
                          🎮 COMMAND
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
