import { chat } from '../ai/llm.js';
import { buildMessages } from './prompt.js';
import type {
  CountryHistory,
  CountryStateRow,
  NeighborSummary,
  HistoricalParallel,
  RegionalPolicySummary,
} from './prompt.js';
import { getSupabase } from '../lib/supabase.js';
import { DbError, loadLatestState, type StateRow } from '../lib/db.js';
import { finiteNumber, sanitizeIndicators, sanitizeRelations } from '../lib/sanitize.js';
import { topParallel } from '../history/match.js';
import { fetchIncomingEvents } from './events.js';
import { applyDecision, parseDecision, type AgentDecision } from './decision.js';
import countryHistories from '../data/history/country_histories.json';
import type { Env } from '../index.js';

export type { AgentDecision };

/**
 * Subrequests per call (Cloudflare free plan allows 50 per invocation):
 *   state            1 (0 when `opts.state` is passed)
 *   neighbour info   1-2 (decisions; latest states only without `opts.snapshot`)
 *   incoming events  1
 *   regional policy  1
 *   LLM              1
 * => at most 6, or 4 with a state + snapshot supplied (simulate-year does this).
 */
export interface CountryAgentOptions {
  /** The state to decide from. Defaults to the country's latest row. */
  state?: StateRow;
  /** Other countries' states (e.g. as of the year being simulated). */
  snapshot?: Map<string, StateRow>;
  /** The year being simulated, when it differs from `state.year` (a fork
   *  country that has not reacted for a while lags the fork's year). */
  simYear?: number;
}

export class AgentError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AgentError';
  }
}

function getHistory(iso3: string): CountryHistory | null {
  return (countryHistories as Record<string, CountryHistory>)[iso3] ?? null;
}

/**
 * Enriched neighbor context: last 3 decision reasonings + current indicators
 * for each of the country's top 5 key relationships.
 */
async function fetchNeighborContext(
  worldId: string,
  keyRelationships: string[],
  currentYear: number,
  env: Env,
  snapshot?: Map<string, StateRow>,
): Promise<NeighborSummary[]> {
  if (!keyRelationships.length) return [];
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const targets = keyRelationships.slice(0, 5);

  const { data: decisions, error: decErr } = await db
    .from('agent_decisions')
    .select('country_code, reasoning, year')
    .eq('world_id', worldId)
    .in('country_code', targets)
    .gte('year', currentYear - 3)
    .lte('year', currentYear)
    .order('year', { ascending: false })
    .order('id', { ascending: false })
    .limit(30);
  if (decErr) throw new DbError('read neighbour decisions', decErr.message);

  const latestIndicators = new Map<string, Record<string, number>>();
  if (snapshot) {
    for (const code of targets) {
      const s = snapshot.get(code);
      if (s) latestIndicators.set(code, sanitizeIndicators(s.indicators));
    }
  } else {
    const { data: states, error: stErr } = await db
      .from('latest_country_states')
      .select('country_code, indicators')
      .eq('world_id', worldId)
      .in('country_code', targets);
    if (stErr) throw new DbError('read neighbour states', stErr.message);
    for (const row of (states ?? []) as { country_code: string; indicators: unknown }[]) {
      latestIndicators.set(row.country_code, sanitizeIndicators(row.indicators));
    }
  }

  const decisionsByCountry = new Map<string, string[]>();
  for (const row of (decisions ?? []) as { country_code: string; reasoning: string | null }[]) {
    const list = decisionsByCountry.get(row.country_code) ?? [];
    if (list.length < 3) list.push(row.reasoning ?? '');
    decisionsByCountry.set(row.country_code, list);
  }

  return targets.map(code => {
    const hist = (countryHistories as Record<string, CountryHistory>)[code];
    const [latest = 'No decision recorded.', ...prev] = decisionsByCountry.get(code) ?? [];
    const indicators = latestIndicators.get(code) ?? {};
    const keyInd: Record<string, number> = {};
    for (const k of ['gdp_per_capita', 'military_spend', 'unemployment']) {
      if (indicators[k] !== undefined) keyInd[k] = indicators[k];
    }
    return {
      country_code: code,
      country_name: hist?.country ?? code,
      recent_decision: latest,
      previous_decisions: prev,
      key_indicators: keyInd,
    };
  });
}

/**
 * Sub-national regional policies set by a player for this country in the given
 * world. Values are coerced to numbers; names are sanitised in the prompt.
 */
async function fetchRegionalPolicies(
  worldId: string,
  countryCode: string,
  env: Env,
): Promise<RegionalPolicySummary[]> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data, error } = await db
    .from('region_states')
    .select('region_name, region_code, policies')
    .eq('world_id', worldId)
    .eq('country_code', countryCode)
    .order('last_updated', { ascending: false })
    .limit(20);
  if (error) throw new DbError('read region_states', error.message);

  return ((data ?? []) as { region_name: unknown; region_code: unknown; policies: unknown }[]).map(row => {
    const p = (row.policies && typeof row.policies === 'object' ? row.policies : {}) as Record<string, unknown>;
    return {
      region_name: String(row.region_name ?? ''),
      region_code: String(row.region_code ?? ''),
      housing: finiteNumber(p.housing) ?? 5,
      transport: finiteNumber(p.transport) ?? 5,
      local_tax: finiteNumber(p.local_tax) ?? 20,
    };
  });
}

export async function runCountryAgent(
  worldId: string,
  countryCode: string,
  env: Env,
  opts: CountryAgentOptions = {},
): Promise<{
  state: StateRow;
  decision: AgentDecision;
  newState: Record<string, number>;
  newPolicies: Record<string, unknown>;
  newRelations: Record<string, string>;
  parallel: HistoricalParallel | null;
}> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const state = opts.state ?? (await loadLatestState(db, worldId, countryCode));
  if (!state) throw new AgentError('no_state', `No state found for ${countryCode} in world ${worldId}`);

  // Player-writable fields are sanitised before they reach matching or prompts.
  const cleanState: CountryStateRow = {
    ...state,
    year: opts.simYear ?? state.year,
    indicators: sanitizeIndicators(state.indicators),
    policies: state.policies && typeof state.policies === 'object' && !Array.isArray(state.policies) ? state.policies : {},
    relations: sanitizeRelations(state.relations, countryCode),
  };

  const history = getHistory(countryCode);

  const neighbors: NeighborSummary[] = history
    ? await fetchNeighborContext(worldId, history.key_relationships, cleanState.year, env, opts.snapshot)
    : [];
  const incomingEvents = await fetchIncomingEvents(db, worldId, countryCode, cleanState.year);

  const match = topParallel({ indicators: cleanState.indicators, policies: cleanState.policies });
  const parallel: HistoricalParallel | null = match
    ? {
        period_id: match.period.id,
        name: match.period.name,
        summary: match.period.summary,
        outcomes: match.period.outcomes,
        similarity_score: match.similarity,
      }
    : null;

  const regionalContext = await fetchRegionalPolicies(worldId, countryCode, env);

  const messages = buildMessages(
    cleanState,
    history ?? {
      country: countryCode,
      iso3: countryCode,
      political_leaning: 'unknown',
      current_government: 'unknown',
      key_relationships: [],
      events: [],
    },
    neighbors,
    parallel,
    incomingEvents,
    regionalContext,
  );

  let raw: string;
  try {
    raw = await chat(messages, env.GROQ_API_KEY, { temperature: 0.6, maxTokens: 1200, jsonMode: true });
  } catch (e) {
    throw new AgentError('llm_failed', e instanceof Error ? e.message : String(e));
  }

  let decision: AgentDecision;
  try {
    decision = parseDecision(raw, countryCode);
  } catch (e) {
    throw new AgentError('invalid_llm_output', e instanceof Error ? e.message : String(e));
  }

  const applied = applyDecision(cleanState.indicators, cleanState.policies, decision);
  const newRelations: Record<string, string> = {
    ...cleanState.relations,
    ...decision.relations_update,
  };

  return {
    state,
    decision,
    newState: applied.indicators,
    newPolicies: applied.policies,
    newRelations,
    parallel,
  };
}
