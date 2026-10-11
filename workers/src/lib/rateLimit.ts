// Per-player rate limiting backed by the service-role-only `api_calls` table
// (supabase/migrations/006_review_fixes.sql). Two subrequests per check: one
// read of the window, one insert when the call is allowed.

import type { SupabaseClient } from '@supabase/supabase-js';
import { DbError } from './db.js';

export interface RateLimitRule {
  action: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  forkCreate: { action: 'fork_create', limit: 5, windowSeconds: 3600 },
  simulateYearStart: { action: 'simulate_year_start', limit: 20, windowSeconds: 86_400 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Seconds until the oldest call in the window ages out, given the window's
 * calls sorted oldest first. Pure; exported for tests.
 */
export function retryAfter(oldestCreatedAt: string, windowSeconds: number, now = Date.now()): number {
  const t = Date.parse(oldestCreatedAt);
  if (!Number.isFinite(t)) return windowSeconds;
  return Math.max(1, Math.ceil((t + windowSeconds * 1000 - now) / 1000));
}

/**
 * Check the player's calls for `rule.action` in the window and, if under the
 * limit, record this call. Attempts are counted (not only successes) so a
 * failing client can't hammer the expensive path.
 */
export async function checkAndRecord(
  db: SupabaseClient,
  playerId: string,
  rule: RateLimitRule,
  worldId: string | null = null,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - rule.windowSeconds * 1000).toISOString();
  const { data, error } = await db
    .from('api_calls')
    .select('created_at')
    .eq('player_id', playerId)
    .eq('action', rule.action)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(rule.limit);
  if (error) throw new DbError('read api_calls', error.message);

  const rows = (data ?? []) as { created_at: string }[];
  if (rows.length >= rule.limit) {
    // rows are newest first; the limit-th newest is the one that must age out.
    return { allowed: false, retryAfterSeconds: retryAfter(rows[rows.length - 1].created_at, rule.windowSeconds) };
  }

  const { error: insErr } = await db
    .from('api_calls')
    .insert({ player_id: playerId, action: rule.action, world_id: worldId });
  if (insErr) throw new DbError('insert api_calls', insErr.message);
  return { allowed: true };
}

/** True when the player started a simulate-year for this world within `withinSeconds`. */
export async function hasRecentCall(
  db: SupabaseClient,
  playerId: string,
  action: string,
  worldId: string,
  withinSeconds: number,
): Promise<boolean> {
  const since = new Date(Date.now() - withinSeconds * 1000).toISOString();
  const { data, error } = await db
    .from('api_calls')
    .select('id')
    .eq('player_id', playerId)
    .eq('action', action)
    .eq('world_id', worldId)
    .gte('created_at', since)
    .limit(1);
  if (error) throw new DbError('read api_calls', error.message);
  return (data ?? []).length > 0;
}
