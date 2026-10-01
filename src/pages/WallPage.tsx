import { Link, useParams } from 'react-router-dom';
import FrontPageWall from '../components/FrontPageWall';
import BroadcastPlayer from '../components/BroadcastPlayer';

/**
 * Full-width "front pages from a world that doesn't exist" wall.
 *
 * Its own route rather than a dashboard tab: a grid of newspaper covers needs
 * width the 360px dashboard sidebar can't give, and it is the media layer's
 * primary showcase.
 */
export default function WallPage() {
  const { worldId } = useParams();
  const world = worldId ?? 'live';

  const sectionTitle = {
    fontFamily: 'var(--rs-font-display)', fontWeight: 700, fontSize: 'var(--rs-text-xl)',
    lineHeight: 1, margin: '0 0 var(--rs-space-3)',
  } as const;

  return (
    <main style={{
      width: '100vw', height: '100vh', background: 'var(--rs-space)',
      color: 'var(--rs-text-on-dark)', fontFamily: 'var(--rs-font-body)', overflowY: 'auto',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 'var(--rs-space-4)', flexWrap: 'wrap',
        padding: 'var(--rs-space-5)',
        borderBottom: 'var(--rs-border)',
        background: 'var(--rs-hud)',
      }}>
        <div>
          <span className="game-eyebrow">
            <span className="game-badge rs-chip-fork">Fork</span> World: {world}
          </span>
          <h1 style={{
            fontFamily: 'var(--rs-font-display)', fontWeight: 700, fontSize: 'var(--rs-text-2xl)',
            lineHeight: 1.05, margin: 'var(--rs-space-2) 0 0',
          }}>
            Front pages from other worlds
          </h1>
        </div>
        <Link to="/" className="game-button game-button-dark">
          ← Back to the globe
        </Link>
      </header>

      <div style={{ padding: 'var(--rs-space-5) var(--rs-space-4) var(--rs-space-7)', maxWidth: 1200, margin: '0 auto' }}>
        <section aria-labelledby="wall-broadcast" style={{ marginBottom: 'var(--rs-space-6)' }}>
          <h2 id="wall-broadcast" style={sectionTitle}>Tonight's broadcast</h2>
          <div className="game-panel" style={{ padding: 'var(--rs-space-4)' }}>
            <BroadcastPlayer worldId={world} />
          </div>
        </section>

        <section aria-labelledby="wall-papers">
          <h2 id="wall-papers" style={sectionTitle}>Newspaper front pages</h2>
          <div className="game-panel" style={{ padding: 'var(--rs-space-4)' }}>
            <FrontPageWall worldId={world} />
          </div>
        </section>
      </div>
    </main>
  );
}
