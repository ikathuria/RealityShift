/**
 * events.ts — inter-agent event system
 *
 * Agents emit events (sanctions, trade deals, military posturing, etc.) as part
 * of their decision JSON. This module writes those to the `world_events` table
 * and runs conflict detection after each agent step.
 *
 * Subrequest budget (Cloudflare free plan: 50 per invocation): writeEvents is
 * at most 1 request; detectConflicts at most 3 (enemy states — 0 when a state
 * snapshot is passed in —, one existing-risk lookup, one batch insert).
 * DB errors throw DbError so the caller can report success:false.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DbError, STATE_COLUMNS, type StateRow } from '../lib/db.js';
import { isIso3, sanitizeRelations } from '../lib/sanitize.js';
import type { AgentEvent, AgentEventType } from './decision.js';

export type EventType = AgentEventType;
export type { AgentEvent };

/** Military spend (% of GDP) above which a mutually hostile pair is flagged. */
export const CONFLICT_MILITARY_THRESHOLD = 3;

/**
 * Write agent-emitted events to world_events. Events must already be validated
 * (see decision.ts); this only drops empty ones.
 */
export async function writeEvents(
  db: SupabaseClient,
  worldId: string,
  fromCountry: string,
  simYear: number,
  events: AgentEvent[],
): Promise<void> {
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
  if (!rows.length) return;
  const { error } = await db.from('world_events').insert(rows);
  if (error) throw new DbError('insert world_events', error.message);
}

/**
 * After an agent step, check if this country and any of its listed enemies both
 * have elevated military spend. If so, emit a conflict_risk event (deduplicated
 * so we don't spam — only once per (worldId, pair, simYear)).
 *
 * `snapshot` (optional) supplies other countries' states without a query.
 * Returns the number of conflict_risk events written.
 */
export async function detectConflicts(
  db: SupabaseClient,
  worldId: string,
  countryCode: string,
  relations: Record<string, string>,
  indicators: Record<string, number>,
  simYear: number,
  snapshot?: Map<string, StateRow>,
): Promise<number> {
  if (!isIso3(countryCode)) return 0;
  const militarySpend = indicators.military_spend ?? 0;
  if (!(militarySpend >= CONFLICT_MILITARY_THRESHOLD)) return 0;

  // Keys are validated as ISO3 before they go anywhere near a PostgREST filter.
  const enemies = Object.entries(sanitizeRelations(relations, countryCode))
    .filter(([, rel]) => rel === 'enemy')
    .map(([code]) => code)
    .slice(0, 20);
  if (!enemies.length) return 0;

  // Enemy states: from the snapshot when we have one, else one query.
  const enemyStates = new Map<string, Pick<StateRow, 'relations' | 'indicators'>>();
  const missing = enemies.filter(e => !snapshot?.has(e));
  for (const e of enemies) {
    const s = snapshot?.get(e);
    if (s) enemyStates.set(e, s);
  }
  if (missing.length) {
    const { data, error } = await db
      .from('latest_country_states')
      .select(STATE_COLUMNS)
      .eq('world_id', worldId)
      .in('country_code', missing);
    if (error) throw new DbError('read enemy states', error.message);
    for (const row of (data ?? []) as StateRow[]) enemyStates.set(row.country_code, row);
  }

  const hostile = enemies.filter(enemy => {
    const s = enemyStates.get(enemy);
    if (!s) return false;
    const enemyRel = (s.relations ?? {}) as Record<string, string>;
    const enemyMil = Number((s.indicators ?? {}).military_spend ?? 0);
    return enemyRel[countryCode] === 'enemy' && enemyMil >= CONFLICT_MILITARY_THRESHOLD;
  });
  if (!hostile.length) return 0;

  // Existing conflict_risk events this year involving this country (either direction).
  const { data: existing, error: existingErr } = await db
    .from('world_events')
    .select('from_country, to_country')
    .eq('world_id', worldId)
    .eq('event_type', 'conflict_risk')
    .eq('sim_year', simYear)
    .or(`from_country.eq.${countryCode},to_country.eq.${countryCode}`);
  if (existingErr) throw new DbError('read conflict_risk events', existingErr.message);

  const pairKey = (a: string, b: string) => [a, b].sort().join('-');
  const seen = new Set(
    ((existing ?? []) as { from_country: string; to_country: string | null }[])
      .filter(r => r.to_country)
      .map(r => pairKey(r.from_country, r.to_country as string)),
  );

  const rows = hostile
    .filter(enemy => !seen.has(pairKey(countryCode, enemy)))
    .map(enemy => ({
      world_id: worldId,
      from_country: countryCode,
      to_country: enemy,
      event_type: 'conflict_risk',
      details:
        `${countryCode}–${enemy}: mutual hostile relations with military spending above ` +
        `${CONFLICT_MILITARY_THRESHOLD}% GDP on both sides. Elevated conflict risk. (${pairKey(countryCode, enemy)})`,
      sim_year: simYear,
    }));
  if (!rows.length) return 0;

  const { error } = await db.from('world_events').insert(rows);
  if (error) throw new DbError('insert conflict_risk events', error.message);
  return rows.length;
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
  db: SupabaseClient,
  worldId: string,
  countryCode: string,
  currentYear: number,
): Promise<IncomingEvent[]> {
  const { data, error } = await db
    .from('world_events')
    .select('from_country, event_type, details, sim_year')
    .eq('world_id', worldId)
    .eq('to_country', countryCode)
    .gte('sim_year', currentYear - 2)
    .lte('sim_year', currentYear)
    .order('sim_year', { ascending: false })
    .order('id', { ascending: false })
    .limit(6);
  if (error) throw new DbError('read incoming events', error.message);
  return (data ?? []) as IncomingEvent[];
}
