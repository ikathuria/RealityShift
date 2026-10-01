import type { Divergence } from '../store/worldStore';
import { countryName } from '../data/countries';
import { Flag } from './GameIcons';

/** One indicator's sim-minus-reality gap. Sits on a dark HUD surface, so the
 *  coral fork pill carries the value and the arrow carries the direction. */
function DeltaRow({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 'var(--rs-space-2)', padding: 'var(--rs-space-1) 0',
      font: '700 var(--rs-text-sm) var(--rs-font-body)',
    }}>
      <span style={{ color: 'var(--rs-muted-on-dark)', textTransform: 'capitalize' }}>{label}</span>
      <span className="rs-pill rs-pill-fork" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span aria-hidden="true">{positive ? '▲' : '▼'} </span>
        <span className="rs-sr-only">{positive ? 'Fork above reality by ' : 'Fork below reality by '}</span>
        {positive ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

export default function DivergenceCard({ div }: { div: Divergence }) {
  const deltaEntries = Object.entries(div.delta).filter(([, v]) => Math.abs(v) > 0.001);
  const magnitude = deltaEntries.reduce((a, [, v]) => a + Math.abs(v), 0);
  const severity = magnitude > 5 ? 'Big drift' : magnitude > 2 ? 'Some drift' : 'Light drift';

  return (
    <article style={{
      background: 'var(--rs-hud)',
      border: 'var(--rs-border-thin)',
      outline: '1px solid var(--rs-hud-line)',
      outlineOffset: -4,
      borderRadius: 'var(--rs-radius-md)',
      padding: 'var(--rs-space-3) var(--rs-space-4)',
      marginBottom: 'var(--rs-space-3)',
      color: 'var(--rs-text-on-dark)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--rs-space-2)', marginBottom: 'var(--rs-space-2)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)' }}>
          <Flag iso3={div.country_code} height={16} />
          {/* ISO3 codes are developer-facing; lead with the readable name. */}
          <h3 style={{ margin: 0, font: '700 var(--rs-text-md) var(--rs-font-display)' }}>
            {countryName(div.country_code)}
          </h3>
          <span className="game-badge rs-chip-fork">{severity}</span>
        </div>
        {/* Explicit day-month-year: toLocaleDateString() renders 28/07/2026,
            which is ambiguous across locales. */}
        <span style={{ color: 'var(--rs-muted-on-dark)', font: '700 var(--rs-text-xs) var(--rs-font-mono)' }}>
          Sim year {div.sim_year} ·{' '}
          {new Date(div.published_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </span>
      </div>

      {/* Narrative */}
      <p style={{ font: '500 var(--rs-text-sm)/1.45 var(--rs-font-body)', color: 'var(--rs-text-on-dark)', margin: '0 0 var(--rs-space-2)' }}>
        {div.narrative.split('\n\nNews used:')[0].slice(0, 200)}
        {div.narrative.length > 200 ? '…' : ''}
      </p>

      {/* Deltas */}
      {deltaEntries.length > 0 && (
        <div style={{ borderTop: '1px solid var(--rs-hud-line)', paddingTop: 'var(--rs-space-2)' }}>
          {deltaEntries.slice(0, 4).map(([k, v]) => (
            <DeltaRow key={k} label={k.replace(/_/g, ' ')} value={v} />
          ))}
        </div>
      )}
    </article>
  );
}
