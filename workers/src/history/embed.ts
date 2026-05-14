// Static TF-IDF vectoriser over periods.json.
// Computed once at module initialisation; no external API calls.
//
// Each period is represented as a vector over a shared vocabulary built from:
//   - tags[]  (weight ×2 — explicit semantic labels)
//   - policyProfile keys (weight ×1 per profile entry)
//   - policyProfile high/extreme values produce additional term weight

import periodsRaw from '../data/history/periods.json';

export interface Period {
  id: string;
  name: string;
  country: string;
  yearRange: [number, number];
  tags: string[];
  policyProfile: Record<string, string>;
  outcomes: string;
  internationalReaction: string;
  summary: string;
}

export const periods: Period[] = periodsRaw as unknown as Period[];

// Intensity weights for policyProfile string values
const VALUE_WEIGHT: Record<string, number> = {
  none: 0,
  very_low: 0.5,
  low: 1,
  moderate: 2,
  high: 3,
  extreme: 4,
  // booleans / qualitative
  yes: 2,
  rapid: 2,
  high_for_developing_country: 2,
  declining: 2,
  increasing: 2,
  collapsing: 3,
  imposed: 2,
  broken: 2,
  maintained: 1,
};

function valueWeight(v: string): number {
  const lower = v.toLowerCase().replace(/[^a-z_]/g, '_');
  return VALUE_WEIGHT[lower] ?? 1;
}

// Build a raw term-frequency map for a single period
function termFreq(period: Period): Map<string, number> {
  const tf = new Map<string, number>();

  const add = (term: string, w: number) => {
    const t = term.toLowerCase().replace(/\s+/g, '_');
    tf.set(t, (tf.get(t) ?? 0) + w);
  };

  // Tags carry weight 2 — these are the primary semantic signal
  for (const tag of period.tags) add(tag, 2);

  // policyProfile: key name carries weight 1; value intensity bumps it
  for (const [key, val] of Object.entries(period.policyProfile)) {
    const intensity = valueWeight(String(val));
    add(key, intensity);
    // Also add key_value as a combined term for extreme cases
    if (intensity >= 3) add(`${key}_extreme`, 1);
  }

  return tf;
}

// Build vocabulary and IDF from the full corpus
function buildVocab(corpus: Map<string, number>[]): {
  vocab: string[];
  idf: Map<string, number>;
} {
  const df = new Map<string, number>();
  for (const doc of corpus) {
    for (const term of doc.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const N = corpus.length;
  const vocab = Array.from(df.keys()).sort();
  const idf = new Map<string, number>();
  for (const term of vocab) {
    idf.set(term, Math.log(N / (df.get(term)! + 1)) + 1);
  }

  return { vocab, idf };
}

// Convert a TF map to a unit-normalised TF-IDF vector
function toVector(tf: Map<string, number>, vocab: string[], idf: Map<string, number>): Float32Array {
  const vec = new Float32Array(vocab.length);
  let norm = 0;

  for (let i = 0; i < vocab.length; i++) {
    const t = vocab[i];
    const tf_val = tf.get(t) ?? 0;
    const tfidf = tf_val * (idf.get(t) ?? 1);
    vec[i] = tfidf;
    norm += tfidf * tfidf;
  }

  const mag = Math.sqrt(norm);
  if (mag > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= mag;
  }

  return vec;
}

// ────────────────────────────────────────────────────────────
// Pre-compute everything at module load time
// ────────────────────────────────────────────────────────────

const corpusTF = periods.map(termFreq);
export const { vocab, idf } = buildVocab(corpusTF);
export const periodVectors: Float32Array[] = corpusTF.map(tf => toVector(tf, vocab, idf));

// Public: get a vector for a period by index (same order as periods[])
export function getVector(periodIndex: number): Float32Array {
  return periodVectors[periodIndex];
}

// Public: build a query vector from a free-form tag/key set
// Tags come from the indicator analysis in match.ts
export function buildQueryVector(tags: string[], profileKeys: Record<string, number> = {}): Float32Array {
  const tf = new Map<string, number>();

  for (const tag of tags) {
    const t = tag.toLowerCase().replace(/\s+/g, '_');
    tf.set(t, (tf.get(t) ?? 0) + 2);
  }

  for (const [key, weight] of Object.entries(profileKeys)) {
    const t = key.toLowerCase().replace(/\s+/g, '_');
    tf.set(t, (tf.get(t) ?? 0) + weight);
    if (weight >= 3) tf.set(`${t}_extreme`, (tf.get(`${t}_extreme`) ?? 0) + 1);
  }

  return toVector(tf, vocab, idf);
}
