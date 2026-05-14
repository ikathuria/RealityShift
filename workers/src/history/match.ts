// Historical parallel matching.
// Given a country's current indicator state, returns the top N closest
// historical periods by cosine similarity against TF-IDF vectors.
//
// Example: a country with military_spend > 5%, falling press_freedom, and
// rising nationalist rhetoric will surface 1930s Germany as a top match.

import { periods, buildQueryVector, periodVectors } from './embed.js';
import type { Period } from './embed.js';

export interface MatchResult {
  period: Period;
  similarity: number;
}

// ────────────────────────────────────────────────────────────
// Indicator → semantic tag mapping
// ────────────────────────────────────────────────────────────

export interface CountryStateForMatch {
  indicators: Record<string, number>;
  policies: Record<string, unknown>;
}

function indicatorsToTags(state: CountryStateForMatch): {
  tags: string[];
  profileKeys: Record<string, number>;
} {
  const tags: string[] = [];
  const profileKeys: Record<string, number> = {};

  const ind = state.indicators;
  const pol = state.policies as Record<string, number | string | undefined>;

  // ─── Economic condition tags ───────────────────────────────
  if (ind.gdp_per_capita !== undefined) {
    if (ind.gdp_per_capita < 1000)       tags.push('extreme_poverty', 'low_income');
    else if (ind.gdp_per_capita < 5000)  tags.push('low_income');
    else if (ind.gdp_per_capita > 40000) tags.push('high_income', 'developed_economy');
  }

  if (ind.unemployment !== undefined) {
    if (ind.unemployment > 25)      { tags.push('extreme_unemployment', 'mass_unemployment'); profileKeys.unemployment = 4; }
    else if (ind.unemployment > 15) { tags.push('high_unemployment');  profileKeys.unemployment = 3; }
    else if (ind.unemployment > 10) { tags.push('elevated_unemployment'); profileKeys.unemployment = 2; }
    else if (ind.unemployment < 3)  { tags.push('full_employment'); profileKeys.full_employment = 2; }
  }

  // ─── Military / security ───────────────────────────────────
  if (ind.military_spend !== undefined) {
    if (ind.military_spend > 6)     { tags.push('militarism', 'high_military_spend', 'rearmament'); profileKeys.military_spend = 4; }
    else if (ind.military_spend > 4){ tags.push('high_military_spend', 'military_expansion'); profileKeys.military_spend = 3; }
    else if (ind.military_spend > 2){ tags.push('military_spend'); profileKeys.military_spend = 2; }
    else if (ind.military_spend < 1){ tags.push('low_military_spend', 'demilitarised'); profileKeys.military_spend = 0; }
  }

  // ─── Fiscal / monetary ────────────────────────────────────
  if (ind.tax_rate !== undefined) {
    if (ind.tax_rate < 10)          { tags.push('low_taxation', 'fiscal_limits'); profileKeys.fiscal_deficit = 2; }
    else if (ind.tax_rate > 35)     { tags.push('high_taxation'); profileKeys.tax_rate = 3; }
  }

  // ─── Social spending ──────────────────────────────────────
  if (ind.education_spend !== undefined) {
    if (ind.education_spend > 6)    { tags.push('high_education_spend', 'education_investment'); profileKeys.education_spend = 3; }
    else if (ind.education_spend < 2){ tags.push('low_education_spend'); }
  }

  if (ind.healthcare_spend !== undefined) {
    if (ind.healthcare_spend > 8)   { tags.push('universal_healthcare', 'high_healthcare_spend'); profileKeys.social_spending = 3; }
    else if (ind.healthcare_spend < 3){ tags.push('low_healthcare_spend'); }
  }

  // ─── Policy signals from policies{} ──────────────────────
  if (typeof pol.trade_openness_delta === 'number') {
    if (pol.trade_openness_delta < -0.3) { tags.push('autarky', 'trade_protectionism'); profileKeys.trade_openness = 1; }
    if (pol.trade_openness_delta > 0.3)  { tags.push('trade_liberalisation', 'trade_openness'); profileKeys.trade_openness = 3; }
  }

  // ─── Tags passed directly from prior agent reasoning ─────
  // The policies object can carry string tags set by prior agents
  if (Array.isArray(pol.active_tags)) {
    for (const t of pol.active_tags as string[]) tags.push(t);
  }

  return { tags, profileKeys };
}

// ────────────────────────────────────────────────────────────
// Cosine similarity between two unit vectors
// ────────────────────────────────────────────────────────────
function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both vectors are already unit-normalised in embed.ts
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Find the top-N historical periods most similar to the current country state.
 * Returns at most N results sorted by similarity descending.
 */
export function findParallels(
  state: CountryStateForMatch,
  n = 3,
  minSimilarity = 0.05
): MatchResult[] {
  const { tags, profileKeys } = indicatorsToTags(state);
  if (tags.length === 0 && Object.keys(profileKeys).length === 0) return [];

  const query = buildQueryVector(tags, profileKeys);

  const scored: MatchResult[] = periods.map((period, i) => ({
    period,
    similarity: cosineSim(query, periodVectors[i]),
  }));

  return scored
    .filter(r => r.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, n);
}

/**
 * Convenience: return only the top match, or null if no meaningful match found.
 */
export function topParallel(state: CountryStateForMatch): MatchResult | null {
  const results = findParallels(state, 1);
  return results[0] ?? null;
}
