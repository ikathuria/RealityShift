import { useState } from 'react';
import { useWorldStore } from '../store/worldStore';
import type { CountryState } from '../store/worldStore';
import DecisionLog from './DecisionLog';

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
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ color: '#9ca3af' }}>{meta.label}</span>
      <span style={{ fontWeight: 500 }}>
        {value !== undefined ? `${fmt(value, meta.decimals)} ${meta.unit}`.trim() : '—'}
      </span>
    </div>
  );
}

function CountryData({ data }: { data: CountryState }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ marginBottom: 12, color: '#9ca3af', fontSize: 11 }}>
        Simulated year: <strong style={{ color: '#fff' }}>{data.year}</strong>
        &nbsp;·&nbsp;Updated: {new Date(data.last_updated).toLocaleDateString()}
      </div>
      {Object.keys(INDICATOR_LABELS).map(key => (
        <IndicatorRow key={key} name={key} value={data.indicators[key]} />
      ))}
    </div>
  );
}

type PanelTab = 'indicators' | 'decisions';

export default function CountryPanel() {
  const { selectedCountry, countryData, selectCountry } = useWorldStore();
  const [tab, setTab] = useState<PanelTab>('indicators');
  if (!selectedCountry) return null;

  const data = countryData[selectedCountry];

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 300, height: '100vh',
      background: 'rgba(10,10,20,0.88)', backdropFilter: 'blur(8px)',
      color: '#fff', padding: '20px 16px', overflowY: 'auto',
      borderLeft: '1px solid rgba(255,255,255,0.1)', boxSizing: 'border-box',
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
            Selected Country
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedCountry}</div>
        </div>
        <button
          onClick={() => selectCountry(null)}
          style={{
            background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
            fontSize: 20, lineHeight: 1, padding: 4,
          }}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {(['indicators', 'decisions'] as PanelTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: 'none',
              background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: tab === t ? '#fff' : '#6b7280',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}
          >
            {t === 'indicators' ? 'Indicators' : 'Agent Log'}
          </button>
        ))}
      </div>

      {/* Body */}
      {tab === 'indicators' ? (
        !data
          ? <div style={{ color: '#6b7280', fontSize: 13 }}>Loading…</div>
          : <CountryData data={data} />
      ) : (
        <DecisionLog countryCode={selectedCountry} />
      )}
    </div>
  );
}
