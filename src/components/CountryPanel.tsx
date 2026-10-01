import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../lib/useIsMobile';
import { useWorldStore } from '../store/worldStore';
import { countryName } from '../data/countries';
import { hasGovernment } from '../data/government';
import type { AgentDecision, CountryState } from '../store/worldStore';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import DecisionLog from './DecisionLog';
import { AgentAvatar, Flag } from './GameIcons';
import AuthModal from './AuthModal';
import { useCountryEnrichment } from '../lib/useCountryEnrichment';
import { DC_KEYS, DC_INDICATOR_META } from '../data/dataCommons';

const INDICATOR_LABELS: Record<string, { label: string; unit: string; decimals: number }> = {
  gdp_per_capita:   { label: 'GDP per capita',       unit: 'USD',    decimals: 0 },
  population:       { label: 'Population',            unit: '',       decimals: 0 },
  tax_rate:         { label: 'Tax revenue',           unit: '% GDP',  decimals: 1 },
  military_spend:   { label: 'Military spending',     unit: '% GDP',  decimals: 2 },
  education_spend:  { label: 'Education spending',    unit: '% GDP',  decimals: 2 },
  healthcare_spend: { label: 'Healthcare spending',   unit: '% GDP',  decimals: 2 },
  unemployment:     { label: 'Unemployment',          unit: '%',      decimals: 1 },
};

function fmt(value: number, decimals: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)         return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(decimals);
}

// Relative fill percentage for the arcade health bar
function barPct(name: string, value: number): number {
  if (name === 'gdp_per_capita') return Math.min(100, Math.max(5, (Math.log1p(value) / Math.log1p(100000)) * 100));
  if (name === 'population') return Math.min(100, Math.max(5, (Math.log1p(value) / Math.log1p(1500000000)) * 100));
  if (name === 'tax_rate') return Math.min(100, (value / 45) * 100);
  if (name === 'unemployment') return Math.min(100, (value / 25) * 100);
  return Math.min(100, (value / 8) * 100); // spend indicators
}

// Indicators where going up is bad news, so the arrow colours flip.
const HIGHER_IS_WORSE = new Set(['unemployment']);

/**
 * Change since the previous turn. Prefer the agent's explicit policy lever
 * (`<name>_delta`); otherwise diff the last two turns' projected indicators.
 * Returns null when there isn't enough history to say anything honest.
 */
function turnDelta(name: string, decisions: AgentDecision[] | undefined): number | null {
  const [latest, previous] = decisions ?? [];
  if (!latest) return null;
  const lever = latest.decision[`${name}_delta`];
  if (typeof lever === 'number') return lever;
  const now = latest.projected_indicators?.[name];
  const before = previous?.projected_indicators?.[name];
  if (typeof now === 'number' && typeof before === 'number') return now - before;
  return null;
}

function DeltaBadge({ name, delta, value }: { name: string; delta: number; value: number }) {
  if (Math.abs(delta) < 1e-6) return null;
  const up = delta > 0;
  const good = up !== HIGHER_IS_WORSE.has(name);
  // Large-magnitude indicators read better as a percentage change.
  const text = name === 'gdp_per_capita' || name === 'population'
    ? `${Math.abs((delta / (value - delta)) * 100).toFixed(1)}%`
    : Math.abs(delta).toFixed(2);
  return (
    <span
      className={`game-delta ${good ? 'is-good' : 'is-bad'}`}
      title="Change since last turn"
      aria-label={`${up ? 'up' : 'down'} ${text} since last turn`}
    >
      {up ? '▲' : '▼'} {text}
    </span>
  );
}

function IndicatorRow({ name, value, delta }: { name: string; value: number | undefined; delta: number | null }) {
  const meta = INDICATOR_LABELS[name];
  if (!meta) return null;

  const pct = value !== undefined ? barPct(name, value) : 50;
  const prevPct = value !== undefined && delta !== null ? barPct(name, value - delta) : null;


  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--rs-text-sm)', fontWeight: 700 }}>{meta.label}</span>
        <span style={{ fontFamily: 'var(--rs-font-mono)', fontWeight: 700, fontSize: 'var(--rs-text-sm)', color: 'var(--rs-ink)', display: 'inline-flex', gap: 6, alignItems: 'baseline' }}>
          {value !== undefined ? `${fmt(value, meta.decimals)} ${meta.unit}`.trim() : '—'}
          {value !== undefined && delta !== null && <DeltaBadge name={name} delta={delta} value={value} />}
        </span>
      </div>
      <div className="game-stat-bar-container">
        <div
          className="game-stat-bar-fill"
          style={{ width: `${pct}%` }}
        />
        {prevPct !== null && Math.abs(prevPct - pct) > 0.5 && (
          <span className="game-stat-bar-ghost" style={{ left: `${prevPct}%` }} title="Last turn" />
        )}
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
    <div style={{ marginTop: 'var(--rs-space-4)', paddingTop: 'var(--rs-space-3)', borderTop: 'var(--rs-border-thin)' }}>
      <div className="game-badge rs-chip-real" style={{ marginBottom: 'var(--rs-space-3)' }}>
        Real-world baseline
      </div>
      {DC_KEYS.map(key => {
        const value = data![key];
        if (typeof value !== 'number') return null;
        const meta = DC_INDICATOR_META[key];
        return (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-xs)', fontWeight: 700 }}>{meta.label}</span>
            <span style={{ fontFamily: 'var(--rs-font-mono)', fontWeight: 700, fontSize: 'var(--rs-text-sm)', color: 'var(--rs-ink)' }}>
              {`${value.toFixed(meta.decimals)} ${meta.unit}`.trim()}
            </span>
          </div>
        );
      })}
      <div style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-2xs)', fontWeight: 700, marginTop: 6 }}>
        SOURCE: DATA COMMONS · DATA.UN.ORG
      </div>
    </div>
  );
}

/** The latest thing the AI government did, in its own words. */
function AgentQuote({ decision, onOpenLog }: { decision: AgentDecision; onOpenLog: () => void }) {
  const text = decision.reasoning.length > 140 ? `${decision.reasoning.slice(0, 140).trimEnd()}…` : decision.reasoning;
  return (
    <div className="game-agent-quote">
      <AgentAvatar />
      <div style={{ minWidth: 0 }}>
        <div className="game-eyebrow" style={{ marginBottom: 2 }}>AI government · {decision.year}</div>
        <p style={{ margin: 0, fontSize: 'var(--rs-text-sm)', fontWeight: 600, lineHeight: 1.45, color: 'var(--rs-ink)' }}>“{text}”</p>
        <button type="button" className="game-link" onClick={onOpenLog}>Read the full log →</button>
      </div>
    </div>
  );
}

function CountryData({ data, iso3 }: { data: CountryState; iso3: string }) {
  const decisions = useWorldStore(s => s.countryDecisions[iso3]);
  return (
    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
        paddingTop: 6,
        borderTop: 'var(--rs-border-thin)',
      }}>
        <div className="game-badge game-badge-yellow">
          SIM YEAR {data.year}
        </div>
        <div style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-xs)', fontWeight: 700 }}>
          Updated: {new Date(data.last_updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
      </div>
      {Object.keys(INDICATOR_LABELS).map(key => (
        <IndicatorRow key={key} name={key} value={data.indicators[key]} delta={turnDelta(key, decisions)} />
      ))}
      <EnrichmentSection iso3={iso3} />
    </div>
  );
}

type PanelTab = 'indicators' | 'decisions';

export default function CountryPanel() {
  const { selectedCountry, countryData, countryDecisions, selectCountry, activeWorldId } = useWorldStore();
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
  const latestDecision = countryDecisions[selectedCountry]?.[0];
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
      className="rs-paper"
      style={{
        position: 'absolute',
        // Mobile: a bottom sheet, so it never collides with the now-taller
        // stacked header at the top. Desktop: the top-right dossier card.
        ...(isMobile
          ? { left: 0, right: 0, bottom: 0, top: 'auto', width: '100%', maxHeight: '72vh', borderRadius: 'var(--rs-radius-lg) var(--rs-radius-lg) 0 0', boxShadow: 'none' }
          : { top: 84, right: 'var(--rs-space-5)', width: 340, maxHeight: 'calc(100vh - 108px)' }),
        padding: 'var(--rs-space-4)', overflowY: 'auto',
        boxSizing: 'border-box',
        zIndex: 35,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Flag iso3={selectedCountry} height={36} />
          <div>
          <div className="game-eyebrow" style={{ marginBottom: 4 }}>
            National dossier · {selectedCountry}
          </div>
          <h2 style={{ font: '700 var(--rs-text-xl)/1.05 var(--rs-font-display)', margin: 0 }}>
            {countryName(selectedCountry)}
          </h2>
          </div>
        </div>
        <button
          onClick={() => selectCountry(null)}
          className="game-button game-button-dark"
          style={{
            padding: 0, fontSize: 'var(--rs-text-lg)', minWidth: 44, minHeight: 44,
          }}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="game-segmented" role="tablist" style={{ marginBottom: 16 }}>
        {(['indicators', 'decisions'] as PanelTab[]).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t === 'indicators' ? 'Stats' : 'Agent log'}
          </button>
        ))}
      </div>

      {/* Body */}
      {tab === 'indicators' ? (
        !data
          ? <div style={{ color: 'var(--rs-muted-on-paper)', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading indicators…</div>
          : <>
              {latestDecision && <AgentQuote decision={latestDecision} onOpenLog={() => setTab('decisions')} />}
              <CountryData data={data} iso3={selectedCountry} />
            </>
      ) : (
        <DecisionLog countryCode={selectedCountry} />
      )}

      {/* View Government graph — only for countries with a hand-authored power map */}
      {hasGovernment(selectedCountry) && (
        <button
          onClick={() => navigate(`/gov/${selectedCountry}`)}
          className="game-button game-button-dark"
          style={{ width: '100%', marginTop: 'var(--rs-space-3)' }}
        >
          View government graph
        </button>
      )}

      {/* Take Over button — only on live world */}
      {isLive && (
        // Sticky so the primary action never scrolls out of a tall dossier.
        <div style={{
          position: 'sticky', bottom: 'calc(-1 * var(--rs-space-4))',
          margin: 'var(--rs-space-4) calc(-1 * var(--rs-space-4)) calc(-1 * var(--rs-space-4))',
          padding: 'var(--rs-space-3) var(--rs-space-4) var(--rs-space-4)',
          background: 'var(--rs-paper)', borderTop: 'var(--rs-border-thin)',
        }}>
          {takeoverError && (
            <div style={{
              color: 'var(--rs-ink)', fontSize: 'var(--rs-text-sm)', fontWeight: 700, marginBottom: 'var(--rs-space-2)',
              background: 'var(--rs-fork-tint)', padding: 'var(--rs-space-2) var(--rs-space-3)', borderRadius: 'var(--rs-radius-sm)',
              border: 'var(--rs-border-thin)',
            }}>
              {takeoverError}
            </div>
          )}
          <button
            onClick={handleTakeOver}
            disabled={takingOver}
            className="game-button rs-button-lg"
            style={{ width: '100%' }}
          >
            {takingOver ? 'Forking universe…' : `Take over ${countryName(selectedCountry)}!`}
          </button>
          <div style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-xs)', fontWeight: 700, textAlign: 'center', marginTop: 'var(--rs-space-2)' }}>
            {user ? 'Replaces the AI. The world forks from here.' : 'Sign in to command this nation'}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
