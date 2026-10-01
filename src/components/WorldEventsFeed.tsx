import type { WorldEvent } from '../store/worldStore';
import { countryName } from '../data/countries';
import { EventIcon, Flag } from './GameIcons';

// Event-type chips. Teal/coral are reserved for reality/fork, so event kinds
// use neutral paper chips; the hand-drawn EventIcon carries the type visually.
const EVENT_LABEL: Record<string, string> = {
  sanction:           'Sanction',
  trade_deal:         'Trade deal',
  military_posture:   'Military',
  diplomatic_protest: 'Protest',
  alliance_formed:    'Alliance',
  alliance_broken:    'Alliance broken',
  conflict_risk:      'Conflict risk',
};

function EventRow({ event }: { event: WorldEvent }) {
  const label = EVENT_LABEL[event.event_type] ?? event.event_type.replace(/_/g, ' ');

  return (
    <li
      style={{
        listStyle: 'none',
        marginBottom: 'var(--rs-space-2)',
        padding: 'var(--rs-space-3)',
        border: 'var(--rs-border-thin)',
        outline: '1px solid var(--rs-hud-line)',
        outlineOffset: -4,
        borderRadius: 'var(--rs-radius-md)',
        background: 'var(--rs-hud)',
        color: 'var(--rs-text-on-dark)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--rs-space-2)', alignItems: 'center', marginBottom: 'var(--rs-space-2)' }}>
        <EventIcon type={event.event_type} size={22} />
        <span className="game-badge">{label}</span>
        <span style={{ color: 'var(--rs-muted-on-dark)', font: '700 var(--rs-text-xs) var(--rs-font-mono)', marginLeft: 'auto' }}>
          Year {event.sim_year}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 'var(--rs-space-2)', alignItems: 'center', flexWrap: 'wrap', marginBottom: 'var(--rs-space-1)', font: '700 var(--rs-text-sm) var(--rs-font-body)' }}>
        <Flag iso3={event.from_country} height={12} />
        <span>{countryName(event.from_country)}</span>
        {event.to_country && (
          <>
            <span aria-label="to" style={{ color: 'var(--rs-muted-on-dark)' }}>→</span>
            <Flag iso3={event.to_country} height={12} />
            <span>{countryName(event.to_country)}</span>
          </>
        )}
      </div>

      <p style={{ color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-sm)/1.45 var(--rs-font-body)', margin: 0 }}>
        {event.details.slice(0, 160)}{event.details.length > 160 ? '…' : ''}
      </p>
    </li>
  );
}

interface Props {
  events: WorldEvent[];
  maxHeight?: number;
}

export default function WorldEventsFeed({ events, maxHeight }: Props) {
  if (!events.length) {
    return (
      <p style={{ color: 'var(--rs-muted-on-dark)', font: '500 var(--rs-text-sm) var(--rs-font-body)', textAlign: 'center', padding: 'var(--rs-space-4) 0', margin: 0 }}>
        No events yet. The world moves every turn.
      </p>
    );
  }

  const list = (
    <ul aria-label="World events" style={{ margin: 0, padding: 0 }}>
      {events.map(e => <EventRow key={e.id} event={e} />)}
    </ul>
  );
  if (maxHeight === undefined) return list;

  // A capped feed scrolls, so it must be keyboard reachable (axe scrollable-region-focusable).
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="World events feed"
      style={{ overflowY: 'auto', maxHeight, paddingRight: 'var(--rs-space-1)' }}
    >
      {list}
    </div>
  );
}
