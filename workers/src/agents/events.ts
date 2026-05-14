/**
 * events.ts — inter-agent event system
 *
 * Agents emit events (sanctions, trade deals, military posturing, etc.) as part
 * of their decision JSON. This module writes those to the `world_events` table
 * and runs conflict detection after each agent step.
 */

import { getSupabase } from '../lib/supabase.js';
import type { Env } from '../index.js';

export type EventType =
  | 'sanction'
  | 'trade_deal'
  | 'military_posture'
  | 'diplomatic_protest'
  | 'alliance_formed'
  | 'alliance_broken'
  | 'conflict_risk';

export interface AgentEvent {
  type: EventType | string;
  target?: string;   // ISO3 of the target country, optional
  details: string;
}

/**
 * Write agent-emitted events to world_events.
 */
export async function writeEvents(
  worldId: string,
  fromCountry: string,
  simYear: number,
  events: AgentEvent[],
  env: Env
): Promise<void> {
  if (!events.length) return;
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const rows = events
    .filter(e => e.details && e.type)
    .map(e => ({
      world_id: worldId,
      from_country: fromCountry,
      to_country: e.target ?? null,
      event_type: e.type,
      details: e.details.slice(0, 500),
      sim_year: simYear,
    }));

  if (rows.length) await db.from('world_events').insert(rows);
}

/**
 * After an agent step, check if this country and any of its listed enemies both
 * have elevated military spend. If so, emit a conflict_risk event (deduplicated
 * so we don't spam — only once per (worldId, pair, simYear)).
 */
export async function detectConflicts(
  worldId: string,
  countryCode: string,
  relations: Record<string, string>,
  indicators: Record<string, number>,
  simYear: number,
  env: Env
): Promise<void> {
  const militarySpend = indicators.military_spend ?? 0;
  if (militarySpend < 3) return;   // below conflict threshold

  const enemies = Object.entries(relations)
    .filter(([, rel]) => rel === 'enemy')
    .map(([code]) => code);
  if (!enemies.length) return;

  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  for (const enemy of enemies) {
    // Fetch enemy's latest state
    const { data: enemyRow } = await db
      .from('country_states')
      .select('relations, indicators')
      .eq('world_id', worldId)
      .eq('country_code', enemy)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (!enemyRow) continue;
    const enemyRel = (enemyRow as { relations: Record<string, string> }).relations ?? {};
    const enemyInd = (enemyRow as { indicators: Record<string, number> }).indicators ?? {};

    // Mutual hostility + both armed
    if (enemyRel[countryCode] !== 'enemy') continue;
    if ((enemyInd.military_spend ?? 0) < 3) continue;

    // Avoid duplicate conflict_risk events this year for this pair
    const pairKey = [countryCode, enemy].sort().join('-');
    const { count } = await db
      .from('world_events')
      .select('id', { count: 'exact', head: true })
      .eq('world_id', worldId)
      .eq('event_type', 'conflict_risk')
      .eq('sim_year', simYear)
      .or(`and(from_country.eq.${countryCode},to_country.eq.${enemy}),and(from_country.eq.${enemy},to_country.eq.${countryCode})`);

    if ((count ?? 0) > 0) continue;

    await db.from('world_events').insert({
      world_id: worldId,
      from_country: countryCode,
      to_country: enemy,
      event_type: 'conflict_risk',
      details: `${countryCode}–${enemy}: mutual hostile relations with military spending above 3% GDP on both sides. Elevated conflict risk. (${pairKey})`,
      sim_year: simYear,
    });
  }
}

/**
 * Fetch recent events that targeted a specific country — fed into that
 * country's next agent prompt so it can react diplomatically.
 */
export interface IncomingEvent {
  from_country: string;
  event_type: string;
  details: string;
  sim_year: number;
}

export async function fetchIncomingEvents(
  worldId: string,
  countryCode: string,
  currentYear: number,
  env: Env
): Promise<IncomingEvent[]> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data } = await db
    .from('world_events')
    .select('from_country, event_type, details, sim_year')
    .eq('world_id', worldId)
    .eq('to_country', countryCode)
    .gte('sim_year', currentYear - 2)
    .order('sim_year', { ascending: false })
    .limit(6);

  return (data ?? []) as IncomingEvent[];
}
