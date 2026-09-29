import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicWorlds, type PublicWorld } from '../lib/hallOfWorlds';
import { countryName } from '../data/countries';

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
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep-space, #0b1020)', color: 'var(--text-primary, #e6ebff)',
      fontFamily: 'system-ui, sans-serif', padding: '32px 20px',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Link to="/" style={{ color: 'var(--accent-cyan, #4fd6ff)', fontSize: 13, textDecoration: 'none' }}>
          ← Back to the globe
        </Link>

        <h1 style={{ fontSize: 28, margin: '16px 0 6px' }}>🏛️ Hall of Worlds</h1>
        <p style={{ color: 'var(--text-muted, #9aa6d6)', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px', maxWidth: 640 }}>
          Parallel universes players chose to publish. Each is a fork of reality that never
          happened — take over a country and start your own.
        </p>

        {state.status === 'loading' && (
          <div style={{ color: 'var(--text-muted, #9aa6d6)', fontSize: 14, padding: 40, textAlign: 'center' }}>
            Loading published worlds…
          </div>
        )}

        {state.status === 'ready' && state.worlds.length === 0 && (
          <div style={{
            border: '1px dashed var(--border-strong, #3a4a7a)', borderRadius: 12, padding: 40, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌌</div>
            <div style={{ fontSize: 16, marginBottom: 6 }}>No worlds published yet.</div>
            <div style={{ color: 'var(--text-muted, #9aa6d6)', fontSize: 13 }}>
              Fork a country, then publish it from your game screen to be the first in the Hall.
            </div>
          </div>
        )}

        {state.status === 'ready' && state.worlds.length > 0 && (
          <div style={{
            display: 'grid', gap: 14,
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          }}>
            {state.worlds.map((w, i) => (
              <Link
                key={w.worldId}
                to={`/wall/${w.worldId}`}
                style={{
                  textDecoration: 'none', color: 'inherit',
                  background: 'var(--surface-panel, #141a33)', border: '1px solid var(--border-subtle, #232b4d)',
                  borderRadius: 12, padding: 18, display: 'block', transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--accent-cyan, #4fd6ff)', fontWeight: 700 }}>
                    #{i + 1}
                  </span>
                  {w.publishedAt && (
                    <span style={{ fontSize: 11, color: 'var(--text-faint, #6b76a8)' }}>{formatDate(w.publishedAt)}</span>
                  )}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, margin: '8px 0 4px', lineHeight: 1.25 }}>
                  {w.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted, #9aa6d6)' }}>
                  {countryName(w.countryCode)}
                  {w.forkedAtYear ? ` · forked ${w.forkedAtYear}` : ''}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--accent-yellow, #f5c542)', fontWeight: 600 }}>
                  View front pages →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
