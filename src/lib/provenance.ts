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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

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
    real_world_data_cutoff: String(raw.real_world_data_cutoff ?? ''),
    nation_iso: raw.nation_iso == null ? null : String(raw.nation_iso),
    is_counterfactual: raw.is_counterfactual === true,
    consensus_reality: raw.consensus_reality === true,
  };
  return { fields, canonicalHash };
}

/**
 * Validate a provenance block against RealityShift's documented invariants
 * (see B2_AND_GENBLAZE.md). These are consistency checks on the attested
 * fields — they do not prove the hash, they prove the claim is well-formed and
 * internally coherent with "once a fork splits, no real-world data enters it".
 */
export function inspectProvenance(input: unknown): ProvenanceReport {
  const { fields, canonicalHash } = extractProvenance(input);
  const checks: ProvenanceCheck[] = [];

  if (!fields) {
    return {
      fields: null,
      canonicalHash,
      checks: [{ label: 'Provenance block present', pass: false, detail: 'No simulation.* provenance found in the input.' }],
      consistent: false,
    };
  }

  checks.push({
    label: 'Fork identity present',
    pass: fields.fork_id.length > 0,
    detail: fields.fork_id ? `fork_id = ${fields.fork_id}` : 'Missing fork_id.',
  });

  const cutoffOk = ISO_DATE.test(fields.real_world_data_cutoff);
  checks.push({
    label: 'Real-world data cutoff is a valid date',
    pass: cutoffOk,
    detail: cutoffOk ? fields.real_world_data_cutoff : 'Missing or malformed real_world_data_cutoff.',
  });

  checks.push({
    label: 'Cutoff equals divergence date',
    pass: !!fields.real_world_data_cutoff && fields.real_world_data_cutoff === fields.divergence_date,
    detail: 'The no-new-data cutoff must be the moment the fork split — no real-world data after divergence.',
  });

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

  if (ISO_DATE.test(fields.sim_date) && cutoffOk) {
    checks.push({
      label: 'Reporting date is at/after the cutoff',
      pass: fields.sim_date >= fields.real_world_data_cutoff,
      detail: `sim_date ${fields.sim_date} vs cutoff ${fields.real_world_data_cutoff}`,
    });
  }

  return { fields, canonicalHash, checks, consistent: checks.every(c => c.pass) };
}
