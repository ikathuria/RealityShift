// runAgents.ts — orchestrates one simulation step (= one simulated YEAR).
//
// GitHub Actions calls POST /api/agents/run once per country (passing
// { world_id, country_code } in the body). Each Worker invocation handles
// exactly one country, staying well within Cloudflare's free-tier limits.
// Forks are stepped by POST /api/fork/simulate-year, which calls runAgent for a
// few countries per invocation with an explicit `simYear`.
//
// runAllAgents() is available for testing in environments with longer budgets
// (e.g. wrangler dev locally).
//
// Subrequests for one runAgent call: runCountryAgent (<= 6, or 4 with a state +
// snapshot) + decision insert 1 + events insert <= 1 + conflict detection <= 3
// + state upsert 1  =>  <= 12, or <= 9 from simulate-year. Keep it under ~15.

import { runCountryAgent, AgentError } from './countryAgent.js';
import { writeEvents, detectConflicts } from './events.js';
import { getSupabase } from '../lib/supabase.js';
import { DbError, loadLatestState, loadLatestStates, type StateRow } from '../lib/db.js';
import type { Env } from '../index.js';

export interface RunResult {
  country_code: string;
  success: boolean;
  /** True when the step was deliberately not run (see `reason`). */
  skipped?: boolean;
  reason?: string;
  /** The simulated year the decision was made in; the new state is year + 1. */
  year?: number;
  events_emitted?: number;
  /** A short, client-safe error code. The underlying detail is only logged. */
  error?: string;
}

export interface RunAgentOptions {
  /**
   * Simulate this year: decide from the country's state as of `simYear` and
   * write the result at `simYear + 1`. Used by forks, where a country that did
   * not react for a while may be several years behind the fork's year.
   * Defaults to the country's own latest year.
   */
  simYear?: number;
  /** The country's state to decide from (avoids a query). */
  state?: StateRow;
  /** Other countries' states, used for neighbour context and conflict checks. */
  snapshot?: Map<string, StateRow>;
}

const LIVE_WORLD_ID = 'live';

/** Client-safe error code for an exception thrown during an agent step. */
function errorCode(err: unknown): string {
  if (err instanceof AgentError) return err.code;
  if (err instanceof DbError) return 'db_error';
  return 'agent_failed';
}

// Run the agent for a single country, write results to Supabase.
// Never throws: failures come back as { success: false, error: <code> }.
export async function runAgent(
  worldId: string,
  countryCode: string,
  env: Env,
  opts: RunAgentOptions = {},
): Promise<RunResult> {
  try {
    const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    const current = opts.state ?? (await loadLatestState(db, worldId, countryCode));
    if (!current) return { country_code: countryCode, success: false, error: 'no_state' };

    // Live-world guard: one step is one year, and the live sim year tracks the
    // real calendar year (real-news corrections are applied in place during
    // the year). Never advance the live world past the current UTC year.
    if (worldId === LIVE_WORLD_ID && opts.simYear === undefined) {
      const realYear = new Date().getUTCFullYear();
      if (current.year >= realYear) {
        return {
          country_code: countryCode,
          success: true,
          skipped: true,
          year: current.year,
          reason: `Live world is already at ${current.year}; it does not advance past the current real year (${realYear}).`,
        };
      }
    }

    const { state, decision, newState, newPolicies, newRelations, parallel } =
      await runCountryAgent(worldId, countryCode, env, { state: current, snapshot: opts.snapshot, simYear: opts.simYear });

    const year = opts.simYear ?? state.year;
    const nextYear = year + 1;

    // Prefer the RAG match over the LLM's self-reported parallel (which may
    // hallucinate a name).
    const historicalParallelValue = parallel
      ? { period_id: parallel.period_id, name: parallel.name, similarity_score: parallel.similarity_score }
      : decision.historical_parallel
        ? { name: decision.historical_parallel, similarity_score: null }
        : null;

    const { error: decErr } = await db.from('agent_decisions').insert({
      world_id: worldId,
      country_code: countryCode,
      year,
      decision: decision.policies_adjusted,
      reasoning: decision.reasoning,
      historical_parallel: historicalParallelValue,
      projected_indicators: decision.projected_indicators,
    });
    if (decErr) throw new DbError('insert agent_decisions', decErr.message);

    await writeEvents(db, worldId, countryCode, year, decision.events);
    await detectConflicts(db, worldId, countryCode, newRelations, newState, year, opts.snapshot);

    // Written last: a row at year + 1 marks this country's step as done, so a
    // retried simulate-year batch skips it.
    const { error: upErr } = await db.from('country_states').upsert(
      {
        world_id: worldId,
        country_code: countryCode,
        year: nextYear,
        indicators: newState,
        policies: newPolicies,
        relations: newRelations,
        agent_memory_summary: decision.reasoning,
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'world_id,country_code,year' },
    );
    if (upErr) throw new DbError('upsert country_states', upErr.message);

    return { country_code: countryCode, success: true, year, events_emitted: decision.events.length };
  } catch (err) {
    console.error(`[runAgent] ${worldId}/${countryCode}:`, err instanceof Error ? err.message : err);
    return { country_code: countryCode, success: false, error: errorCode(err) };
  }
}

// Run agents for ALL countries in a world sequentially.
// Use only in local dev — too slow for a single Worker invocation in production.
export async function runAllAgents(worldId: string, env: Env): Promise<RunResult[]> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const states = await loadLatestStates(db, worldId);
  const results: RunResult[] = [];
  for (const s of states) {
    results.push(await runAgent(worldId, s.country_code, env));
  }
  return results;
}
