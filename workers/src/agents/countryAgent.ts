import { chat } from '../ai/llm.js';
import { buildMessages } from './prompt.js';
import type { CountryHistory, CountryStateRow, NeighborSummary, HistoricalParallel } from './prompt.js';
import { getSupabase } from '../lib/supabase.js';
import { topParallel } from '../history/match.js';
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

async function fetchNeighborContext(
  worldId: string,
  keyRelationships: string[],
  year: number,
  env: Env
): Promise<NeighborSummary[]> {
  if (!keyRelationships.length) return [];
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data } = await db
    .from('agent_decisions')
    .select('country_code, reasoning, decision')
    .eq('world_id', worldId)
    .eq('year', year)
    .in('country_code', keyRelationships.slice(0, 5));

  if (!data) return [];
  return data.map((row: { country_code: string; reasoning: string; decision: AgentDecision }) => ({
    country_code: row.country_code,
    country_name: (countryHistories as Record<string, CountryHistory>)[row.country_code]?.country ?? row.country_code,
    recent_decision: row.reasoning ?? 'No recent decision recorded.',
    key_indicators: {},
  }));
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
): Promise<{ decision: AgentDecision; newState: Record<string, number>; parallel: HistoricalParallel | null }> {
  const state = await fetchState(worldId, countryCode, env);
  if (!state) throw new Error(`No state found for ${countryCode} in world ${worldId}`);

  const history = getHistory(countryCode);

  // Fetch neighbor context (best-effort)
  const neighbors: NeighborSummary[] = history
    ? await fetchNeighborContext(worldId, history.key_relationships, state.year, env).catch(() => [])
    : [];

  // ── Milestone 4: find closest historical parallel via TF-IDF cosine match ──
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
    parallel
  );

  const raw = await chat(messages, env.GROQ_API_KEY, { temperature: 0.6, maxTokens: 1024 });

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const decision: AgentDecision = JSON.parse(cleaned);

  const newIndicators = applyDeltas(state.indicators, decision);

  return { decision, newState: newIndicators, parallel };
}
