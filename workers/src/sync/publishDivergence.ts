// Writes a divergence report to the `divergences` table and applies
// the self-correction to `country_states` to nudge the simulation
// back toward reality.
//
// Time semantics: one agent step is one simulated YEAR. This runs monthly on
// the live world and corrects the CURRENT sim year in place (same year row);
// it never advances the year. The divergence row is upserted on
// (country_code, sim_year, real_date), so a re-run on the same day is idempotent.
// DB errors throw DbError.

import { getSupabase } from '../lib/supabase.js';
import type { CountryStateRow } from '../agents/prompt.js';
import type { DivergenceResult } from './compareState.js';
import { DbError } from '../lib/db.js';
import { finiteNumber, sanitizeIndicators } from '../lib/sanitize.js';

/** Indicators that can never be negative after a correction. */
const NON_NEGATIVE = new Set([
  'gdp_per_capita', 'population', 'tax_rate', 'military_spend',
  'education_spend', 'healthcare_spend', 'unemployment',
]);

/** Apply numeric self-corrections to the current indicators (pure, exported for tests). */
export function applyCorrection(
  indicators: Record<string, number>,
  correction: Record<string, unknown>,
): Record<string, number> {
  const corrected = sanitizeIndicators(indicators);
  for (const [key, raw] of Object.entries(correction)) {
    const delta = finiteNumber(raw);
    if (delta === undefined || typeof corrected[key] !== 'number') continue;
    let next = corrected[key] + delta;
    if (NON_NEGATIVE.has(key)) next = Math.max(0, next);
    corrected[key] = next;
  }
  return corrected;
}

export async function publishDivergence(
  state: CountryStateRow,
  result: DivergenceResult,
  realNewsBlock: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<void> {
  const db = getSupabase(supabaseUrl, serviceKey);

  // 1. Upsert the divergence report (always, even if delta is small — record keeping)
  const { error: divErr } = await db.from('divergences').upsert(
    {
      country_code: state.country_code,
      sim_year: state.year,
      real_date: new Date().toISOString().slice(0, 10),
      sim_state: state.indicators,
      real_state: {}, // We don't have exact real values, just news — leave for M6 enrichment
      delta: result.delta,
      narrative: `${result.explanation}\n\nNews used:\n${realNewsBlock}`,
      published_at: new Date().toISOString(),
    },
    { onConflict: 'country_code,sim_year,real_date' },
  );
  if (divErr) throw new DbError('upsert divergences', divErr.message);

  // 2. Apply self-correction in place to the current sim year
  if (Object.keys(result.self_correction).length === 0) return;

  const { error: stateErr } = await db.from('country_states').upsert({
    world_id: state.world_id,
    country_code: state.country_code,
    year: state.year,
    indicators: applyCorrection(state.indicators, result.self_correction),
    policies: state.policies,
    relations: state.relations,
    agent_memory_summary: state.agent_memory_summary,
    last_updated: new Date().toISOString(),
  }, { onConflict: 'world_id,country_code,year' });
  if (stateErr) throw new DbError('upsert corrected country_states', stateErr.message);
}
