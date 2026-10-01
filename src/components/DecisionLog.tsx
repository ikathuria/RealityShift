import { useWorldStore } from '../store/worldStore';
import type { AgentDecision } from '../store/worldStore';

function DecisionEntry({ d }: { d: AgentDecision }) {
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: 'var(--rs-border-thin)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ font: '700 var(--rs-text-md) var(--rs-font-display)' }}>Year {d.year}</span>
        {d.historical_parallel && (
          <span className="game-badge" title="Closest historical parallel" style={{ textTransform: 'none', letterSpacing: 0, maxWidth: '60%' }}>
            Like {d.historical_parallel.name}
          </span>
        )}
      </div>

      <p style={{ fontSize: 'var(--rs-text-sm)', fontWeight: 500, lineHeight: 1.5, margin: '0 0 var(--rs-space-2)' }}>
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
                <span key={k} className="game-badge" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  {k.replace(/_delta$/, '').replace(/_/g, ' ')} {val > 0 ? '▲' : '▼'} {Math.abs(val).toFixed(2)}
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
    return <p style={{ fontSize: 'var(--rs-text-sm)', fontWeight: 600 }}>Loading the agent's decision log…</p>;
  }

  if (decisions.length === 0) {
    return <p style={{ fontSize: 'var(--rs-text-sm)', fontWeight: 600 }}>No decisions yet. The agent acts on the next turn.</p>;
  }

  return (
    <div>
      <div className="game-eyebrow" style={{ marginBottom: 'var(--rs-space-2)' }}>
        Agent decision log
      </div>
      {decisions.map(d => <DecisionEntry key={d.id} d={d} />)}
    </div>
  );
}
