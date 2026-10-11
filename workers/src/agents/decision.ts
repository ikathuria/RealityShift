// Validation of an agent's LLM decision, and applying it to a country's state.
//
// One agent step = one simulated YEAR. Everything here is annual-scale: deltas
// are clamped to plausible one-year moves and gdp_growth_pct is an annual rate
// applied exactly once per step.

import {
  type Relation,
  clamp,
  cleanText,
  finiteNumber,
  isIso3,
  isRelation,
} from '../lib/sanitize.js';

export const AGENT_EVENT_TYPES = [
  'sanction',
  'trade_deal',
  'military_posture',
  'diplomatic_protest',
  'alliance_formed',
  'alliance_broken',
] as const;
export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number] | 'conflict_risk';

export interface AgentEvent {
  type: AgentEventType;
  target?: string;
  details: string;
}

export interface PolicyDeltas {
  tax_rate_delta?: number;
  military_spend_delta?: number;
  education_spend_delta?: number;
  healthcare_spend_delta?: number;
  trade_openness_delta?: number;
}

export interface ProjectedIndicators {
  /** Annual real GDP growth in PERCENT (2.5 = 2.5%). */
  gdp_growth_pct?: number;
  /** Change in the unemployment rate over the year, percentage points. */
  unemployment_delta?: number;
  /** Annual inflation in PERCENT. */
  inflation_est?: number;
}

export interface AgentDecision {
  policies_adjusted: PolicyDeltas;
  reasoning: string;
  historical_parallel: string | null;
  projected_indicators: ProjectedIndicators;
  events: AgentEvent[];
  relations_update: Record<string, Relation>;
}

/** Plausible one-year bounds for each delta (percentage points unless noted). */
export const DELTA_LIMITS: Record<keyof PolicyDeltas, number> = {
  tax_rate_delta: 3, // tax revenue, pp of GDP
  military_spend_delta: 1.5, // pp of GDP
  education_spend_delta: 1, // pp of GDP
  healthcare_spend_delta: 1, // pp of GDP
  trade_openness_delta: 1, // points on the 0-10 trade-openness index
};

export const GDP_GROWTH_LIMIT = 15; // ±15% a year
export const UNEMPLOYMENT_DELTA_LIMIT = 5; // ±5 pp a year
export const INFLATION_RANGE: [number, number] = [-20, 100];

/** Indicator levels (all "% of GDP" or "% of labour force") stay within [0, 100]. */
const PERCENT_LEVELS: Record<string, keyof PolicyDeltas> = {
  tax_rate: 'tax_rate_delta',
  military_spend: 'military_spend_delta',
  education_spend: 'education_spend_delta',
  healthcare_spend: 'healthcare_spend_delta',
};
/** trade_openness is a 0-10 index (see src/components/PolicyEditor.tsx). */
export const TRADE_OPENNESS_RANGE: [number, number] = [0, 10];
export const TRADE_OPENNESS_DEFAULT = 5;

const MAX_EVENTS = 3;
const MAX_RELATION_UPDATES = 10;

export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionError';
  }
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Parse the raw LLM text into a JSON object. Tolerates markdown fences and
 * prose around the object; throws DecisionError when there is no JSON object.
 */
export function parseDecisionJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const candidates = [cleaned];
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(cleaned.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const v = JSON.parse(c) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // try the next candidate
    }
  }
  throw new DecisionError('LLM output is not a JSON object');
}

/**
 * Normalise percent-vs-fraction for the growth/inflation projections.
 *
 * The prompt asks for PERCENT (2.5 = 2.5%), but the previous prompt asked for
 * fractions (0.025) and models slip back to it. A fraction can't be told apart
 * from a tiny percent by one number alone (0.1 could be 0.1% or 10%), so we use
 * inflation as the signal: a non-zero inflation estimate under 0.2 in magnitude
 * is essentially never a real percent figure, so it marks the whole block as
 * fractions, and both values are then scaled by 100. Without that signal small
 * values are kept as percent — the conservative reading, since mis-reading 0.1%
 * as 10% would be far worse than the reverse.
 */
export function normalizeProjections(raw: unknown): ProjectedIndicators {
  const o = asObject(raw);
  let gdp = finiteNumber(o.gdp_growth_pct);
  let inflation = finiteNumber(o.inflation_est);
  const unemployment = finiteNumber(o.unemployment_delta);

  const fractionMode = inflation !== undefined && inflation !== 0 && Math.abs(inflation) < 0.2;
  if (fractionMode) {
    inflation = (inflation as number) * 100;
    if (gdp !== undefined && Math.abs(gdp) < 1) gdp *= 100;
  }

  const out: ProjectedIndicators = {};
  if (gdp !== undefined) out.gdp_growth_pct = clamp(gdp, -GDP_GROWTH_LIMIT, GDP_GROWTH_LIMIT);
  if (unemployment !== undefined) {
    out.unemployment_delta = clamp(unemployment, -UNEMPLOYMENT_DELTA_LIMIT, UNEMPLOYMENT_DELTA_LIMIT);
  }
  if (inflation !== undefined) out.inflation_est = clamp(inflation, INFLATION_RANGE[0], INFLATION_RANGE[1]);
  return out;
}

export function normalizeDeltas(raw: unknown): PolicyDeltas {
  const o = asObject(raw);
  const out: PolicyDeltas = {};
  for (const [key, limit] of Object.entries(DELTA_LIMITS) as [keyof PolicyDeltas, number][]) {
    const n = finiteNumber(o[key]);
    if (n !== undefined) out[key] = clamp(n, -limit, limit);
  }
  return out;
}

/** Validate and clamp a parsed decision. `self` is the deciding country's ISO3. */
export function normalizeDecision(raw: Record<string, unknown>, self: string): AgentDecision {
  const events: AgentEvent[] = [];
  if (Array.isArray(raw.events)) {
    for (const e of raw.events) {
      if (events.length >= MAX_EVENTS) break;
      const ev = asObject(e);
      const type = typeof ev.type === 'string' ? ev.type.trim().toLowerCase() : '';
      if (!(AGENT_EVENT_TYPES as readonly string[]).includes(type)) continue;
      const details = cleanText(ev.details, 500, { singleLine: true });
      if (!details) continue;
      const target = typeof ev.target === 'string' ? ev.target.trim().toUpperCase() : '';
      events.push({
        type: type as AgentEventType,
        ...(isIso3(target) && target !== self ? { target } : {}),
        details,
      });
    }
  }

  const relations_update: Record<string, Relation> = {};
  let nRel = 0;
  for (const [k, v] of Object.entries(asObject(raw.relations_update))) {
    if (nRel >= MAX_RELATION_UPDATES) break;
    const key = k.trim().toUpperCase();
    const val = typeof v === 'string' ? v.trim().toLowerCase() : v;
    if (!isIso3(key) || key === self || !isRelation(val)) continue;
    relations_update[key] = val;
    nRel++;
  }

  const parallel = cleanText(raw.historical_parallel, 200, { singleLine: true });

  return {
    policies_adjusted: normalizeDeltas(raw.policies_adjusted),
    reasoning: cleanText(raw.reasoning, 1500) || 'No reasoning given.',
    historical_parallel: parallel && parallel.toLowerCase() !== 'null' ? parallel : null,
    projected_indicators: normalizeProjections(raw.projected_indicators),
    events,
    relations_update,
  };
}

/** Parse + validate in one step. Throws DecisionError on unusable output. */
export function parseDecision(raw: string, self: string): AgentDecision {
  return normalizeDecision(parseDecisionJson(raw), self);
}

/**
 * Apply one year's decision to a country's indicators and policies.
 *
 * Policies are MERGED: existing levels (including ones the player set) are
 * kept, and trade_openness_delta moves the trade_openness level. The deltas
 * themselves are never written over the policy levels.
 */
export function applyDecision(
  indicators: Record<string, number>,
  policies: Record<string, unknown>,
  decision: Pick<AgentDecision, 'policies_adjusted' | 'projected_indicators'>,
): { indicators: Record<string, number>; policies: Record<string, unknown> } {
  const ind = { ...indicators };
  const p = decision.policies_adjusted;
  const proj = decision.projected_indicators;

  for (const [level, deltaKey] of Object.entries(PERCENT_LEVELS)) {
    const d = p[deltaKey];
    if (d === undefined || d === 0) continue;
    const current = finiteNumber(ind[level]) ?? 0;
    ind[level] = clamp(current + d, 0, 100);
  }

  if (proj.gdp_growth_pct !== undefined) {
    const gdp = finiteNumber(ind.gdp_per_capita);
    if (gdp !== undefined && gdp > 0) ind.gdp_per_capita = gdp * (1 + proj.gdp_growth_pct / 100);
  }
  if (proj.unemployment_delta !== undefined) {
    const current = finiteNumber(ind.unemployment) ?? 0;
    ind.unemployment = clamp(current + proj.unemployment_delta, 0, 100);
  }

  const pol: Record<string, unknown> = { ...policies };
  if (p.trade_openness_delta !== undefined && p.trade_openness_delta !== 0) {
    const current = finiteNumber(pol.trade_openness) ?? TRADE_OPENNESS_DEFAULT;
    pol.trade_openness = clamp(current + p.trade_openness_delta, TRADE_OPENNESS_RANGE[0], TRADE_OPENNESS_RANGE[1]);
  }
  // Older runs overwrote policies with the raw deltas; drop those stale keys.
  for (const k of Object.keys(DELTA_LIMITS)) delete pol[k];

  return { indicators: ind, policies: pol };
}
