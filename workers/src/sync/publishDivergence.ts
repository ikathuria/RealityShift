// Writes a divergence report to the `divergences` table and applies
// the self-correction to `country_states` to nudge the simulation
// back toward reality.

import { getSupabase } from '../lib/supabase.js';
import type { CountryStateRow } from '../agents/prompt.js';
import type { DivergenceResult } from './compareState.js';

export async function publishDivergence(
  state: CountryStateRow,
  result: DivergenceResult,
  realNewsBlock: string,
  supabaseUrl: string,
  serviceKey: string
): Promise<void> {
  const db = getSupabase(supabaseUrl, serviceKey);

  // 1. Insert divergence report (always, even if delta is small — record keeping)
  await db.from('divergences').insert({
    country_code: state.country_code,
    sim_year: state.year,
    real_date: new Date().toISOString().slice(0, 10),
    sim_state: state.indicators,
    real_state: {},   // We don't have exact real values, just news — leave for M6 enrichment
    delta: result.delta,
    narrative: `${result.explanation}\n\nNews used:\n${realNewsBlock}`,
    published_at: new Date().toISOString(),
  });

  // 2. Apply self-correction to country_states (upsert same year with corrected indicators)
  if (Object.keys(result.self_correction).length === 0) return;

  const corrected = { ...state.indicators };
  for (const [key, delta] of Object.entries(result.self_correction)) {
    if (typeof corrected[key] === 'number') {
      corrected[key] = corrected[key] + delta;
    }
  }

  await db.from('country_states').upsert({
    world_id: state.world_id,
    country_code: state.country_code,
    year: state.year,
    indicators: corrected,
    policies: state.policies,
    relations: state.relations,
    agent_memory_summary: state.agent_memory_summary,
    last_updated: new Date().toISOString(),
  }, { onConflict: 'world_id,country_code,year' });
}
