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
      setParseError('That is not valid JSON. Paste the output of `genblaze extract`, or a media-index entry.');
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-deep-space, #0b1020)', color: 'var(--text-primary, #e6ebff)',
      fontFamily: 'system-ui, sans-serif', padding: '32px 20px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link to="/" style={{ color: 'var(--accent-cyan, #4fd6ff)', fontSize: 13, textDecoration: 'none' }}>
          ← Back to the globe
        </Link>

        <h1 style={{ fontSize: 26, margin: '16px 0 6px' }}>🔏 Provenance Verifier</h1>
        <p style={{ color: 'var(--text-muted, #9aa6d6)', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px', maxWidth: 620 }}>
          Every asset RealityShift publishes carries a hash-bound record of the claim that
          defines the project: <em>once a world forks, no real-world data enters it again.</em>
          Check that record here — no install required.
        </p>
        <p style={{
          color: 'var(--text-faint, #6b76a8)', fontSize: 12, lineHeight: 1.6, margin: '0 0 28px',
          maxWidth: 620, borderLeft: '3px solid var(--accent-yellow, #f5c542)', paddingLeft: 12,
        }}>
          <strong>Honest scope:</strong> this is an <strong>integrity</strong> check, not authentication, and
          not C2PA. The cryptographic ground truth is <code>genblaze verify &lt;file&gt;</code>, which
          re-derives the canonical hash. The browser computes a real SHA-256 fingerprint and checks the
          provenance block for internal consistency — it does not reproduce the genblaze canonicalization.
        </p>

        {/* ── File fingerprint ─────────────────────────────────── */}
        <section style={panel}>
          <h2 style={h2}>1 · Fingerprint a downloaded file</h2>
          <p style={muted}>
            Drop the broadcast MP4 or front-page image you downloaded. Its SHA-256 is computed locally —
            the file never leaves your browser.
          </p>
          <label
            style={{
              display: 'block', border: '2px dashed var(--border-strong, #3a4a7a)', borderRadius: 10,
              padding: 22, textAlign: 'center', cursor: 'pointer', marginTop: 12,
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
          >
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
            <span style={{ color: 'var(--accent-cyan, #4fd6ff)', fontSize: 14 }}>
              {file.status === 'hashing' ? `Hashing ${file.name}…` : 'Click or drop a file'}
            </span>
          </label>

          {file.status === 'done' && (
            <div style={{ marginTop: 14, fontSize: 13 }}>
              <div style={{ color: 'var(--text-muted, #9aa6d6)' }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</div>
              <div style={{ color: 'var(--text-muted, #9aa6d6)', margin: '10px 0 4px', fontSize: 11 }}>SHA-256</div>
              <code style={{ display: 'block', wordBreak: 'break-all', fontSize: 11, color: 'var(--text-secondary, #c3ccf0)', lineHeight: 1.5 }}>
                {file.sha}
              </code>
              {file.inIndex !== null && (
                <div style={{
                  marginTop: 12, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                  background: file.inIndex ? 'rgba(60,200,120,0.12)' : 'rgba(160,170,210,0.08)',
                  color: file.inIndex ? 'var(--accent-green, #46d17a)' : 'var(--text-muted, #9aa6d6)',
                }}>
                  {file.inIndex
                    ? '✓ This fingerprint is attested by the public media index.'
                    : 'This fingerprint is not in the current public index. That is expected unless the index stores raw-file SHA-256 — use genblaze verify for the canonical check.'}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Manifest inspection ──────────────────────────────── */}
        <section style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 style={h2}>2 · Inspect a provenance manifest</h2>
            <button onClick={() => inspect(DEMO_MANIFEST)} style={ghostBtn}>Load demo</button>
          </div>
          <p style={muted}>
            Paste the output of <code>genblaze extract &lt;file&gt;</code> or a media-index entry. The
            fields are checked against the fork invariants.
          </p>
          <textarea
            value={manifestText}
            onChange={e => inspect(e.target.value)}
            placeholder='{ "simulation": { "fork_id": "…", "real_world_data_cutoff": "…" } }'
            spellCheck={false}
            style={{
              width: '100%', minHeight: 120, marginTop: 12, boxSizing: 'border-box', resize: 'vertical',
              background: 'var(--bg-deep-space, #0b1020)', color: 'var(--text-secondary, #c3ccf0)',
              border: '1px solid var(--border-strong, #3a4a7a)', borderRadius: 8, padding: 12,
              fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.5,
            }}
          />
          {parseError && <div style={{ color: 'var(--accent-magenta, #ff5db1)', fontSize: 12, marginTop: 8 }}>{parseError}</div>}

          {report && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                display: 'inline-block', padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                background: report.consistent ? 'rgba(60,200,120,0.15)' : 'rgba(255,93,177,0.13)',
                color: report.consistent ? 'var(--accent-green, #46d17a)' : 'var(--accent-magenta, #ff5db1)',
              }}>
                {report.consistent ? '✓ Provenance is internally consistent' : '✗ Provenance failed a consistency check'}
              </div>

              {report.fields && (
                <div style={{ margin: '14px 0', fontSize: 13, color: 'var(--text-muted, #9aa6d6)' }}>
                  Fork <strong style={{ color: 'var(--text-primary, #e6ebff)' }}>{report.fields.fork_id}</strong>
                  {' · '}{countryName(report.fields.nation_iso)}
                  {' · cutoff '}<strong style={{ color: 'var(--accent-yellow, #f5c542)' }}>{report.fields.real_world_data_cutoff}</strong>
                </div>
              )}

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.checks.map(c => (
                  <li key={c.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                    <span style={{ color: c.pass ? 'var(--accent-green, #46d17a)' : 'var(--accent-magenta, #ff5db1)', fontWeight: 700 }}>
                      {c.pass ? '✓' : '✗'}
                    </span>
                    <span>
                      <span style={{ color: 'var(--text-primary, #e6ebff)' }}>{c.label}</span>
                      <span style={{ color: 'var(--text-faint, #6b76a8)', display: 'block', fontSize: 12 }}>{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <p style={{ color: 'var(--text-faint, #6b76a8)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          For the authoritative cryptographic check, run <code>genblaze verify &lt;file&gt;</code> on the download.
        </p>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: 'var(--surface-panel, #141a33)', border: '1px solid var(--border-subtle, #232b4d)',
  borderRadius: 12, padding: 20, margin: '0 0 20px',
};
const h2: React.CSSProperties = { fontSize: 15, margin: '0 0 4px' };
const muted: React.CSSProperties = { color: 'var(--text-muted, #9aa6d6)', fontSize: 13, lineHeight: 1.5, margin: 0 };
const ghostBtn: React.CSSProperties = {
  flexShrink: 0, padding: '5px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12,
  border: '1px solid var(--border-strong, #3a4a7a)', background: 'transparent', color: 'var(--accent-cyan, #4fd6ff)',
};
