import { useEffect, useState } from 'react';
import { useWorldStore } from '../store/worldStore';
import { countryName } from '../data/countries';
import { useIsMobile } from '../lib/useIsMobile';
import { EventIcon, Flag } from './GameIcons';

const ROTATE_MS = 6_000;

/**
 * "Breaking news" toasts in the corner of the globe, so the world visibly moves
 * while you watch. Shows the newest event plus the one before it, and steps
 * through the recent feed on a timer. Clicking a toast flies to its country.
 */
export default function EventTicker() {
  const { worldEvents, loadWorldEvents, selectCountry, selectedCountry } = useWorldStore();
  const isMobile = useIsMobile();
  const [index, setIndex] = useState(0);

  useEffect(() => { loadWorldEvents('live', 12); }, [loadWorldEvents]);

  useEffect(() => {
    if (worldEvents.length < 2) return;
    const id = window.setInterval(() => setIndex(i => (i + 1) % worldEvents.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [worldEvents.length]);

  // On phones the country panel is a bottom sheet; don't stack toasts under it.
  if (!worldEvents.length || (isMobile && selectedCountry)) return null;

  const shown = [worldEvents[index % worldEvents.length], worldEvents[(index + 1) % worldEvents.length]]
    .filter((e, i, arr) => arr.indexOf(e) === i);

  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute', left: 'var(--rs-space-5)', bottom: 'var(--rs-space-5)', zIndex: 25,
        width: isMobile ? 'calc(100% - 48px)' : 400,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      {shown.map((e, i) => (
        <button
          key={`${e.id}-${index}`}
          type="button"
          onClick={() => selectCountry(e.from_country)}
          className={`game-toast ${i === 0 ? 'is-new' : 'is-old'}`}
          style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--rs-font-body)', fontSize: 'var(--rs-text-sm)', fontWeight: 600 }}
        >
          <EventIcon type={e.event_type} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
              <span className="game-toast-tag">{i === 0 ? 'Breaking' : `Year ${e.sim_year}`}</span>
              <Flag iso3={e.from_country} height={12} />
              <strong style={{ fontWeight: 700 }}>
                {countryName(e.from_country)}{e.to_country ? ` → ${countryName(e.to_country)}` : ''}
              </strong>
            </span>
            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--rs-muted-on-paper)' }}>
              {e.details}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
