import { Link, useParams } from 'react-router-dom';
import { countryName } from '../data/countries';
import { getGovernment, GOV_COUNTRIES } from '../data/government';
import GovernmentGraph from '../components/GovernmentGraph';

export default function GovernmentPage() {
  const { code } = useParams<{ code: string }>();
  const iso3 = (code ?? '').toUpperCase();
  const government = getGovernment(iso3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg-deep-space)', color: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '2px dashed rgba(255,255,255,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="game-badge game-badge-magenta" style={{ marginBottom: 6 }}>
              🏛️ GOVERNMENT GRAPH
            </div>
            <div className="game-font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent-yellow)', textShadow: '2px 2px 0px #000', lineHeight: 1.1 }}>
              {government ? countryName(iso3) : 'GOVERNMENT GRAPH'}
            </div>
            {government && (
              <div style={{ color: 'var(--accent-cyan)', fontSize: 12, fontFamily: 'var(--font-heading)', marginTop: 4 }}>
                {government.system.toUpperCase()} · AS OF {government.asOf}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/" className="game-button game-button-dark" style={{ padding: '6px 12px', fontSize: 11 }}>
              ← 3D GLOBE
            </Link>
          </div>
        </div>

        {/* Country switcher */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {GOV_COUNTRIES.map(c => (
            <Link
              key={c}
              to={`/gov/${c}`}
              className={`game-button ${c === iso3 ? 'game-button-cyan' : 'game-button-dark'}`}
              style={{ padding: '6px 12px', fontSize: 11, textDecoration: 'none' }}
            >
              {countryName(c)}
            </Link>
          ))}
        </div>
      </div>

      {/* Graph or empty state */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {government ? (
          <GovernmentGraph government={government} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: 24, gap: 14 }}>
            <div className="game-font-heading" style={{ fontSize: 18, color: '#fff' }}>
              No government graph for “{iso3 || '—'}” yet.
            </div>
            <div style={{ color: 'var(--text-muted, #8a93b2)', fontSize: 13, maxWidth: 420, lineHeight: 1.6 }}>
              A hand-authored power map exists for these nations so far. Pick one to explore who holds power and how it flows.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {GOV_COUNTRIES.map(c => (
                <Link key={c} to={`/gov/${c}`} className="game-button game-button-cyan" style={{ padding: '8px 14px', fontSize: 12, textDecoration: 'none' }}>
                  {countryName(c)}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interaction hint */}
      {government && (
        <div style={{ position: 'absolute', bottom: 12, right: 12, color: 'var(--text-muted, #8a93b2)', fontSize: 10, fontFamily: 'var(--font-heading)', textAlign: 'right', pointerEvents: 'none' }}>
          DRAG NODES · SCROLL TO ZOOM · CLICK FOR DETAILS
        </div>
      )}
    </div>
  );
}
