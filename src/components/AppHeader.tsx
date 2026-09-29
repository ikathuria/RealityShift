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
        background: 'linear-gradient(to bottom, rgba(7,9,19,0.95), rgba(7,9,19,0))',
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
          <div style={{
            fontSize: 26,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
          }}>
            🌍
          </div>
          <div>
            <div className="game-font-display" style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--accent-yellow)',
              textShadow: '2px 2px 0px #0b0f19, 0 0 10px rgba(255,230,0,0.4)',
              lineHeight: 1.0,
            }}>
              REALITY SHIFT
            </div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--accent-cyan)',
              letterSpacing: 0.8,
              marginTop: 2,
              textTransform: 'uppercase',
            }}>
              MULTI-AGENT WARGAME SIMULATOR
            </div>
          </div>
        </Link>

        {/* Visitor Location & Sun Clock Badge */}
        <div className="game-badge" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px',
          marginLeft: isMobile ? 0 : 8,
        }}>
          <span aria-hidden>{visitor.isDay ? '☀️' : '🌙'}</span>
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
              style={{ height: 36, padding: '0 14px', fontSize: 12, justifyContent: 'center', whiteSpace: 'nowrap' }}
            >
              🏛️ HALL
            </Link>
          )}
          <Link
            to="/wall"
            className="game-button game-button-dark"
            style={{ height: 36, padding: '0 14px', fontSize: 12, flex: isMobile ? 1 : undefined, justifyContent: 'center', whiteSpace: 'nowrap' }}
          >
            🗞️ FRONT PAGES
          </Link>
          <Link
            to="/world"
            className="game-button game-button-cyan"
            style={{ height: 36, padding: '0 16px', fontSize: 12, flex: isMobile ? 1 : undefined, justifyContent: 'center', whiteSpace: 'nowrap' }}
          >
            📊 DASHBOARD →
          </Link>
        </div>
      </div>
    </header>
  );
}
