import type { WorldEvent } from '../store/worldStore';

const EVENT_META: Record<string, { icon: string; color: string; label: string }> = {
  sanction:            { icon: '🚫', color: '#f87171', label: 'Sanction'        },
  trade_deal:          { icon: '🤝', color: '#34d399', label: 'Trade Deal'      },
  military_posture:    { icon: '⚔️',  color: '#fbbf24', label: 'Military'       },
  diplomatic_protest:  { icon: '📣', color: '#fb923c', label: 'Protest'         },
  alliance_formed:     { icon: '🔗', color: '#a78bfa', label: 'Alliance'        },
  alliance_broken:     { icon: '💔', color: '#f87171', label: 'Alliance Broken' },
  conflict_risk:       { icon: '🔴', color: '#ef4444', label: 'Conflict Risk'   },
};

function EventRow({ event }: { event: WorldEvent }) {
  const meta = EVENT_META[event.event_type] ?? { icon: '🌐', color: '#9ca3af', label: event.event_type };

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          color: meta.color, background: `${meta.color}18`,
          padding: '2px 6px', borderRadius: 4,
        }}>
          {meta.label}
        </span>
        <span style={{ color: '#6b7280', fontSize: 11, marginLeft: 'auto' }}>
          yr {event.sim_year}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 12 }}>{event.from_country}</span>
        {event.to_country && (
          <>
            <span style={{ color: '#4b5563', fontSize: 11 }}>→</span>
            <span style={{ fontWeight: 600, fontSize: 12 }}>{event.to_country}</span>
          </>
        )}
      </div>

      <p style={{ color: '#9ca3af', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
        {event.details.slice(0, 160)}{event.details.length > 160 ? '…' : ''}
      </p>
    </div>
  );
}

interface Props {
  events: WorldEvent[];
  maxHeight?: number;
}

export default function WorldEventsFeed({ events, maxHeight }: Props) {
  if (!events.length) {
    return (
      <p style={{ color: '#4b5563', fontSize: 13 }}>
        No inter-country events recorded yet. Events appear after the first agent simulation cycle.
      </p>
    );
  }

  return (
    <div style={{ overflowY: 'auto', maxHeight: maxHeight }}>
      {events.map(e => <EventRow key={e.id} event={e} />)}
    </div>
  );
}
