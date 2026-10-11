// Compares a country's simulated state to real-world news headlines.
// Calls the LLM to identify divergences and generate a self-correction.
//
// Design principles:
// - Conservative: only flag divergences when news clearly contradicts the sim.
// - Self-corrections are gentle nudges (small deltas), not wholesale replacements.
// - Low temperature (0.3) for more grounded, factual responses.

import { chat } from '../ai/llm.js';
import type { Message } from '../ai/llm.js';
import type { CountryStateRow } from '../agents/prompt.js';
import { cleanText, finiteNumber, sanitizeIndicators } from '../lib/sanitize.js';

export interface DivergenceResult {
  diverged: boolean;
  delta: Record<string, number>;         // indicator → magnitude of divergence
  explanation: string;                   // human-readable narrative
  self_correction: Record<string, number>; // gentle deltas to apply to indicators
}

function buildCompareMessages(
  countryName: string,
  state: CountryStateRow,
  newsBlock: string
): Message[] {
  const indLines = Object.entries(sanitizeIndicators(state.indicators))
    .map(([k, v]) => `  ${k}: ${v.toFixed(2)}`)
    .join('\n');

  const system: Message = {
    role: 'system',
    content: `You are an objective analyst comparing a simulated country state to real-world news.
Your job is to identify where the simulation has drifted from reality.

Rules:
- Only flag a divergence if real news CLEARLY contradicts the simulated indicators.
- The simulation advances one step per YEAR; this check runs monthly and corrects the current
  simulated year in place. Self-corrections must be small adjustments (not snapping to reality in one step).
- All values in "delta" and "self_correction" must be plain JSON numbers (no strings, no units).
- If news is ambiguous or the simulation is plausible, set diverged=false.
- Output ONLY valid JSON — no prose, no markdown fences.

OUTPUT FORMAT:
{
  "diverged": <boolean>,
  "delta": {
    "<indicator_key>": <number — positive means sim is above reality, negative means below>
  },
  "explanation": "<1-3 sentences describing the divergence or confirming alignment>",
  "self_correction": {
    "<indicator_key>": <small delta to apply — typically ±0.5 to ±5% of current value>
  }
}

If diverged=false, delta and self_correction should be empty objects {}.`,
  };

  const user: Message = {
    role: 'user',
    content: `COUNTRY: ${countryName}
SIMULATED YEAR: ${state.year}

SIMULATED INDICATORS:
${indLines}

REAL-WORLD NEWS HEADLINES (last 30 days):
${newsBlock}

Does the simulated state diverge from what the news suggests about reality?
Respond with the JSON object only.`,
  };

  return [system, user];
}

export async function compareState(
  countryName: string,
  state: CountryStateRow,
  newsBlock: string,
  apiKey: string
): Promise<DivergenceResult> {
  // If there's no real news to compare against, return no divergence
  if (newsBlock === 'No recent news available.') {
    return { diverged: false, delta: {}, explanation: 'No news data available for comparison.', self_correction: {} };
  }

  const messages = buildCompareMessages(countryName, state, newsBlock);
  const raw = await chat(messages, apiKey, { temperature: 0.3, maxTokens: 512, jsonMode: true });
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // If the LLM returns unparseable output, treat as no divergence
    return {
      diverged: false,
      delta: {},
      explanation: 'Could not parse comparison result.',
      self_correction: {},
    };
  }
  return normalizeDivergence(parsed, sanitizeIndicators(state.indicators));
}

/** Largest single self-correction, as a fraction of the indicator's current value. */
export const MAX_CORRECTION_FRACTION = 0.1;
/** ...but always allow at least this absolute nudge (for small %-point indicators). */
export const MIN_CORRECTION_ABS = 0.5;

function numericMap(v: unknown, allowedKeys?: Set<string>): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) continue;
    if (allowedKeys && !allowedKeys.has(k)) continue;
    const n = finiteNumber(raw);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

/**
 * Validate the comparison JSON: numbers are coerced (strings like "0.5" would
 * otherwise string-concatenate when applied), non-numerics are dropped, and
 * each self-correction is limited to the indicators the country actually has
 * and to a small nudge (max(10% of the current value, 0.5)).
 */
export function normalizeDivergence(raw: unknown, indicators: Record<string, number>): DivergenceResult {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const diverged = o.diverged === true || o.diverged === 'true';
  const explanation = cleanText(o.explanation, 1000) || (diverged ? 'Divergence detected.' : 'No divergence detected.');
  if (!diverged) return { diverged: false, delta: {}, explanation, self_correction: {} };

  const delta = numericMap(o.delta);
  const self_correction: Record<string, number> = {};
  for (const [k, d] of Object.entries(numericMap(o.self_correction, new Set(Object.keys(indicators))))) {
    const limit = Math.max(Math.abs(indicators[k]) * MAX_CORRECTION_FRACTION, MIN_CORRECTION_ABS);
    self_correction[k] = Math.min(limit, Math.max(-limit, d));
  }
  return { diverged, delta, explanation, self_correction };
}
