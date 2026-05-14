import { chat } from '../ai/llm.js';
import { buildMessages } from './prompt.js';
import type { CountryHistory, CountryStateRow, NeighborSummary, HistoricalParallel } from './prompt.js';
import { getSupabase } from '../lib/supabase.js';
import { topParallel } from '../history/match.js';
import { fetchIncomingEvents } from './events.js';
import type { AgentEvent } from './events.js';
import countryHistories from '../data/history/country_histories.json';
import type { Env } from '../index.js';

export interface AgentDecision {
  policies_adjusted: {
    tax_rate_delta?: number;
    military_spend_delta?: number;
    education_spend_delta?: number;
    healthcare_spend_delta?: number;
    trade_openness_delta?: number;
  };
  reasoning: string;
  historical_parallel: string | null;
  projected_indicators: {
    gdp_growth_pct?: number;
    unemployment_delta?: number;
    inflation_est?: number;
  };
  /** Inter-country events emitted by this agent */
  events?: AgentEvent[];
  /** Relations to update: ISO3 → 'ally' | 'neutral' | 'rival' | 'enemy' */
  relations_update?: Record<string, string>;
}

function getHistory(iso3: string): CountryHistory | null {
  return (countryHistories as Record<string, CountryHistory>)[iso3] ?? null;
}

async function fetchState(
  worldId: string,
  countryCode: string,
  env: Env
): Promise<CountryStateRow | null> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data, error } = await db
    .from('country_states')
    .select('*')
    .eq('world_id', worldId)
    .eq('country_code', countryCode)
    .order('year', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return data as CountryStateRow;
}

/**
 * Fetch enriched neighbor context: last 3 decision reasonings + current
 * indicators for each of the country's top 5 key relationships.
 */
async function fetchNeighborContext(
  worldId: string,
  keyRelationships: string[],
  currentYear: number,
  env: Env
): Promise<NeighborSummary[]> {
  if (!keyRelationships.length) return [];
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const targets = keyRelationships.slice(0, 5);

  // Fetch last 3 decisions per neighbor
  const { data: decisions } = await db
    .from('agent_decisions')
    .select('country_code, reasoning, year')
    .eq('world_id', worldId)
    .in('country_code', targets)
    .gte('year', currentYear - 3)
    .order('year', { ascending: false })
    .limit(15);  // max 3 × 5 countries

  // Fetch latest indicators per neighbor
  const { data: states } = await db
    .from('country_states')
    .select('country_code, indicators, year')
    .eq('world_id', worldId)
    .in('country_code', targets)
    .order('year', { ascending: false });

  // Deduplicate states: keep latest year per country
  const latestIndicators = new Map<string, Record<string, number>>();
  for (const row of (states ?? []) as { country_code: string; indicators: Record<string, number>; year: number }[]) {
    if (!latestIndicators.has(row.country_code)) {
      latestIndicators.set(row.country_code, row.indicators);
    }
  }

  // Group decisions by country, preserve recency order
  const decisionsByCountry = new Map<string, string[]>();
  for (const row of (decisions ?? []) as { country_code: string; reasoning: string }[]) {
    const list = decisionsByCountry.get(row.country_code) ?? [];
    if (list.length < 3) list.push(row.reasoning ?? '');
    decisionsByCountry.set(row.country_code, list);
  }

  const summaries: NeighborSummary[] = [];
  for (const code of targets) {
    const hist = (countryHistories as Record<string, CountryHistory>)[code];
    const [latest = 'No decision recorded.', ...prev] = decisionsByCountry.get(code) ?? [];
    const indicators = latestIndicators.get(code) ?? {};

    // Only include a subset of indicators most relevant to geopolitics
    const keyInd: Record<string, number> = {};
    for (const k of ['gdp_per_capita', 'military_spend', 'unemployment']) {
      if (indicators[k] !== undefined) keyInd[k] = indicators[k];
    }

    summaries.push({
      country_code: code,
      country_name: hist?.country ?? code,
      recent_decision: latest,
      previous_decisions: prev,
      key_indicators: keyInd,
    });
  }

  return summaries;
}

function applyDeltas(
  indicators: Record<string, number>,
  decision: AgentDecision
): Record<string, number> {
  const updated = { ...indicators };
  const { policies_adjusted: p, projected_indicators: proj } = decision;

  if (p.tax_rate_delta)         updated.tax_rate         = (updated.tax_rate         ?? 0) + p.tax_rate_delta;
  if (p.military_spend_delta)   updated.military_spend   = (updated.military_spend   ?? 0) + p.military_spend_delta;
  if (p.education_spend_delta)  updated.education_spend  = (updated.education_spend  ?? 0) + p.education_spend_delta;
  if (p.healthcare_spend_delta) updated.healthcare_spend = (updated.healthcare_spend ?? 0) + p.healthcare_spend_delta;

  if (proj.gdp_growth_pct !== undefined && updated.gdp_per_capita) {
    updated.gdp_per_capita = updated.gdp_per_capita * (1 + proj.gdp_growth_pct / 12);
  }
  if (proj.unemployment_delta !== undefined) {
    updated.unemployment = Math.max(0, (updated.unemployment ?? 0) + proj.unemployment_delta);
  }

  return updated;
}

export async function runCountryAgent(
  worldId: string,
  countryCode: string,
  env: Env
): Promise<{
  decision: AgentDecision;
  newState: Record<string, number>;
  newRelations: Record<string, string>;
  parallel: HistoricalParallel | null;
}> {
  const state = await fetchState(worldId, countryCode, env);
  if (!state) throw new Error(`No state found for ${countryCode} in world ${worldId}`);

  const history = getHistory(countryCode);

  // Fetch enriched neighbor context (last 3 decisions + indicators)
  const neighbors: NeighborSummary[] = history
    ? await fetchNeighborContext(worldId, history.key_relationships, state.year, env).catch(() => [])
    : [];

  // Fetch events that other countries have sent to this country
  const incomingEvents = await fetchIncomingEvents(worldId, countryCode, state.year, env).catch(() => []);

  // Find closest historical parallel via TF-IDF cosine match
  const match = topParallel({ indicators: state.indicators, policies: state.policies });
  const parallel: HistoricalParallel | null = match
    ? {
        period_id: match.period.id,
        name: match.period.name,
        summary: match.period.summary,
        outcomes: match.period.outcomes,
        similarity_score: match.similarity,
      }
    : null;

  const messages = buildMessages(
    state,
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
    incomingEvents
  );

  const raw = await chat(messages, env.GROQ_API_KEY, { temperature: 0.6, maxTokens: 1200 });

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const decision: AgentDecision = JSON.parse(cleaned);

  const newIndicators = applyDeltas(state.indicators, decision);

  // Merge relations_update into current relations
  const newRelations: Record<string, string> = {
    ...(state.relations ?? {}),
    ...(decision.relations_update ?? {}),
  };

  return { decision, newState: newIndicators, newRelations, parallel };
}
