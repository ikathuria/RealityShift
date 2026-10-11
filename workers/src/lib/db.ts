// Supabase read helpers that are safe against PostgREST's row cap (1000 rows
// per response by default): `selectAll` pages with .range() until a short page.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CountryStateRow } from '../agents/prompt.js';

interface RangeResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

/** Anything with PostgREST's .range(); the query must have a stable ORDER BY. */
interface Rangeable {
  range(from: number, to: number): PromiseLike<RangeResult>;
}

export class DbError extends Error {
  constructor(public readonly op: string, message: string) {
    super(`${op}: ${message}`);
    this.name = 'DbError';
  }
}

/**
 * Read every row of a query, `pageSize` at a time. `build` must return a fresh
 * query builder on each call (builders are single-use) with a deterministic
 * order, or pages can overlap or skip rows. Throws DbError on any page error.
 */
export async function selectAll<T>(
  op: string,
  build: () => Rangeable,
  pageSize = 1000,
  maxPages = 50,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw new DbError(op, error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
  throw new DbError(op, `more than ${maxPages * pageSize} rows`);
}

export const STATE_COLUMNS =
  'world_id, country_code, year, indicators, policies, relations, agent_memory_summary, last_updated';

export type StateRow = CountryStateRow & { last_updated?: string };

/** Current (latest-year) state of every country in a world, via the latest_country_states view. */
export async function loadLatestStates(db: SupabaseClient, worldId: string): Promise<StateRow[]> {
  return selectAll<StateRow>('read latest_country_states', () =>
    db
      .from('latest_country_states')
      .select(STATE_COLUMNS)
      .eq('world_id', worldId)
      .order('country_code'),
  );
}

/** Latest state of one country, or null when it has none. */
export async function loadLatestState(
  db: SupabaseClient,
  worldId: string,
  countryCode: string,
): Promise<StateRow | null> {
  const { data, error } = await db
    .from('latest_country_states')
    .select(STATE_COLUMNS)
    .eq('world_id', worldId)
    .eq('country_code', countryCode)
    .maybeSingle();
  if (error) throw new DbError('read country state', error.message);
  return (data as StateRow | null) ?? null;
}

/**
 * Each country's state AS OF `year`: the latest row with year <= `year`.
 * Starts from the latest view and, only for countries already past `year`
 * (e.g. reacted earlier in this simulate-year step), reads their older rows.
 * Countries with no row at or before `year` are omitted.
 */
export async function loadStatesAsOf(
  db: SupabaseClient,
  worldId: string,
  year: number,
  latest?: StateRow[],
): Promise<Map<string, StateRow>> {
  const rows = latest ?? (await loadLatestStates(db, worldId));
  const out = new Map<string, StateRow>();
  const ahead: string[] = [];
  for (const r of rows) {
    if (r.year <= year) out.set(r.country_code, r);
    else ahead.push(r.country_code);
  }
  if (ahead.length) {
    const older = await selectAll<StateRow>('read prior country states', () =>
      db
        .from('country_states')
        .select(STATE_COLUMNS)
        .eq('world_id', worldId)
        .in('country_code', ahead)
        .lte('year', year)
        .order('country_code')
        .order('year', { ascending: false }),
    );
    for (const r of older) if (!out.has(r.country_code)) out.set(r.country_code, r);
  }
  return out;
}
