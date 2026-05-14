import type { Divergence } from '../store/worldStore';

function DeltaRow({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  const color = positive ? '#f87171' : '#34d399'; // red = sim above reality, green = below
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>
        {positive ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

export default function DivergenceCard({ div }: { div: Divergence }) {
  const deltaEntries = Object.entries(div.delta).filter(([, v]) => Math.abs(v) > 0.001);
  const magnitude = deltaEntries.reduce((a, [, v]) => a + Math.abs(v), 0);
  const severeColor = magnitude > 5 ? '#f87171' : magnitude > 2 ? '#fbbf24' : '#34d399';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: severeColor,
            width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
          }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{div.country_code}</span>
          <span style={{ color: '#6b7280', fontSize: 12 }}>sim yr {div.sim_year}</span>
        </div>
        <span style={{ color: '#4b5563', fontSize: 11 }}>
          {new Date(div.published_at).toLocaleDateString()}
        </span>
      </div>

      {/* Narrative */}
      <p style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, margin: '0 0 8px' }}>
        {div.narrative.split('\n\nNews used:')[0].slice(0, 200)}
        {div.narrative.length > 200 ? '…' : ''}
      </p>

      {/* Deltas */}
      {deltaEntries.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
          {deltaEntries.slice(0, 4).map(([k, v]) => (
            <DeltaRow key={k} label={k.replace(/_/g, ' ')} value={v} />
          ))}
        </div>
      )}
    </div>
  );
}
