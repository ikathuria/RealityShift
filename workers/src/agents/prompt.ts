import type { Message } from '../ai/llm.js';

export interface CountryHistory {
  country: string;
  iso3: string;
  political_leaning: string;
  current_government: string;
  key_relationships: string[];
  events: { year: number; event: string; tags: string[] }[];
}

export interface CountryStateRow {
  world_id: string;
  country_code: string;
  year: number;
  indicators: Record<string, number>;
  policies: Record<string, unknown>;
  relations: Record<string, string>;
  agent_memory_summary: string | null;
}

export interface NeighborSummary {
  country_code: string;
  country_name: string;
  recent_decision: string;
  key_indicators: Record<string, number>;
}

export interface HistoricalParallel {
  period_id: string;
  name: string;
  summary: string;
  outcomes: string;
  similarity_score: number;
}

// Format indicator values for display in the prompt
function fmtIndicators(ind: Record<string, number>): string {
  const labels: Record<string, string> = {
    gdp_per_capita:   'GDP/capita',
    population:       'Population',
    tax_rate:         'Tax revenue (% GDP)',
    military_spend:   'Military spend (% GDP)',
    education_spend:  'Education spend (% GDP)',
    healthcare_spend: 'Healthcare spend (% GDP)',
    unemployment:     'Unemployment (%)',
  };
  return Object.entries(labels)
    .map(([k, label]) => {
      const val = ind[k];
      if (val === undefined) return null;
      if (k === 'gdp_per_capita') return `  ${label}: $${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
      if (k === 'population') return `  ${label}: ${(val / 1_000_000).toFixed(1)}M`;
      return `  ${label}: ${val.toFixed(2)}%`;
    })
    .filter(Boolean)
    .join('\n');
}

// Trim history to most recent N events to stay within token budget
function recentHistory(events: CountryHistory['events'], n = 10): string {
  return events
    .slice(-n)
    .map(e => `  [${e.year}] ${e.event}`)
    .join('\n');
}

export function buildMessages(
  state: CountryStateRow,
  history: CountryHistory,
  neighbors: NeighborSummary[],
  parallel: HistoricalParallel | null
): Message[] {
  const system: Message = {
    role: 'system',
    content: `You are the AI policy advisor to the government of ${history.country} (${history.iso3}).
You simulate the strategic thinking of the current government.

GOVERNMENT: ${history.current_government}
POLITICAL LEANING: ${history.political_leaning}

Your role is to decide the policy adjustments your government will make over the next simulated month.
You must:
1. Stay in character — your decisions reflect the actual political leaning and priorities of the real government.
2. Ground decisions in your country's documented history (provided below).
3. React to what neighboring and allied countries are doing.
4. Explicitly flag if your current trajectory resembles a historical pattern.
5. Return ONLY valid JSON — no prose outside the JSON object.

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "policies_adjusted": {
    "tax_rate_delta": <float, percentage point change>,
    "military_spend_delta": <float, percentage point of GDP change>,
    "education_spend_delta": <float, percentage point of GDP change>,
    "healthcare_spend_delta": <float, percentage point of GDP change>,
    "trade_openness_delta": <float, -1 to +1 scale change>
  },
  "reasoning": "<2-4 sentences explaining the decision in character>",
  "historical_parallel": "<name of historical parallel if applicable, or null>",
  "projected_indicators": {
    "gdp_growth_pct": <expected annual GDP growth rate as decimal, e.g. 0.06 for 6%>,
    "unemployment_delta": <expected change in unemployment percentage points>,
    "inflation_est": <estimated annual inflation rate as decimal>
  }
}

Constraints:
- All deltas represent changes from the current value, not absolute targets.
- Keep individual deltas small and realistic (monthly scale): typically ±0.0–0.3 percentage points.
- gdp_growth_pct should reflect realistic country-level projections (developing: 3–8%, developed: 0.5–3%).
- If the country is at war, in crisis, or under sanctions, reflect this in projections.`,
  };

  const neighborBlock = neighbors.length
    ? neighbors
        .map(n => `  ${n.country_name} (${n.country_code}): ${n.recent_decision}`)
        .join('\n')
    : '  No significant neighbor decisions this period.';

  const parallelBlock = parallel
    ? `CLOSEST HISTORICAL PARALLEL: "${parallel.name}" (similarity: ${(parallel.similarity_score * 100).toFixed(0)}%)
Summary: ${parallel.summary}
Historical outcomes: ${parallel.outcomes}
Today's world is different — reason through: nuclear deterrence, international institutions (UN/WTO/EU/ICC), economic interdependence, social media, and this country's current diplomatic relations. The outcome may be similar, harsher, milder, or entirely different.`
    : 'No close historical parallel identified this period.';

  const user: Message = {
    role: 'user',
    content: `SIMULATED YEAR: ${state.year}
COUNTRY: ${history.country} (${history.iso3})

CURRENT INDICATORS:
${fmtIndicators(state.indicators)}

RECENT HISTORY (last 10 years of record):
${recentHistory(history.events)}

NEIGHBORING / KEY PARTNER DECISIONS THIS PERIOD:
${neighborBlock}

${parallelBlock}

AGENT MEMORY (prior reasoning):
${state.agent_memory_summary ?? 'No prior memory — this is the first simulation step.'}

Based on all of the above, what policy adjustments does your government make this month? Respond with the JSON object only.`,
  };

  return [system, user];
}
