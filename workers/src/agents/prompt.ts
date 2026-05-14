import type { Message } from '../ai/llm.js';
import type { IncomingEvent } from './events.js';

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
  /** Most recent decision reasoning */
  recent_decision: string;
  /** Up to 2 prior decision summaries (oldest first) */
  previous_decisions: string[];
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

export interface RegionalPolicySummary {
  region_name: string;
  region_code: string;
  housing:     number;
  transport:   number;
  local_tax:   number;
}

export function buildMessages(
  state: CountryStateRow,
  history: CountryHistory,
  neighbors: NeighborSummary[],
  parallel: HistoricalParallel | null,
  incomingEvents: IncomingEvent[] = [],
  regionalPolicies: RegionalPolicySummary[] = []
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
3. React to what neighboring and allied countries are doing, including any sanctions, deals, or protests directed at you.
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
  },
  "events": [
    { "type": "<sanction|trade_deal|military_posture|diplomatic_protest|alliance_formed|alliance_broken>", "target": "<ISO3 or omit for global>", "details": "<one sentence>" }
  ],
  "relations_update": { "<ISO3>": "<ally|neutral|rival|enemy>" }
}

Notes on new fields:
- "events": emit 0–3 inter-country events that naturally follow from your decision. Omit if nothing significant.
- "relations_update": include only countries whose relationship status actually changes. Omit if unchanged.

Constraints:
- All deltas represent changes from the current value, not absolute targets.
- Keep individual deltas small and realistic (monthly scale): typically ±0.0–0.3 percentage points.
- gdp_growth_pct should reflect realistic country-level projections (developing: 3–8%, developed: 0.5–3%).
- If the country is at war, in crisis, or under sanctions, reflect this in projections.`,
  };

  // Neighbor block — includes last 3 decisions and current indicators per neighbor
  const neighborBlock = neighbors.length
    ? neighbors.map(n => {
        const indStr = Object.entries(n.key_indicators)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'number' ? v.toFixed(1) : v}`)
          .join(', ');
        const prior = n.previous_decisions
          .map((d, i) => `    Prior-${i + 2}: ${d}`)
          .join('\n');
        return [
          `  ${n.country_name} (${n.country_code}):`,
          `    Latest: ${n.recent_decision}`,
          prior,
          indStr ? `    Indicators: ${indStr}` : '',
        ].filter(Boolean).join('\n');
      }).join('\n\n')
    : '  No significant neighbor decisions this period.';

  // Incoming events block — things other countries did TO this country
  const eventsBlock = incomingEvents.length
    ? incomingEvents
        .map(e => `  [yr ${e.sim_year}] ${e.from_country} → ${e.event_type.replace(/_/g, ' ')}: ${e.details}`)
        .join('\n')
    : '  No incoming diplomatic or trade events this period.';

  // Current relations
  const relationsStr = Object.entries(state.relations ?? {})
    .map(([k, v]) => `${k}:${v}`)
    .join(', ') || 'none on record';

  const parallelBlock = parallel
    ? `CLOSEST HISTORICAL PARALLEL: "${parallel.name}" (similarity: ${(parallel.similarity_score * 100).toFixed(0)}%)
Summary: ${parallel.summary}
Historical outcomes: ${parallel.outcomes}
Today's world is different — reason through: nuclear deterrence, international institutions (UN/WTO/EU/ICC), economic interdependence, social media, and this country's current diplomatic relations. The outcome may be similar, harsher, milder, or entirely different.`
    : 'No close historical parallel identified this period.';

  // Regional policy block — player sub-national overrides
  const regionalBlock = regionalPolicies.length
    ? regionalPolicies.map(r =>
        `  ${r.region_name} (${r.region_code}): housing=${r.housing}/10, transit=${r.transport}/10, local_tax=${r.local_tax}%`
      ).join('\n')
    : '  No active sub-national policy overrides.';

  const user: Message = {
    role: 'user',
    content: `SIMULATED YEAR: ${state.year}
COUNTRY: ${history.country} (${history.iso3})

CURRENT INDICATORS:
${fmtIndicators(state.indicators)}

CURRENT DIPLOMATIC RELATIONS:
  ${relationsStr}

RECENT HISTORY (last 10 years of record):
${recentHistory(history.events)}

NEIGHBORING / KEY PARTNER DECISIONS (last 3 periods):
${neighborBlock}

INCOMING DIPLOMATIC / TRADE EVENTS (directed at ${history.iso3}):
${eventsBlock}

ACTIVE REGIONAL POLICIES (sub-national player overrides):
${regionalBlock}

${parallelBlock}

AGENT MEMORY (prior reasoning):
${state.agent_memory_summary ?? 'No prior memory — this is the first simulation step.'}

Based on all of the above, what policy adjustments does your government make this month? Respond with the JSON object only.`,
  };

  return [system, user];
}
