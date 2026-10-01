import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchMediaIndex, type MediaEntry } from '../lib/mediaIndex';
import { Link } from 'react-router-dom';
import { countryName } from '../data/countries';
import { Flag } from './GameIcons';

// Year straight from the ISO string. new Date('2025-01-01').getFullYear() parses
// as UTC midnight and shifts to the previous year in negative-offset zones.
const isoYear = (d: string): string => d.slice(0, 4);

/**
 * A wall of generated newspaper front pages for one world.
 *
 * Reads the media index straight from B2 (see lib/mediaIndex) and streams each
 * image from its durable URL — no Worker or Supabase round-trip. Front-page
 * entries only; broadcasts render elsewhere.
 */
export default function FrontPageWall({ worldId = 'live' }: { worldId?: string }) {
  const [entries, setEntries] = useState<MediaEntry[] | null>(null);
  const [simDate, setSimDate] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<MediaEntry | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let live = true;
    fetchMediaIndex(worldId).then(idx => {
      if (live) setEntries(idx ? idx.media.filter(m => m.kind === 'front_page') : []);
    });
    return () => { live = false; };
  }, [worldId]);

  // Close on Escape, lock scroll and move focus into the lightbox (and back) while open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
      closeRef.current?.focus();
    } else {
      openerRef.current?.focus();
      openerRef.current = null;
      document.body.style.overflow = '';
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedImage]);

  const simDates = useMemo(
    () => Array.from(new Set((entries ?? []).map(e => e.sim_date))).sort(),
    [entries],
  );

  const shown = useMemo(
    () => (entries ?? []).filter(e => simDate === 'all' || e.sim_date === simDate),
    [entries, simDate],
  );

  if (entries === null) {
    return (
      <p role="status" style={{ padding: 'var(--rs-space-5)', margin: 0, color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)' }}>
        Loading front pages from this world…
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p style={{ padding: 'var(--rs-space-5)', margin: 0, color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)', lineHeight: 1.45 }}>
        The presses haven't run for this world yet. Front pages appear here once the media batch
        prints them. Until then, <Link to="/hall" style={{ color: 'var(--rs-sun)' }}>browse other worlds in the Hall</Link>.
      </p>
    );
  }

  const open = (e: MediaEntry, el: HTMLElement) => {
    openerRef.current = el;
    setSelectedImage(e);
  };

  return (
    <div>
      {simDates.length > 1 && (
        <div role="group" aria-label="Filter by year" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--rs-space-2)', paddingBottom: 'var(--rs-space-4)' }}>
          <FilterChip label="All years" active={simDate === 'all'} onClick={() => setSimDate('all')} />
          {simDates.map(d => (
            <FilterChip
              key={d}
              label={`Year ${isoYear(d)}`}
              active={simDate === d}
              onClick={() => setSimDate(d)}
            />
          ))}
        </div>
      )}

      <ul style={{
        listStyle: 'none', margin: 0, padding: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 'var(--rs-space-4)',
      }}>
        {shown.map(e => (
          <li key={e.canonical_hash}>
            <figure className="rs-paper" style={{ margin: 0, padding: 'var(--rs-space-2)', boxShadow: 'var(--rs-shadow-md)' }}>
              <button
                type="button"
                onClick={ev => open(e, ev.currentTarget)}
                aria-label={`Enlarge front page: ${countryName(e.nation_iso)}, ${isoYear(e.sim_date)}`}
                style={{
                  display: 'block', width: '100%', padding: 0, cursor: 'zoom-in',
                  aspectRatio: '3 / 4', overflow: 'hidden', borderRadius: 'var(--rs-radius-sm)',
                  background: 'var(--rs-ink)', border: 'var(--rs-border-thin)', position: 'relative',
                }}
              >
                <img
                  src={e.b2_url}
                  alt={`Newspaper front page from a forked ${countryName(e.nation_iso)}, ${isoYear(e.sim_date)}`}
                  width={300}
                  height={400}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <span className="game-badge rs-chip-fork" style={{ position: 'absolute', top: 'var(--rs-space-2)', left: 'var(--rs-space-2)', pointerEvents: 'none' }}>
                  Fork
                </span>
              </button>
              <figcaption style={{
                marginTop: 'var(--rs-space-2)', fontSize: 'var(--rs-text-sm)', fontWeight: 700,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--rs-space-2)',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)', minWidth: 0 }}>
                  {e.nation_iso && <Flag iso3={e.nation_iso} height={12} />}
                  {countryName(e.nation_iso)}
                </span>
                <span style={{ fontFamily: 'var(--rs-font-mono)', fontSize: 'var(--rs-text-xs)', color: 'var(--rs-muted-on-paper)' }}>
                  {isoYear(e.sim_date)}
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>

      {/* Lightbox, portalled to <body> so no ancestor's transform/filter can
          become the containing block for its position:fixed overlay. */}
      {selectedImage && createPortal(
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'var(--rs-space)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--rs-space-3)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fpw-lightbox-title"
            onClick={(e) => e.stopPropagation()}
            className="rs-paper"
            style={{
              position: 'relative',
              width: '92vw', height: '90vh', maxWidth: 1300,
              display: 'flex', flexDirection: 'column',
              padding: 'var(--rs-space-3)', boxSizing: 'border-box', overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
              gap: 'var(--rs-space-3)', marginBottom: 'var(--rs-space-3)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)' }}>
                <span className="game-badge rs-chip-fork">Fork</span>
                <h2 id="fpw-lightbox-title" style={{ margin: 0, fontFamily: 'var(--rs-font-display)', fontSize: 'var(--rs-text-lg)', lineHeight: 1 }}>
                  {countryName(selectedImage.nation_iso)}, {isoYear(selectedImage.sim_date)}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)' }}>
                <a
                  href={selectedImage.b2_url}
                  target="_blank"
                  rel="noreferrer"
                  className="game-button game-button-dark"
                >
                  Open original
                </a>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="game-button game-button-dark"
                  aria-label="Close front page"
                >
                  Close
                </button>
              </div>
            </div>

            <div
              onClick={() => setSelectedImage(null)}
              style={{
                overflow: 'auto', flex: '1 1 0%', minHeight: 0, width: '100%',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: 'var(--rs-ink)', borderRadius: 'var(--rs-radius-md)', border: 'var(--rs-border-thin)',
                padding: 'var(--rs-space-2)', boxSizing: 'border-box', cursor: 'zoom-out',
              }}
            >
              <img
                src={selectedImage.b2_url}
                alt={`Newspaper front page from a forked ${countryName(selectedImage.nation_iso)}, ${isoYear(selectedImage.sim_date)}, full size`}
                width={1200}
                height={1600}
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxHeight: '100%', maxWidth: '100%', width: 'auto', height: 'auto',
                  objectFit: 'contain', display: 'block', borderRadius: 'var(--rs-radius-sm)',
                }}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`game-button ${active ? 'rs-button-fork' : 'game-button-dark'}`}
      style={{ fontSize: 'var(--rs-text-sm)' }}
    >
      {label}
    </button>
  );
}
