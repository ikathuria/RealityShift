import type { SimProvenance } from './mediaIndex';

/**
 * Browser-side provenance inspection.
 *
 * HONEST SCOPE — this is *integrity*, not authentication, and NOT C2PA. The
 * cryptographic ground truth is the `genblaze verify <file>` CLI, which
 * re-derives the canonical SHA-256 over the run metadata. A browser cannot
 * reproduce that canonicalization, so it does not claim to. What it *can* do,
 * with real primitives, is:
 *   1. compute the downloaded file's SHA-256 fingerprint (Web Crypto),
 *   2. check the provenance block against RealityShift's documented invariants,
 *   3. cross-reference the public media index by canonical hash.
 * None of these are a substitute for `genblaze verify`; together they let a
 * visitor sanity-check an asset without installing anything.
 */

export interface ProvenanceCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface ProvenanceReport {
  fields: SimProvenance | null;
  canonicalHash: string | null;
  kind: ProvenanceKind | null;
  /** Synthetic demo content: well-formed or not, it attests nothing real. */
  sample: boolean;
  checks: ProvenanceCheck[];
  /** True only if every structural/consistency check passed. */
  consistent: boolean;
}

/** SHA-256 of raw bytes as lowercase hex, using the Web Crypto API. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
// Full ISO-8601 UTC timestamp as JS toISOString() writes it (ms optional).
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

export const LIVE_CUTOFF_TEXT = 'Live world, updated monthly with real news';

export type ProvenanceKind = 'fork' | 'live' | 'sample';

/** Which kind of world a provenance block describes. */
export function provenanceKind(p: Pick<SimProvenance, 'sample' | 'live_world'>): ProvenanceKind {
  if (p.sample) return 'sample';
  if (p.live_world) return 'live';
  return 'fork';
}

/**
 * Human-readable real-world data cutoff.
 * - null on the live world → "Live world, updated monthly with real news"
 * - a full timestamp → "1 Aug 2026, 09:30 UTC"
 * - a bare date (older manifests) → "1 Aug 2026"
 */
export function formatCutoff(cutoff: string | null | undefined, liveWorld = false): string {
  if (!cutoff) return liveWorld ? LIVE_CUTOFF_TEXT : 'None recorded';
  const ms = Date.parse(cutoff);
  if (Number.isNaN(ms)) return cutoff;
  const d = new Date(ms);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  if (ISO_DATE.test(cutoff)) return date;
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  return `${date}, ${time} UTC`;
}

/**
 * Pull the SimProvenance block and canonical hash out of whatever the user
 * pasted: a genblaze-style `{ simulation: {...}, canonical_hash }`, a flat
 * provenance object, or a media-index entry `{ provenance, canonical_hash }`.
 * Returns null when the input has no recognizable provenance shape.
 */
export function extractProvenance(
  input: unknown,
): { fields: SimProvenance | null; canonicalHash: string | null } {
  if (!input || typeof input !== 'object') return { fields: null, canonicalHash: null };
  const obj = input as Record<string, unknown>;

  const canonicalHash =
    typeof obj.canonical_hash === 'string' ? obj.canonical_hash
    : typeof obj.hash === 'string' ? (obj.hash as string)
    : null;

  const raw =
    (obj.simulation as Record<string, unknown> | undefined) ??
    (obj.provenance as Record<string, unknown> | undefined) ??
    (('fork_id' in obj || 'real_world_data_cutoff' in obj) ? obj : undefined);

  if (!raw) return { fields: null, canonicalHash };

  const fields: SimProvenance = {
    fork_id: String(raw.fork_id ?? ''),
    parent_fork_id: raw.parent_fork_id == null ? null : String(raw.parent_fork_id),
    divergence_date: String(raw.divergence_date ?? ''),
    sim_date: String(raw.sim_date ?? ''),
    real_world_data_cutoff: raw.real_world_data_cutoff == null ? null : String(raw.real_world_data_cutoff),
    live_world: raw.live_world === true,
    sample: raw.sample === true,
    nation_iso: raw.nation_iso == null ? null : String(raw.nation_iso),
    is_counterfactual: raw.is_counterfactual === true,
    consensus_reality: raw.consensus_reality === true,
  };
  return { fields, canonicalHash };
}

/**
 * Validate a provenance block against RealityShift's documented invariants.
 * These are consistency checks on the attested fields: they do not prove the
 * hash, they prove the claim is well-formed and coherent.
 *
 * - Fork: the cutoff is the real moment the fork was created (a full UTC
 *   timestamp, on/after the divergence date); it is counterfactual and not
 *   consensus reality.
 * - Live world: no cutoff (null), because it keeps ingesting real news.
 * - Sample: synthetic demo content. Its block can be well-formed, but the
 *   report's `sample` flag says it attests nothing real.
 */
export function inspectProvenance(input: unknown): ProvenanceReport {
  const { fields, canonicalHash } = extractProvenance(input);
  const checks: ProvenanceCheck[] = [];

  if (!fields) {
    return {
      fields: null,
      canonicalHash,
      kind: null,
      sample: false,
      checks: [{ label: 'Provenance block present', pass: false, detail: 'No simulation.* provenance found in the input.' }],
      consistent: false,
    };
  }

  const kind = provenanceKind(fields);
  const cutoff = fields.real_world_data_cutoff;

  checks.push({
    label: 'Fork identity present',
    pass: fields.fork_id.length > 0,
    detail: fields.fork_id ? `fork_id = ${fields.fork_id}` : 'Missing fork_id.',
  });

  if (kind === 'sample') {
    checks.push({
      label: 'Flagged as a synthetic demo sample',
      pass: true,
      detail: 'sample = true: bundled demo content, not output from the live world or a real fork.',
    });
    checks.push({
      label: 'Cutoff is empty or a valid timestamp',
      pass: cutoff === null || ISO_TIMESTAMP.test(cutoff),
      detail: cutoff === null ? 'No cutoff (samples have no real-world data to cut off).' : cutoff,
    });
  } else if (kind === 'live') {
    checks.push({
      label: 'Live world has no data cutoff',
      pass: cutoff === null,
      detail: cutoff === null
        ? `${LIVE_CUTOFF_TEXT}, so there is no cutoff.`
        : `The live world must not claim a cutoff, but this one says ${cutoff}.`,
    });
    checks.push({
      label: 'Identifies as the live world',
      pass: fields.fork_id === 'live' && fields.parent_fork_id === null,
      detail: 'live_world = true requires fork_id = "live" and no parent fork.',
    });
  } else {
    const cutoffOk = cutoff !== null && ISO_TIMESTAMP.test(cutoff) && !Number.isNaN(Date.parse(cutoff));
    checks.push({
      label: 'Real-world data cutoff is a valid timestamp',
      pass: cutoffOk,
      detail: cutoffOk
        ? `${formatCutoff(cutoff)} (when the fork was created)`
        : cutoff === null
          ? 'Missing real_world_data_cutoff. Only the live world may omit it.'
          : `Malformed real_world_data_cutoff: ${cutoff}. Expected a full UTC timestamp.`,
    });

    if (cutoffOk && ISO_DATE_PREFIX.test(fields.divergence_date)) {
      checks.push({
        label: 'Cutoff is on/after the divergence date',
        pass: cutoff!.slice(0, 10) >= fields.divergence_date.slice(0, 10),
        detail: `A fork copies the live world at creation, so ${formatCutoff(cutoff)} must not precede divergence on ${fields.divergence_date}.`,
      });
    }

    checks.push({
      label: 'Marked counterfactual',
      pass: fields.is_counterfactual === true,
      detail: 'Forked media must declare is_counterfactual = true.',
    });

    checks.push({
      label: 'Not consensus reality',
      pass: fields.consensus_reality === false,
      detail: 'A fork is not the consensus timeline (consensus_reality = false).',
    });
  }

  if (ISO_DATE_PREFIX.test(fields.sim_date) && ISO_DATE_PREFIX.test(fields.divergence_date)) {
    checks.push({
      label: 'Reporting date is at/after divergence',
      pass: fields.sim_date.slice(0, 10) >= fields.divergence_date.slice(0, 10),
      detail: `sim_date ${fields.sim_date} vs divergence ${fields.divergence_date}`,
    });
  }

  return {
    fields,
    canonicalHash,
    kind,
    sample: kind === 'sample',
    checks,
    consistent: checks.every(c => c.pass),
  };
}
