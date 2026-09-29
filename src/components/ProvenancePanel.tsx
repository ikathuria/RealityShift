import { Link } from 'react-router-dom';
import type { MediaEntry } from '../lib/mediaIndex';
import { countryName } from '../data/countries';

/**
 * Shows the Genblaze provenance a broadcast carries — the fork lineage and the
 * no-new-data cutoff, plus the canonical hash and how to verify it.
 *
 * The cryptographic check itself is `genblaze verify <file>` (Python/CLI); the
 * browser can't run it, so this panel surfaces the hash-bound fields the
 * manifest attests and the exact command to re-derive them.
 */
export default function ProvenancePanel({ entry }: { entry: MediaEntry }) {
  const p = entry.provenance;

  return (
    <div style={{
      background: 'var(--surface-panel)', border: 'var(--border-subtle)',
      borderRadius: 'var(--radius-panel)', padding: 16, fontSize: 'var(--font-size-sm)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: 1,
        color: 'var(--text-muted)', marginBottom: 12,
      }}>
        🔏 Embedded provenance
      </div>

      {p ? (
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: 0 }}>
          <Row k="Fork" v={p.fork_id} />
          <Row k="Parent" v={p.parent_fork_id ?? '—'} />
          <Row k="Nation" v={countryName(p.nation_iso)} />
          <Row k="Diverged from reality" v={p.divergence_date} />
          <Row k="Reporting sim-date" v={p.sim_date} />
          <Row k="Real-world data cutoff" v={p.real_world_data_cutoff} highlight />
          <Row k="Counterfactual" v={p.is_counterfactual ? 'yes' : 'no'} />
        </dl>
      ) : (
        <div style={{ color: 'var(--text-muted)' }}>No provenance recorded for this item.</div>
      )}

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: 'var(--border-subtle)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: 4 }}>
          canonical hash
        </div>
        <code style={{
          display: 'block', wordBreak: 'break-all', fontSize: 11,
          color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          {entry.canonical_hash}
        </code>
        <div style={{ color: 'var(--text-faint)', fontSize: 'var(--font-size-xs)', marginTop: 10, lineHeight: 1.5 }}>
          Download the MP4 and re-derive this hash with{' '}
          <code style={{ color: 'var(--accent-text)' }}>genblaze verify &lt;file&gt;</code> — the
          fields above are bound into it and can't be altered without breaking verification.
          Integrity, not authentication; not C2PA.
        </div>
        <Link
          to="/verify"
          style={{
            display: 'inline-block', marginTop: 10, fontSize: 'var(--font-size-xs)',
            color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 600,
          }}
        >
          🔏 Verify in your browser →
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <>
      <dt style={{ color: 'var(--text-muted)' }}>{k}</dt>
      <dd style={{
        margin: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        color: highlight ? 'var(--accent-text)' : 'var(--text-primary)',
        fontWeight: highlight ? 700 : 400,
      }}>
        {v}
      </dd>
    </>
  );
}
