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
    <section aria-labelledby="provenance-title" style={{
      background: 'var(--rs-hud)', border: 'var(--rs-border-thin)', borderColor: 'var(--rs-hud-line)',
      borderRadius: 'var(--rs-radius-md)', padding: 'var(--rs-space-4)',
      fontSize: 'var(--rs-text-sm)', color: 'var(--rs-text-on-dark)',
    }}>
      <h3 id="provenance-title" className="game-eyebrow" style={{ margin: '0 0 var(--rs-space-3)' }}>
        Embedded provenance
      </h3>

      {p ? (
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--rs-space-2) var(--rs-space-3)', margin: 0 }}>
          <Row k="Fork" v={p.fork_id} />
          <Row k="Parent" v={p.parent_fork_id ?? '—'} />
          <Row k="Nation" v={countryName(p.nation_iso)} />
          <Row k="Diverged from reality" v={p.divergence_date} />
          <Row k="Reporting sim-date" v={p.sim_date} />
          <Row k="Real-world data cutoff" v={p.real_world_data_cutoff} highlight />
          <Row k="Counterfactual" v={p.is_counterfactual ? 'Yes' : 'No'} />
        </dl>
      ) : (
        <p style={{ margin: 0, color: 'var(--rs-muted-on-dark)' }}>
          This item shipped without a provenance block, so there's nothing to check it against.
        </p>
      )}

      <div style={{ marginTop: 'var(--rs-space-4)', paddingTop: 'var(--rs-space-3)', borderTop: '1px solid var(--rs-hud-line)' }}>
        <div className="game-eyebrow" style={{ fontSize: 'var(--rs-text-2xs)', marginBottom: 'var(--rs-space-1)' }}>
          Canonical hash
        </div>
        <code style={{
          display: 'block', wordBreak: 'break-all', fontFamily: 'var(--rs-font-mono)', fontSize: 'var(--rs-text-xs)',
          color: 'var(--rs-text-on-dark)', lineHeight: 1.5,
        }}>
          {entry.canonical_hash}
        </code>
        <p style={{ color: 'var(--rs-muted-on-dark)', fontSize: 'var(--rs-text-xs)', margin: 'var(--rs-space-3) 0 0', lineHeight: 1.5 }}>
          Download the MP4 and re-derive this hash with{' '}
          <code style={{ fontFamily: 'var(--rs-font-mono)', color: 'var(--rs-text-on-dark)' }}>genblaze verify &lt;file&gt;</code>.
          The fields above are baked into it, so nobody can quietly edit history. This proves integrity,
          not authorship, and it isn't C2PA.
        </p>
        <Link
          to="/verify"
          className="game-button game-button-dark"
          style={{ marginTop: 'var(--rs-space-3)', fontSize: 'var(--rs-text-sm)' }}
        >
          Verify a file in your browser →
        </Link>
      </div>
    </section>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <>
      <dt style={{ color: 'var(--rs-muted-on-dark)' }}>{k}</dt>
      <dd style={{
        margin: 0, textAlign: 'right', fontFamily: 'var(--rs-font-mono)', fontVariantNumeric: 'tabular-nums',
        color: highlight ? 'var(--rs-sun)' : 'var(--rs-text-on-dark)',
        fontWeight: 700,
      }}>
        {v}
      </dd>
    </>
  );
}
