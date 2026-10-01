import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CountrySearch from './CountrySearch';
import { formatLocalTime, readVisitorContext } from '../lib/locale';
import { useIsMobile } from '../lib/useIsMobile';

/**
 * Orientation bar for the globe view.
 *
 * The landing route previously rendered only <Globe /> and <CountryPanel />, so
 * a first-time visitor arrived at an unlabelled black sphere with no product
 * name, no explanation, and no route to the public dashboard. The primary action
 * ("Take Over") lives inside the country panel, which only appears after
 * successfully clicking a country — so nothing about the app's purpose or its
 * main interaction was discoverable from the landing page.
 */
export default function AppHeader() {
  const visitor = useMemo(() => readVisitorContext(), []);
  const [clock, setClock] = useState(() => formatLocalTime());
  const isMobile = useIsMobile();

  // Minute resolution is enough; a per-second tick would re-render for nothing.
  useEffect(() => {
    const id = window.setInterval(() => setClock(formatLocalTime()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex',
        // Below the breakpoint the bar can't fit logo + clock + search + two
        // buttons on one line, so it stacks into rows instead of pushing the
        // search box and nav off the right edge (unreachable, body scroll locked).
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 10 : 16,
        padding: isMobile ? '10px 12px' : '14px 20px',
        background: 'linear-gradient(to bottom, var(--rs-space), transparent)',
        pointerEvents: 'none',
      }}
    >
      {/* Row 1: brand + sun clock */}
      <div style={{
        pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 12,
        width: isMobile ? '100%' : 'auto',
        justifyContent: isMobile ? 'space-between' : 'flex-start',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <span className="rs-wordmark" aria-label="RealityShift">Reality<b>/</b>Shift</span>
            <div style={{
              font: '700 var(--rs-text-xs) var(--rs-font-body)',
              color: 'var(--rs-muted-on-dark)',
              marginTop: 'var(--rs-space-1)',
            }}>
              Take over a country. Fork the world.
            </div>
          </div>
        </Link>

        {/* Visitor Location & Sun Clock Badge */}
        <div className="game-eyebrow" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          marginLeft: isMobile ? 0 : 8,
        }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: visitor.isDay ? 'var(--rs-sun)' : 'var(--rs-muted-on-dark)' }} />
          <span>
            {visitor.country ?? visitor.timeZone} · {clock}
          </span>
        </div>
      </div>

      {/* Right group: desktop pushes to the right on the same row; mobile becomes
          rows 2-3 (full-width search, then the two nav buttons split evenly). */}
      <div style={{
        pointerEvents: 'auto', display: 'flex', gap: 12,
        marginLeft: isMobile ? 0 : 'auto',
        width: isMobile ? '100%' : 'auto',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
      }}>
        <CountrySearch fullWidth={isMobile} />
        <div style={{ display: 'flex', gap: 12, width: isMobile ? '100%' : 'auto' }}>
          {!isMobile && (
            <Link
              to="/hall"
              className="game-button game-button-dark"
              style={{ padding: '0 var(--rs-space-4)', justifyContent: 'center', whiteSpace: 'nowrap' }}
            >
              Hall
            </Link>
          )}
          <Link
            to="/wall"
            className="game-button game-button-dark"
            style={{ padding: '0 var(--rs-space-4)', flex: isMobile ? 1 : undefined, justifyContent: 'center', whiteSpace: 'nowrap' }}
          >
            Front pages
          </Link>
          <Link
            to="/world"
            className="game-button game-button-dark"
            style={{ padding: '0 var(--rs-space-4)', flex: isMobile ? 1 : undefined, justifyContent: 'center', whiteSpace: 'nowrap' }}
          >
            Dashboard →
          </Link>
        </div>
      </div>
    </header>
  );
}
