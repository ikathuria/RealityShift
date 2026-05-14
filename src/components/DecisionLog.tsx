import { useWorldStore } from '../store/worldStore';
import type { AgentDecision } from '../store/worldStore';

function DecisionEntry({ d }: { d: AgentDecision }) {
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Year {d.year}</span>
        {d.historical_parallel && (
          <span style={{
            fontSize: 10, color: '#a78bfa',
            background: 'rgba(167,139,250,0.1)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            ⟳ {d.historical_parallel.name}
          </span>
        )}
      </div>

      <p style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.5, margin: '0 0 6px' }}>
        {d.reasoning}
      </p>

      {/* Policy deltas */}
      {Object.keys(d.decision).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Object.entries(d.decision)
            .filter(([, v]) => typeof v === 'number' && Math.abs(v as number) > 0.001)
            .map(([k, v]) => {
              const val = v as number;
              return (
                <span key={k} style={{
                  fontSize: 10,
                  color: val > 0 ? '#34d399' : '#f87171',
                  background: val > 0 ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                  padding: '2px 6px', borderRadius: 4,
                }}>
                  {k.replace(/_delta$/, '').replace(/_/g, ' ')} {val > 0 ? '+' : ''}{val.toFixed(2)}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default function DecisionLog({ countryCode }: { countryCode: string }) {
  const decisions = useWorldStore(s => s.countryDecisions[countryCode]);

  if (!decisions) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>Loading decision log…</p>;
  }

  if (decisions.length === 0) {
    return <p style={{ color: '#6b7280', fontSize: 13 }}>No agent decisions recorded yet.</p>;
  }

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Agent Decision Log
      </div>
      {decisions.map(d => <DecisionEntry key={d.id} d={d} />)}
    </div>
  );
}
