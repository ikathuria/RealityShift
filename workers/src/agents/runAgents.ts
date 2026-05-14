// runAgents.ts — orchestrates one simulation step.
//
// GitHub Actions calls POST /api/agents/run once per country (passing
// { world_id, country_code } in the body). Each Worker invocation handles
// exactly one country, staying well within Cloudflare's free-tier limits.
//
// runAllAgents() is available for testing in environments with longer budgets
// (e.g. wrangler dev locally).

import { runCountryAgent } from './countryAgent.js';
import { getSupabase } from '../lib/supabase.js';
import type { Env } from '../index.js';

export interface RunResult {
  country_code: string;
  success: boolean;
  error?: string;
}

// Run the agent for a single country, write results to Supabase.
export async function runAgent(
  worldId: string,
  countryCode: string,
  env: Env
): Promise<RunResult> {
  try {
    const { decision, newState } = await runCountryAgent(worldId, countryCode, env);
    const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Determine current simulated year from the state
    const { data: stateRow } = await db
      .from('country_states')
      .select('year')
      .eq('world_id', worldId)
      .eq('country_code', countryCode)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    const year: number = stateRow?.year ?? new Date().getFullYear();

    // Write to agent_decisions log
    await db.from('agent_decisions').insert({
      world_id: worldId,
      country_code: countryCode,
      year,
      decision: decision.policies_adjusted,
      reasoning: decision.reasoning,
      historical_parallel: decision.historical_parallel
        ? { name: decision.historical_parallel, similarity_score: null }
        : null,
      projected_indicators: decision.projected_indicators,
    });

    // Upsert updated country state (advance year by 1 each full agent cycle)
    await db.from('country_states').upsert({
      world_id: worldId,
      country_code: countryCode,
      year: year + 1,
      indicators: newState,
      policies: decision.policies_adjusted,
      agent_memory_summary: decision.reasoning,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'world_id,country_code,year' });

    return { country_code: countryCode, success: true };
  } catch (err) {
    return { country_code: countryCode, success: false, error: String(err) };
  }
}

// Run agents for ALL countries in a world sequentially.
// Use only in local dev — too slow for a single Worker invocation in production.
export async function runAllAgents(
  worldId: string,
  env: Env
): Promise<RunResult[]> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data } = await db
    .from('country_states')
    .select('country_code')
    .eq('world_id', worldId)
    .order('year', { ascending: false });

  if (!data) return [];

  // De-duplicate (keep one row per country — the most recent year)
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const row of data as { country_code: string }[]) {
    if (!seen.has(row.country_code)) {
      seen.add(row.country_code);
      codes.push(row.country_code);
    }
  }

  const results: RunResult[] = [];
  for (const code of codes) {
    results.push(await runAgent(worldId, code, env));
  }
  return results;
}
