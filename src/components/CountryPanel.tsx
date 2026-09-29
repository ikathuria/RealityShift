import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../lib/useIsMobile';
import { useWorldStore } from '../store/worldStore';
import { countryName } from '../data/countries';
import { hasGovernment } from '../data/government';
import type { CountryState } from '../store/worldStore';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import DecisionLog from './DecisionLog';
import AuthModal from './AuthModal';
import { useCountryEnrichment } from '../lib/useCountryEnrichment';
import { DC_KEYS, DC_INDICATOR_META } from '../data/dataCommons';

const INDICATOR_LABELS: Record<string, { label: string; unit: string; decimals: number }> = {
  gdp_per_capita:   { label: 'GDP per Capita',       unit: 'USD',    decimals: 0 },
  population:       { label: 'Population',            unit: '',       decimals: 0 },
  tax_rate:         { label: 'Tax Revenue',           unit: '% GDP',  decimals: 1 },
  military_spend:   { label: 'Military Spending',     unit: '% GDP',  decimals: 2 },
  education_spend:  { label: 'Education Spending',    unit: '% GDP',  decimals: 2 },
  healthcare_spend: { label: 'Healthcare Spending',   unit: '% GDP',  decimals: 2 },
  unemployment:     { label: 'Unemployment',          unit: '%',      decimals: 1 },
};

function fmt(value: number, decimals: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)         return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(decimals);
}

function IndicatorRow({ name, value }: { name: string; value: number | undefined }) {
  const meta = INDICATOR_LABELS[name];
  if (!meta) return null;
  
  // Calculate relative fill percentage for arcade health bar
  let pct = 50;
  if (value !== undefined) {
    if (name === 'gdp_per_capita') pct = Math.min(100, Math.max(5, (Math.log1p(value) / Math.log1p(100000)) * 100));
    else if (name === 'population') pct = Math.min(100, Math.max(5, (Math.log1p(value) / Math.log1p(1500000000)) * 100));
    else if (name === 'tax_rate') pct = Math.min(100, (value / 45) * 100);
    else if (name === 'unemployment') pct = Math.min(100, (value / 25) * 100);
    else pct = Math.min(100, (value / 8) * 100); // spend indicators
  }

  const barColor = name === 'military_spend' ? 'var(--accent-magenta)'
    : name === 'gdp_per_capita' ? 'var(--accent-yellow)'
    : name === 'education_spend' || name === 'healthcare_spend' ? 'var(--accent-cyan)'
    : 'var(--accent-green)';

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>{meta.label}</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, color: '#fff' }}>
          {value !== undefined ? `${fmt(value, meta.decimals)} ${meta.unit}`.trim() : '—'}
        </span>
      </div>
      <div className="game-stat-bar-container">
        <div
          className="game-stat-bar-fill"
          style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 6px ${barColor}` }}
        />
      </div>
    </div>
  );
}

/**
 * Real-world baselines from Data Commons (data.un.org), complementing the sim's
 * economic indicators above. Renders nothing until at least one value loads, so
 * the panel is unchanged when the enrichment proxy is unconfigured.
 */
function EnrichmentSection({ iso3 }: { iso3: string }) {
  const { data, loading } = useCountryEnrichment(iso3);
  const hasAny = data && DC_KEYS.some(k => typeof data[k] === 'number');
  if (loading && !hasAny) return null;
  if (!hasAny) return null;

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed rgba(255,255,255,0.15)' }}>
      <div className="game-badge game-badge-cyan" style={{ marginBottom: 10 }}>
        🌍 REAL-WORLD BASELINE
      </div>
      {DC_KEYS.map(key => {
        const value = data![key];
        if (typeof value !== 'number') return null;
        const meta = DC_INDICATOR_META[key];
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>{meta.label}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 12, color: '#fff' }}>
              {`${value.toFixed(meta.decimals)} ${meta.unit}`.trim()}
            </span>
          </div>
        );
      })}
      <div style={{ color: 'var(--text-muted)', fontSize: 9, marginTop: 6, fontFamily: 'var(--font-heading)' }}>
        SOURCE: DATA COMMONS · DATA.UN.ORG
      </div>
    </div>
  );
}

function CountryData({ data, iso3 }: { data: CountryState; iso3: string }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
        paddingTop: 6,
        borderTop: '1px dashed rgba(255,255,255,0.15)',
      }}>
        <div className="game-badge game-badge-yellow">
          SIM YEAR {data.year}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
          Updated: {new Date(data.last_updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
      </div>
      {Object.keys(INDICATOR_LABELS).map(key => (
        <IndicatorRow key={key} name={key} value={data.indicators[key]} />
      ))}
      <EnrichmentSection iso3={iso3} />
    </div>
  );
}

type PanelTab = 'indicators' | 'decisions';

export default function CountryPanel() {
  const { selectedCountry, countryData, selectCountry, activeWorldId } = useWorldStore();
  const { user, session } = useAuthStore();
  const { createFork, enterFork } = useGameStore();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<PanelTab>('indicators');
  const [showAuth, setShowAuth] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);

  if (!selectedCountry) return null;

  const data = countryData[selectedCountry];
  const isLive = activeWorldId === 'live';

  const handleTakeOver = async () => {
    if (!user || !session) { setShowAuth(true); return; }
    setTakingOver(true);
    setTakeoverError(null);
    const result = await createFork(selectedCountry, session.access_token);
    setTakingOver(false);
    if (typeof result === 'string') { setTakeoverError(result); return; }
    enterFork({ worldId: result.worldId, countryCode: selectedCountry, year: result.year, createdAt: new Date().toISOString() });
    navigate(`/play/${result.worldId}`);
  };

  return (
    <>
    {showAuth && (
      <AuthModal
        onClose={() => setShowAuth(false)}
        onSuccess={() => { setShowAuth(false); handleTakeOver(); }}
      />
    )}
    <div
      className="game-panel"
      style={{
        position: 'absolute',
        // Mobile: a bottom sheet, so it never collides with the now-taller
        // stacked header at the top. Desktop: the top-right dossier card.
        ...(isMobile
          ? { left: 0, right: 0, bottom: 0, top: 'auto', width: '100%', maxHeight: '72vh', borderRadius: '16px 16px 0 0' }
          : { top: 76, right: 16, width: 330, maxHeight: 'calc(100vh - 96px)' }),
        color: '#fff', padding: '18px 16px', overflowY: 'auto',
        boxSizing: 'border-box',
        zIndex: 35,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div className="game-badge" style={{ marginBottom: 4 }}>
            NATIONAL DOSSIER
          </div>
          <div className="game-font-heading" style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-yellow)' }}>
            {countryName(selectedCountry)}
          </div>
        </div>
        <button
          onClick={() => selectCountry(null)}
          className="game-button game-button-dark"
          style={{
            padding: '2px 8px', fontSize: 16, lineHeight: 1, minWidth: 28, height: 28,
          }}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['indicators', 'decisions'] as PanelTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`game-button ${tab === t ? 'game-button-cyan' : 'game-button-dark'}`}
            style={{
              flex: 1, padding: '6px 0', fontSize: 11, height: 32,
            }}
          >
            {t === 'indicators' ? '📊 STATS' : '📜 AGENT LOG'}
          </button>
        ))}
      </div>

      {/* Body */}
      {tab === 'indicators' ? (
        !data
          ? <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading indicators…</div>
          : <CountryData data={data} iso3={selectedCountry} />
      ) : (
        <DecisionLog countryCode={selectedCountry} />
      )}

      {/* View Government graph — only for countries with a hand-authored power map */}
      {hasGovernment(selectedCountry) && (
        <button
          onClick={() => navigate(`/gov/${selectedCountry}`)}
          className="game-button game-button-dark"
          style={{ width: '100%', padding: '10px 0', fontSize: 12, marginTop: 14 }}
        >
          🏛️ VIEW GOVERNMENT GRAPH
        </button>
      )}

      {/* Take Over button — only on live world */}
      {isLive && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '2px dashed rgba(255,255,255,0.15)' }}>
          {takeoverError && (
            <div style={{
              color: '#FF2E93', fontSize: 11, marginBottom: 8,
              background: 'rgba(255,46,147,0.15)', padding: '6px 10px', borderRadius: 6,
              border: '1px solid var(--accent-magenta)',
              fontFamily: 'var(--font-heading)',
            }}>
              ⚠️ {takeoverError}
            </div>
          )}
          <button
            onClick={handleTakeOver}
            disabled={takingOver}
            className="game-button game-button-green"
            style={{
              width: '100%', padding: '12px 0', fontSize: 14,
              boxShadow: 'var(--hud-shadow), var(--hud-shadow-glow-green)',
            }}
          >
            {takingOver ? '⏳ FORKING UNIVERSE…' : `🎮 TAKE OVER ${countryName(selectedCountry).toUpperCase()}`}
          </button>
          <div style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'center', marginTop: 6, fontFamily: 'var(--font-heading)' }}>
            {user ? 'FORKS SIMULATION INTO PARALLEL UNIVERSE' : 'SIGN IN TO COMMAND THIS NATION'}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
