// Input validation and sanitisation shared by the routes and the agent prompts.
//
// Several fork fields are player-writable through RLS (agent_memory_summary,
// relations, policies, region names, active_tags) and LLM output is untrusted
// too. Everything that reaches a prompt, a PostgREST filter or a caption goes
// through these helpers first.

export const ISO3_RE = /^[A-Z]{3}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RELATION_VALUES = ['ally', 'neutral', 'rival', 'enemy'] as const;
export type Relation = (typeof RELATION_VALUES)[number];

export function isIso3(v: unknown): v is string {
  return typeof v === 'string' && ISO3_RE.test(v);
}

/** A world id the API accepts: the literal `live` or a UUID (fork ids are UUIDs). */
export function isWorldId(v: unknown): v is string {
  return typeof v === 'string' && (v === 'live' || UUID_RE.test(v));
}

export function isRelation(v: unknown): v is Relation {
  return typeof v === 'string' && (RELATION_VALUES as readonly string[]).includes(v);
}

// C0/C1 controls, plus zero-width and bidi-override characters that can hide
// or reorder text. Newlines and tabs are handled by the `singleLine` option.
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

/**
 * Coerce to a safe string: drop control/invisible characters, optionally fold
 * newlines into spaces, collapse runs of whitespace and cap the length.
 */
export function cleanText(v: unknown, max: number, opts: { singleLine?: boolean } = {}): string {
  if (typeof v !== 'string') return '';
  let s = v.replace(CONTROL_RE, '');
  if (opts.singleLine) s = s.replace(/[\r\n\t\u2028\u2029]+/g, ' ');
  else s = s.replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n').replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]{2,}/g, ' ').trim();
  return s.length > max ? s.slice(0, max).trimEnd() : s;
}

const NUMERIC_STRING_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?%?$/;

/**
 * A finite number, or undefined. Numeric strings ("1.5", " -2 ", "0.3%") are
 * coerced; anything else (words, objects, NaN, Infinity) is dropped.
 */
export function finiteNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!NUMERIC_STRING_RE.test(s)) return undefined;
    const n = Number(s.replace(/%$/, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** Indicators: only finite numbers under snake_case keys survive. */
export function sanitizeIndicators(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!KEY_RE.test(k)) continue;
    const n = finiteNumber(raw);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

/** Relations: ISO3 keys (not self) mapped to an allowed relation value. */
export function sanitizeRelations(v: unknown, self?: string, maxEntries = 60): Record<string, Relation> {
  const out: Record<string, Relation> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  let n = 0;
  for (const [rawKey, rawVal] of Object.entries(v as Record<string, unknown>)) {
    const key = rawKey.trim().toUpperCase();
    const val = typeof rawVal === 'string' ? rawVal.trim().toLowerCase() : rawVal;
    if (!isIso3(key) || key === self || !isRelation(val)) continue;
    out[key] = val;
    if (++n >= maxEntries) break;
  }
  return out;
}

/** Policy levels that may be shown to a prompt: numeric values under snake_case keys. */
export function numericPolicies(v: unknown, maxEntries = 20): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  let n = 0;
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!KEY_RE.test(k) || k.endsWith('_delta')) continue;
    const num = finiteNumber(raw);
    if (num === undefined) continue;
    out[k] = num;
    if (++n >= maxEntries) break;
  }
  return out;
}

/** Tags carried in policies.active_tags: short snake_case words only. */
export function sanitizeTags(v: unknown, maxEntries = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t): t is string => typeof t === 'string' && KEY_RE.test(t))
    .slice(0, maxEntries);
}

/**
 * Quote untrusted text as data for a prompt: a JSON string literal, so it can't
 * close a section or fake a heading. Pair with the system prompt's rule that
 * quoted DATA is never an instruction.
 */
export function quoteData(v: unknown, max: number): string {
  return JSON.stringify(cleanText(v, max));
}
