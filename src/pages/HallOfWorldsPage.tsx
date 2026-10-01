import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicWorlds, type PublicWorld } from '../lib/hallOfWorlds';
import { countryName } from '../data/countries';
import { Flag } from '../components/GameIcons';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; worlds: PublicWorld[] };

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HallOfWorldsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    fetchPublicWorlds().then(worlds => {
      if (alive) setState({ status: 'ready', worlds });
    });
    return () => { alive = false; };
  }, []);

  return (
    <main style={{
      minHeight: '100vh', background: 'var(--rs-space)', color: 'var(--rs-text-on-dark)',
      fontFamily: 'var(--rs-font-body)', fontSize: 'var(--rs-text-md)',
      padding: 'var(--rs-space-6) var(--rs-space-4)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Link to="/" className="game-button game-button-dark">
          ← Back to the globe
        </Link>

        <span className="game-eyebrow" style={{ display: 'flex', marginTop: 'var(--rs-space-5)' }}>
          <span className="game-badge rs-chip-fork">Fork</span> Published universes
        </span>
        <h1 style={{
          fontFamily: 'var(--rs-font-display)', fontWeight: 700, fontSize: 'var(--rs-text-2xl)',
          lineHeight: 1.05, margin: 'var(--rs-space-2) 0',
        }}>
          Hall of Worlds
        </h1>
        <p style={{ color: 'var(--rs-muted-on-dark)', lineHeight: 1.45, margin: '0 0 var(--rs-space-6)', maxWidth: 640 }}>
          Every world here forked off reality and never looked back. Players published them so you can
          read the headlines. Seen enough? Take over a country and start your own.
        </p>

        {state.status === 'loading' && (
          <p role="status" style={{ color: 'var(--rs-muted-on-dark)', padding: 'var(--rs-space-7) 0', textAlign: 'center' }}>
            Loading published worlds…
          </p>
        )}

        {state.status === 'ready' && state.worlds.length === 0 && (
          <section className="rs-paper" style={{ padding: 'var(--rs-space-6)', textAlign: 'center', maxWidth: 560, margin: '0 auto' }}>
            <h2 style={{ fontFamily: 'var(--rs-font-display)', fontSize: 'var(--rs-text-xl)', lineHeight: 1, margin: '0 0 var(--rs-space-3)' }}>
              The Hall is empty
            </h2>
            <p style={{ color: 'var(--rs-muted-on-paper)', margin: '0 0 var(--rs-space-5)', lineHeight: 1.45 }}>
              Nobody has published a fork yet. Take over a country, then hit publish on your game screen
              to hang the first world on the wall.
            </p>
            <Link to="/" className="game-button rs-button-lg">Fork a country!</Link>
          </section>
        )}

        {state.status === 'ready' && state.worlds.length > 0 && (
          <>
            <h2 className="rs-sr-only">Published worlds</h2>
            <ul style={{
              listStyle: 'none', padding: 0, margin: 0,
              display: 'grid', gap: 'var(--rs-space-5)',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}>
              {state.worlds.map((w, i) => (
                <li key={w.worldId}>
                  <Link
                    to={`/wall/${w.worldId}`}
                    className="rs-paper"
                    style={{
                      textDecoration: 'none', boxShadow: 'var(--rs-shadow-md)',
                      padding: 'var(--rs-space-4)', display: 'block', height: '100%', boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--rs-space-2)' }}>
                      <span className="game-badge rs-chip-fork">Fork #{i + 1}</span>
                      {w.publishedAt && (
                        <span style={{ fontSize: 'var(--rs-text-xs)', color: 'var(--rs-muted-on-paper)', fontWeight: 700 }}>
                          {formatDate(w.publishedAt)}
                        </span>
                      )}
                    </div>
                    <h3 style={{
                      fontFamily: 'var(--rs-font-display)', fontSize: 'var(--rs-text-lg)', fontWeight: 700,
                      margin: 'var(--rs-space-3) 0 var(--rs-space-1)', lineHeight: 1.2,
                    }}>
                      {w.title}
                    </h3>
                    <div style={{
                      fontSize: 'var(--rs-text-sm)', fontWeight: 700, color: 'var(--rs-muted-on-paper)',
                      display: 'flex', alignItems: 'center', gap: 'var(--rs-space-2)',
                    }}>
                      {w.countryCode && <Flag iso3={w.countryCode} height={14} />}
                      {countryName(w.countryCode)}
                      {w.forkedAtYear ? ` · forked in ${w.forkedAtYear}` : ''}
                    </div>
                    <div style={{
                      marginTop: 'var(--rs-space-3)', fontFamily: 'var(--rs-font-display)', fontWeight: 700,
                      fontSize: 'var(--rs-text-sm)', textDecoration: 'underline', textDecorationColor: 'var(--rs-sun)',
                      textDecorationThickness: 2, textUnderlineOffset: 3,
                    }}>
                      Read its front pages →
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
