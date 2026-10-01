import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sha256Hex, inspectProvenance, type ProvenanceReport } from '../lib/provenance';
import { fetchMediaIndex } from '../lib/mediaIndex';
import { countryName } from '../data/countries';

type FileState =
  | { status: 'idle' }
  | { status: 'hashing'; name: string }
  | { status: 'done'; name: string; size: number; sha: string; inIndex: boolean | null };

const DEMO_MANIFEST = JSON.stringify(
  {
    simulation: {
      fork_id: 'usa-2026-demo',
      parent_fork_id: null,
      divergence_date: '2026-01-01',
      sim_date: '2026-06-01',
      real_world_data_cutoff: '2026-01-01',
      nation_iso: 'USA',
      is_counterfactual: true,
      consensus_reality: false,
    },
    canonical_hash: 'd278900045a1559f001',
  },
  null,
  2,
);

export default function VerifyPage() {
  const [file, setFile] = useState<FileState>({ status: 'idle' });
  const [manifestText, setManifestText] = useState('');
  const [report, setReport] = useState<ProvenanceReport | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function onFile(f: File) {
    setFile({ status: 'hashing', name: f.name });
    const buf = await f.arrayBuffer();
    const sha = await sha256Hex(buf);
    // Cross-reference the public media index: is this fingerprint attested?
    let inIndex: boolean | null;
    try {
      const idx = await fetchMediaIndex('live');
      inIndex = !!idx?.media.some(m => m.canonical_hash === sha);
    } catch {
      inIndex = null;
    }
    setFile({ status: 'done', name: f.name, size: f.size, sha, inIndex });
  }

  function inspect(text: string) {
    setManifestText(text);
    setParseError(null);
    setReport(null);
    if (!text.trim()) return;
    try {
      setReport(inspectProvenance(JSON.parse(text)));
    } catch {
      setParseError('That isn\'t valid JSON. Paste the output of `genblaze extract` or a media-index entry, or hit "Load a demo".');
    }
  }

  return (
    <main style={{
      minHeight: '100vh', background: 'var(--rs-space)', color: 'var(--rs-text-on-dark)',
      fontFamily: 'var(--rs-font-body)', fontSize: 'var(--rs-text-md)', padding: 'var(--rs-space-6) var(--rs-space-4)',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link to="/" className="game-button game-button-dark">
          ← Back to the globe
        </Link>

        <h1 style={{
          fontFamily: 'var(--rs-font-display)', fontWeight: 700, fontSize: 'var(--rs-text-2xl)',
          lineHeight: 1.05, margin: 'var(--rs-space-5) 0 var(--rs-space-2)',
        }}>
          Check a world's paperwork
        </h1>
        <p style={{ color: 'var(--rs-muted-on-dark)', lineHeight: 1.45, margin: '0 0 var(--rs-space-3)', maxWidth: 620 }}>
          Everything RealityShift publishes carries a hash-bound record of its one promise:{' '}
          <em>once a world forks, no real-world data enters it again.</em> Check that record here,
          no install required.
        </p>
        <p style={{
          color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)', lineHeight: 1.45, margin: '0 0 var(--rs-space-6)',
          maxWidth: 620, borderLeft: '3px solid var(--rs-sun)', paddingLeft: 'var(--rs-space-3)',
        }}>
          <strong style={{ color: 'var(--rs-text-on-dark)' }}>Honest scope:</strong> this is an integrity check, not
          authentication, and not C2PA. The cryptographic ground truth is{' '}
          <code style={codeOnDark}>genblaze verify &lt;file&gt;</code>, which re-derives the canonical hash. Your browser
          computes a real SHA-256 fingerprint and checks the provenance block for internal consistency. It does not
          reproduce the genblaze canonicalization.
        </p>

        {/* ── File fingerprint ─────────────────────────────────── */}
        <section className="rs-paper" style={panel} aria-labelledby="verify-file">
          <h2 id="verify-file" style={h2}>1. Fingerprint a downloaded file</h2>
          <p style={muted}>
            Drop in the broadcast MP4 or front-page image you downloaded. We hash it right here; the file never
            leaves your browser.
          </p>
          <label
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--rs-space-2)',
              border: '2px dashed var(--rs-ink)', borderRadius: 'var(--rs-radius-md)',
              padding: 'var(--rs-space-5)', textAlign: 'center', cursor: 'pointer', marginTop: 'var(--rs-space-3)',
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          >
            <input
              type="file"
              aria-label="Choose a file to fingerprint"
              className="rs-sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            <span className="game-button" aria-hidden="true">Choose a file</span>
            <span role="status" style={{ color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-sm)', fontWeight: 700 }}>
              {file.status === 'hashing' ? `Hashing ${file.name}…` : 'or drop it here'}
            </span>
          </label>

          {file.status === 'done' && (
            <div style={{ marginTop: 'var(--rs-space-4)', fontSize: 'var(--rs-text-sm)' }}>
              <div style={{ color: 'var(--rs-muted-on-paper)', fontWeight: 700 }}>
                {file.name} · <span style={{ fontFamily: 'var(--rs-font-mono)' }}>{(file.size / 1024).toFixed(0)} KB</span>
              </div>
              <div className="game-eyebrow" style={{ margin: 'var(--rs-space-3) 0 var(--rs-space-1)' }}>SHA-256</div>
              <code style={{ display: 'block', wordBreak: 'break-all', fontFamily: 'var(--rs-font-mono)', fontSize: 'var(--rs-text-xs)', lineHeight: 1.5 }}>
                {file.sha}
              </code>
              {file.inIndex !== null && (
                <p style={{
                  margin: 'var(--rs-space-3) 0 0', padding: 'var(--rs-space-2) var(--rs-space-3)',
                  borderRadius: 'var(--rs-radius-sm)', border: 'var(--rs-border-thin)',
                  background: file.inIndex ? 'var(--rs-real-tint)' : 'var(--rs-paper)', color: 'var(--rs-ink)', fontWeight: 700,
                }}>
                  {file.inIndex
                    ? '✓ Match. The public media index vouches for this exact file.'
                    : "No match in the current public index. That's expected unless the index stores raw-file SHA-256, so run genblaze verify for the canonical check."}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Manifest inspection ──────────────────────────────── */}
        <section className="rs-paper" style={panel} aria-labelledby="verify-manifest">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--rs-space-3)', flexWrap: 'wrap' }}>
            <h2 id="verify-manifest" style={h2}>2. Inspect a provenance manifest</h2>
            <button type="button" onClick={() => inspect(DEMO_MANIFEST)} className="game-button game-button-dark" style={{ fontSize: 'var(--rs-text-sm)' }}>
              Load a demo
            </button>
          </div>
          <p style={muted}>
            <label htmlFor="verify-manifest-input">
              Paste the output of <code style={codeOnPaper}>genblaze extract &lt;file&gt;</code> or a media-index entry.
              We check each field against the fork rules.
            </label>
          </p>
          <textarea
            id="verify-manifest-input"
            value={manifestText}
            onChange={e => inspect(e.target.value)}
            placeholder='{ "simulation": { "fork_id": "…", "real_world_data_cutoff": "…" } }'
            spellCheck={false}
            style={{
              width: '100%', minHeight: 120, marginTop: 'var(--rs-space-3)', boxSizing: 'border-box', resize: 'vertical',
              background: 'var(--rs-paper)', color: 'var(--rs-ink)',
              border: 'var(--rs-border-thin)', borderRadius: 'var(--rs-radius-md)', padding: 'var(--rs-space-3)',
              fontFamily: 'var(--rs-font-mono)', fontSize: 'var(--rs-text-xs)', lineHeight: 1.5,
            }}
          />
          {parseError && (
            <p role="alert" style={{ color: 'var(--rs-bad)', fontSize: 'var(--rs-text-sm)', fontWeight: 700, margin: 'var(--rs-space-2) 0 0' }}>
              {parseError}
            </p>
          )}

          {report && (
            <div style={{ marginTop: 'var(--rs-space-4)' }}>
              <h3 style={{ margin: 0 }}>
                <span className="game-badge" style={{
                  fontSize: 'var(--rs-text-xs)', padding: 'var(--rs-space-1) var(--rs-space-3)',
                  background: report.consistent ? 'var(--rs-real-tint)' : 'var(--rs-fork-tint)',
                }}>
                  {report.consistent ? '✓ Paperwork checks out' : '✗ Paperwork failed a check'}
                </span>
              </h3>

              {report.fields && (
                <p style={{ margin: 'var(--rs-space-3) 0', fontSize: 'var(--rs-text-sm)', color: 'var(--rs-muted-on-paper)', fontWeight: 700 }}>
                  Fork <strong style={{ color: 'var(--rs-ink)', fontFamily: 'var(--rs-font-mono)' }}>{report.fields.fork_id}</strong>
                  {' · '}{countryName(report.fields.nation_iso)}
                  {' · cutoff '}<strong style={{ color: 'var(--rs-ink)', fontFamily: 'var(--rs-font-mono)' }}>{report.fields.real_world_data_cutoff}</strong>
                </p>
              )}

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--rs-space-2)' }}>
                {report.checks.map(c => (
                  <li key={c.label} style={{ display: 'flex', gap: 'var(--rs-space-3)', alignItems: 'flex-start', fontSize: 'var(--rs-text-sm)' }}>
                    <span style={{ color: c.pass ? 'var(--rs-good)' : 'var(--rs-bad)', fontWeight: 800 }}>
                      {c.pass ? '✓' : '✗'}<span className="rs-sr-only">{c.pass ? 'Passed:' : 'Failed:'}</span>
                    </span>
                    <span>
                      <span style={{ fontWeight: 700 }}>{c.label}</span>
                      <span style={{ color: 'var(--rs-muted-on-paper)', display: 'block', fontSize: 'var(--rs-text-xs)' }}>{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-sm)', textAlign: 'center', marginTop: 'var(--rs-space-2)' }}>
          Want the authoritative answer? Run <code style={codeOnDark}>genblaze verify &lt;file&gt;</code> on the download.
        </p>
      </div>
    </main>
  );
}

const panel: React.CSSProperties = { padding: 'var(--rs-space-5)', margin: '0 0 var(--rs-space-5)', boxShadow: 'var(--rs-shadow-md)' };
const h2: React.CSSProperties = {
  fontFamily: 'var(--rs-font-display)', fontWeight: 700, fontSize: 'var(--rs-text-xl)', lineHeight: 1, margin: '0 0 var(--rs-space-2)',
};
const muted: React.CSSProperties = { color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-sm)', lineHeight: 1.45, margin: 0 };
const codeOnDark: React.CSSProperties = { fontFamily: 'var(--rs-font-mono)', color: 'var(--rs-text-on-dark)' };
const codeOnPaper: React.CSSProperties = { fontFamily: 'var(--rs-font-mono)', color: 'var(--rs-ink)' };
