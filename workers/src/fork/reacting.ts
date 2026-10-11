// Which countries react in a fork's simulate-year step. Pure and deterministic:
// every batch of the same step recomputes the same list from the fork's state
// AS OF the year being simulated, so a cursor into it is stable across calls.

import { finiteNumber, isIso3, sanitizeRelations } from '../lib/sanitize.js';

/** Countries with curated history — eligible for full agent simulation. */
export const CURATED_COUNTRIES = [
  'USA', 'CHN', 'RUS', 'IND', 'GBR', 'DEU', 'FRA', 'JPN',
  'BRA', 'AUS', 'CAN', 'KOR', 'MEX', 'IDN', 'TUR', 'SAU', 'ZAF', 'NGA', 'PAK', 'UKR',
] as const;

export const MAX_REACTING = 12;
export const BATCH_SIZE = 3;

export interface ReactingState {
  country_code: string;
  indicators: Record<string, unknown>;
  relations: Record<string, unknown>;
}

export interface EventLink {
  from_country: string;
  to_country: string | null;
}

/** Total GDP (per-capita x population), falling back to per-capita alone. */
function gdp(s: ReactingState | undefined): number {
  if (!s) return 0;
  const pc = finiteNumber(s.indicators?.gdp_per_capita) ?? 0;
  const pop = finiteNumber(s.indicators?.population);
  return pop !== undefined ? pc * pop : pc;
}

/**
 * The reacting set for one simulate-year step:
 *   1. curated countries with a non-neutral relation with the player (either
 *      side's relations map),
 *   2. curated countries that sent events to or received events from the
 *      player in the last 2 sim years (`events` should already be restricted
 *      to sim_year in [year-2, year-1]),
 *   3. the largest remaining curated economies, to fill up to MAX_REACTING.
 * Within tiers 1 and 2 countries are ordered by GDP (desc) then code, so the
 * cap keeps the most significant ones. The player is always excluded, as are
 * countries with no state in the fork.
 */
export function computeReactingSet(
  playerCode: string,
  states: Map<string, ReactingState>,
  events: EventLink[],
  curated: readonly string[] = CURATED_COUNTRIES,
  max = MAX_REACTING,
): string[] {
  const candidates = curated.filter(c => c !== playerCode && states.has(c));
  const byGdp = (a: string, b: string) => gdp(states.get(b)) - gdp(states.get(a)) || (a < b ? -1 : a > b ? 1 : 0);

  const player = states.get(playerCode);
  const playerRel = sanitizeRelations(player?.relations, playerCode);
  const tier1 = candidates
    .filter(c => {
      const mine = playerRel[c];
      const theirs = sanitizeRelations(states.get(c)?.relations, c)[playerCode];
      return (mine && mine !== 'neutral') || (theirs && theirs !== 'neutral');
    })
    .sort(byGdp);

  const counterparts = new Set<string>();
  for (const e of events) {
    if (e.from_country === playerCode && e.to_country && isIso3(e.to_country)) counterparts.add(e.to_country);
    if (e.to_country === playerCode && isIso3(e.from_country)) counterparts.add(e.from_country);
  }
  const tier2 = candidates.filter(c => counterparts.has(c)).sort(byGdp);
  const tier3 = [...candidates].sort(byGdp);

  const out: string[] = [];
  for (const c of [...tier1, ...tier2, ...tier3]) {
    if (out.length >= max) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** The cursor after this batch, or null when the step is complete. */
export function nextCursor(cursor: number, total: number, batch = BATCH_SIZE): number | null {
  return cursor + batch < total ? cursor + batch : null;
}
