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
    return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading broadcast…</div>;
  }
  if (broadcasts.length === 0) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
        No broadcast generated yet. Run <code>rs-media batch … --broadcast IND</code> to add one.
      </div>
    );
  }

  const entry = broadcasts[Math.min(active, broadcasts.length - 1)];

  return (
    <div>
      {broadcasts.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {broadcasts.map((b, i) => (
            <button
              key={b.canonical_hash}
              onClick={() => setActive(i)}
              style={{
                minHeight: 26, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
                fontSize: 'var(--font-size-xs)',
                border: i === active ? '1px solid rgba(99,102,241,0.5)' : 'var(--border-subtle)',
                background: i === active ? 'rgba(99,102,241,0.18)' : 'transparent',
                color: i === active ? 'var(--accent-text)' : 'var(--text-muted)',
              }}
            >
              {countryName(b.nation_iso)} · {b.sim_date.slice(0, 4)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 20, alignItems: 'start' }}>
        <div>
          <video
            key={entry.b2_url}
            src={entry.b2_url}
            controls
            playsInline
            style={{ width: '100%', borderRadius: 10, background: '#000', border: 'var(--border-subtle)' }}
          />
          <div style={{ marginTop: 8, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            {countryName(entry.nation_iso)} — divergence broadcast, sim year {entry.sim_date.slice(0, 4)}
            {entry.duration ? ` · ${Math.round(entry.duration)}s` : ''}
          </div>
        </div>
        <ProvenancePanel entry={entry} />
      </div>
    </div>
  );
}
