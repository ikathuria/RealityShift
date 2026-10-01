import { Link, useParams } from 'react-router-dom';
import { countryName } from '../data/countries';
import { getGovernment, GOV_COUNTRIES } from '../data/government';
import GovernmentGraph from '../components/GovernmentGraph';
import { Flag } from '../components/GameIcons';

export default function GovernmentPage() {
  const { code } = useParams<{ code: string }>();
  const iso3 = (code ?? '').toUpperCase();
  const government = getGovernment(iso3);

  const activeChip = { background: 'var(--rs-ink)', color: 'var(--rs-paper)', fontSize: 'var(--rs-text-sm)' } as const;

  return (
    <main style={{
      display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh',
      background: 'var(--rs-space)', color: 'var(--rs-text-on-dark)', fontFamily: 'var(--rs-font-body)',
      overflow: 'hidden', position: 'relative',
    }}>
      <header style={{
        padding: 'var(--rs-space-4) var(--rs-space-4) var(--rs-space-3)',
        background: 'var(--rs-hud)', borderBottom: 'var(--rs-border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--rs-space-3)', flexWrap: 'wrap' }}>
          <div>
            <span className="game-eyebrow">
              <span className="game-badge rs-chip-real">Real</span> Who runs the place
            </span>
            <h1 style={{
              display: 'flex', alignItems: 'center', gap: 'var(--rs-space-3)',
              fontFamily: 'var(--rs-font-display)', fontWeight: 700, fontSize: 'var(--rs-text-2xl)',
              lineHeight: 1.05, margin: 'var(--rs-space-2) 0 0',
            }}>
              {government && <Flag iso3={iso3} height={28} />}
              {government ? `${countryName(iso3)} power map` : 'Government power maps'}
            </h1>
            {government && (
              <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)', fontWeight: 700, margin: 'var(--rs-space-1) 0 0' }}>
                {government.system} · as of {government.asOf}
              </p>
            )}
          </div>
          <Link to="/" className="game-button game-button-dark">
            ← Back to the globe
          </Link>
        </div>

        <nav aria-label="Choose a country" style={{ display: 'flex', gap: 'var(--rs-space-2)', marginTop: 'var(--rs-space-3)', flexWrap: 'wrap' }}>
          {GOV_COUNTRIES.map(c => (
            <Link
              key={c}
              to={`/gov/${c}`}
              aria-current={c === iso3 ? 'page' : undefined}
              className="game-button game-button-dark"
              style={c === iso3 ? activeChip : { fontSize: 'var(--rs-text-sm)' }}
            >
              <Flag iso3={c} height={14} />
              {countryName(c)}
            </Link>
          ))}
        </nav>
      </header>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {government ? (
          <GovernmentGraph government={government} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 'var(--rs-space-5)' }}>
            <section className="rs-paper" style={{ maxWidth: 480, padding: 'var(--rs-space-5)', textAlign: 'center' }}>
              <h2 style={{ fontFamily: 'var(--rs-font-display)', fontSize: 'var(--rs-text-xl)', lineHeight: 1, margin: '0 0 var(--rs-space-3)' }}>
                No power map for “{iso3 || '—'}” yet
              </h2>
              <p style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-sm)', lineHeight: 1.45, margin: 0 }}>
                We've hand-drawn who holds power in a few countries so far. Pick one from the list above
                to see who answers to whom.
              </p>
            </section>
          </div>
        )}
      </div>

      {government && (
        <p aria-hidden="true" style={{
          position: 'absolute', bottom: 'var(--rs-space-3)', right: 'var(--rs-space-3)', margin: 0,
          color: 'var(--rs-muted-on-dark)', font: '800 var(--rs-text-2xs) var(--rs-font-body)',
          letterSpacing: 'var(--rs-tracking-label)', textTransform: 'uppercase', textAlign: 'right', pointerEvents: 'none',
        }}>
          Drag nodes · scroll to zoom · click for details
        </p>
      )}
    </main>
  );
}
