import { useEffect, useState } from 'react';
import { fetchMediaIndex, type MediaEntry } from '../lib/mediaIndex';
import { countryName } from '../data/countries';
import { useIsMobile } from '../lib/useIsMobile';
import ProvenancePanel from './ProvenancePanel';

/**
 * Plays a divergence broadcast alongside its provenance.
 *
 * Reads the media index (same source as the front-page wall), takes the
 * broadcast entries, and shows the video with the ProvenancePanel next to it —
 * the "watch the newscast, then verify it's from a world that doesn't exist"
 * moment.
 */
export default function BroadcastPlayer({ worldId = 'live' }: { worldId?: string }) {
  const [broadcasts, setBroadcasts] = useState<MediaEntry[] | null>(null);
  const [active, setActive] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    let live = true;
    fetchMediaIndex(worldId).then(idx => {
      if (live) setBroadcasts(idx ? idx.media.filter(m => m.kind === 'broadcast') : []);
    });
    return () => { live = false; };
  }, [worldId]);

  if (broadcasts === null) {
    return (
      <p role="status" style={{ padding: 'var(--rs-space-5)', margin: 0, color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)' }}>
        Tuning in to this world's newsroom…
      </p>
    );
  }
  if (broadcasts.length === 0) {
    return (
      <p style={{ padding: 'var(--rs-space-5)', margin: 0, color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)', lineHeight: 1.45 }}>
        Nothing on air yet. Broadcasts appear here once the newsroom renders one
        (run <code style={{ fontFamily: 'var(--rs-font-mono)', color: 'var(--rs-text-on-dark)' }}>rs-media batch … --broadcast IND</code>).
        The front pages below are still worth a read.
      </p>
    );
  }

  const entry = broadcasts[Math.min(active, broadcasts.length - 1)];

  return (
    <div>
      {broadcasts.length > 1 && (
        <div role="group" aria-label="Choose a broadcast" style={{ display: 'flex', gap: 'var(--rs-space-2)', flexWrap: 'wrap', marginBottom: 'var(--rs-space-4)' }}>
          {broadcasts.map((b, i) => (
            <button
              key={b.canonical_hash}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`game-button ${i === active ? 'rs-button-fork' : 'game-button-dark'}`}
              style={{ fontSize: 'var(--rs-text-sm)' }}
            >
              {countryName(b.nation_iso)} · {b.sim_date.slice(0, 4)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 'var(--rs-space-5)', alignItems: 'start' }}>
        <div>
          <video
            key={entry.b2_url}
            src={entry.b2_url}
            controls
            playsInline
            aria-label={`Broadcast from a forked ${countryName(entry.nation_iso)}, year ${entry.sim_date.slice(0, 4)}`}
            style={{
              width: '100%', display: 'block', borderRadius: 'var(--rs-radius-md)', background: 'var(--rs-ink)',
              border: 'var(--rs-border)', boxShadow: 'var(--rs-shadow-md)',
            }}
          />
          <div style={{
            marginTop: 'var(--rs-space-3)', fontSize: 'var(--rs-text-sm)', fontWeight: 700, color: 'var(--rs-text-on-dark)',
            display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)', flexWrap: 'wrap',
          }}>
            <span className="game-badge rs-chip-fork">Fork</span>
            {countryName(entry.nation_iso)} evening news, year {entry.sim_date.slice(0, 4)}
            {entry.duration ? <span style={{ fontFamily: 'var(--rs-font-mono)', color: 'var(--rs-muted-on-dark)' }}>· {Math.round(entry.duration)}s</span> : null}
          </div>
        </div>
        <ProvenancePanel entry={entry} />
      </div>
    </div>
  );
}
