// Player-facing fork routes: POST /api/fork/create and POST /api/fork/simulate-year.
// Both authenticate with the player's Supabase access token (Bearer) and are
// rate-limited through api_calls. Errors are JSON { error } with generic text.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../index.js';
import { getSupabase } from '../lib/supabase.js';
import { authenticatePlayer } from '../lib/auth.js';
import { json, jsonError, parseJsonObject } from '../lib/http.js';
import { DbError, loadLatestStates, loadStatesAsOf, selectAll } from '../lib/db.js';
import { RATE_LIMITS, checkAndRecord, hasRecentCall, type RateLimitResult } from '../lib/rateLimit.js';
import { isIso3, UUID_RE } from '../lib/sanitize.js';
import { runAgent } from '../agents/runAgents.js';
import { BATCH_SIZE, computeReactingSet, nextCursor, type EventLink } from './reacting.js';

const LIVE = 'live';
const COPY_BATCH = 100;
/** A cursor > 0 must belong to a simulate-year started (cursor 0) this recently. */
const SIMULATE_SESSION_SECONDS = 6 * 3600;

function rateLimited(r: Extract<RateLimitResult, { allowed: false }>, what: string): Response {
  return json(
    { error: `Too many ${what}. Try again later.`, retry_after_seconds: r.retryAfterSeconds },
    429,
    { 'Retry-After': String(r.retryAfterSeconds) },
  );
}

// ── POST /api/fork/create ────────────────────────────────────────────────────
// Body { country_code } -> { worldId, year, countryCode }

export async function handleForkCreate(request: Request, env: Env): Promise<Response> {
  const userId = await authenticatePlayer(request, env);
  if (!userId) return jsonError('Unauthorized', 401);

  const body = await parseJsonObject(request);
  const countryCode = typeof body?.country_code === 'string' ? body.country_code.trim().toUpperCase() : '';
  if (!isIso3(countryCode)) return jsonError('country_code (ISO3) required', 400);

  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  let forkId: string | null = null;
  try {
    const rl = await checkAndRecord(db, userId, RATE_LIMITS.forkCreate);
    if (!rl.allowed) return rateLimited(rl, 'new forks');

    const latest = await loadLatestStates(db, LIVE);
    if (!latest.length) return jsonError('The live world is not available yet', 503);
    const playerState = latest.find(s => s.country_code === countryCode);
    if (!playerState) return jsonError('Unknown country_code', 400);
    const year = playerState.year;

    const id = crypto.randomUUID();
    const { error: worldErr } = await db.from('worlds').insert({
      id,
      fork_of: LIVE,
      is_live: false,
      player_id: userId,
      forked_at_year: year,
      player_country_code: countryCode,
    });
    if (worldErr) throw new DbError('insert worlds', worldErr.message);
    forkId = id;

    const rows = latest.map(s => ({
      world_id: id,
      country_code: s.country_code,
      year: s.year,
      indicators: s.indicators,
      policies: s.policies,
      relations: s.relations,
      agent_memory_summary: s.agent_memory_summary,
      last_updated: s.last_updated ?? new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += COPY_BATCH) {
      const { error } = await db.from('country_states').insert(rows.slice(i, i + COPY_BATCH));
      if (error) throw new DbError('copy country_states', error.message);
    }

    const { error: sessErr } = await db.from('game_sessions').insert({
      player_id: userId,
      world_id: id,
      country_code: countryCode,
    });
    if (sessErr) throw new DbError('insert game_sessions', sessErr.message);

    return json({ worldId: id, year, countryCode });
  } catch (e) {
    if (forkId) {
      // Roll back: deleting the world cascades to its states/sessions/events.
      const { error: delErr } = await db.from('worlds').delete().eq('id', forkId);
      if (delErr) console.error(`[fork/create] rollback of ${forkId} failed:`, delErr.message);
    }
    return jsonError('Could not create the fork', 500, e, 'fork/create');
  }
}

// ── POST /api/fork/simulate-year ─────────────────────────────────────────────
// Body { world_id, cursor?, year? }
// -> { year, reacting, results: [{ country_code, status, error? }], next_cursor }

export interface SimulateResult {
  country_code: string;
  status: 'ok' | 'error' | 'skipped';
  error?: string;
}

async function loadEventLinks(
  db: SupabaseClient,
  worldId: string,
  playerCode: string,
  year: number,
): Promise<EventLink[]> {
  // playerCode is validated ISO3 before it is interpolated into the filter.
  if (!isIso3(playerCode)) return [];
  return selectAll<EventLink>('read world_events', () =>
    db
      .from('world_events')
      .select('from_country, to_country')
      .eq('world_id', worldId)
      .gte('sim_year', year - 2)
      .lt('sim_year', year)
      .or(`from_country.eq.${playerCode},to_country.eq.${playerCode}`)
      .order('id'),
  );
}

/**
 * Subrequests per call: auth 1 + world 1 + rate limit 2 (or session check 1)
 * + latest states 1 + prior states <=1 + events 1 + up to 3 countries x <=9
 * + player advance <=1  =>  <= 36, under the free plan's 50.
 */
export async function handleSimulateYear(request: Request, env: Env): Promise<Response> {
  const userId = await authenticatePlayer(request, env);
  if (!userId) return jsonError('Unauthorized', 401);

  const body = await parseJsonObject(request);
  const worldId = typeof body?.world_id === 'string' ? body.world_id.trim().toLowerCase() : '';
  if (!UUID_RE.test(worldId)) return jsonError('world_id required', 400);

  const rawCursor = body?.cursor ?? 0;
  const cursor = typeof rawCursor === 'number' && Number.isInteger(rawCursor) && rawCursor >= 0 ? rawCursor : -1;
  if (cursor < 0 || cursor > 1000) return jsonError('cursor must be a non-negative integer', 400);

  const rawYear = body?.year;
  if (rawYear !== undefined && rawYear !== null && !(typeof rawYear === 'number' && Number.isInteger(rawYear))) {
    return jsonError('year must be an integer', 400);
  }
  const requestedYear = typeof rawYear === 'number' ? rawYear : undefined;

  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  try {
    const { data: world, error: worldErr } = await db
      .from('worlds')
      .select('id, player_id, player_country_code, is_live')
      .eq('id', worldId)
      .maybeSingle();
    if (worldErr) throw new DbError('read worlds', worldErr.message);
    const w = world as { player_id: string | null; player_country_code: string | null; is_live: boolean } | null;
    if (!w || w.player_id !== userId || w.is_live) return jsonError('Forbidden', 403);
    const playerCode = w.player_country_code ?? '';
    if (!isIso3(playerCode)) return jsonError('This fork has no player country', 409);

    if (cursor === 0) {
      const rl = await checkAndRecord(db, userId, RATE_LIMITS.simulateYearStart, worldId);
      if (!rl.allowed) return rateLimited(rl, 'simulated years today');
    } else if (!(await hasRecentCall(db, userId, RATE_LIMITS.simulateYearStart.action, worldId, SIMULATE_SESSION_SECONDS))) {
      return jsonError('Start the year with cursor 0', 409);
    }

    const latest = await loadLatestStates(db, worldId);
    const playerLatest = latest.find(s => s.country_code === playerCode);
    if (!playerLatest) return jsonError('The player country has no state in this fork', 409);

    // The year being simulated is the player's year (the player is advanced
    // only when the step completes). A client retrying a batch of a step that
    // already completed can pass that step's `year` and gets "skipped" rows.
    let year = playerLatest.year;
    if (requestedYear !== undefined) {
      if (requestedYear !== year && requestedYear !== year - 1) {
        return jsonError('year does not match the fork\'s current year', 409);
      }
      year = requestedYear;
    }

    const asOf = await loadStatesAsOf(db, worldId, year, latest);
    const latestByCode = new Map(latest.map(s => [s.country_code, s]));
    const events = await loadEventLinks(db, worldId, playerCode, year);
    const reacting = computeReactingSet(playerCode, asOf, events);

    const batch = reacting.slice(cursor, cursor + BATCH_SIZE);
    const results: SimulateResult[] = [];
    for (const code of batch) {
      const current = latestByCode.get(code);
      const state = asOf.get(code);
      if (!state || (current && current.year > year)) {
        // Already at year + 1 (a retried batch), or nothing to decide from.
        results.push({ country_code: code, status: 'skipped' });
        continue;
      }
      const r = await runAgent(worldId, code, env, { simYear: year, state, snapshot: asOf });
      if (r.success && !r.skipped) results.push({ country_code: code, status: 'ok' });
      else if (r.skipped) results.push({ country_code: code, status: 'skipped' });
      else results.push({ country_code: code, status: 'error', error: r.error ?? 'agent_failed' });
    }

    const next = nextCursor(cursor, reacting.length);
    if (next === null && playerLatest.year <= year) {
      // Step complete: advance the player's own country to year + 1.
      const ps = asOf.get(playerCode) ?? playerLatest;
      const { error: advErr } = await db.from('country_states').upsert(
        {
          world_id: worldId,
          country_code: playerCode,
          year: year + 1,
          indicators: ps.indicators,
          policies: ps.policies,
          relations: ps.relations,
          agent_memory_summary: ps.agent_memory_summary,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'world_id,country_code,year' },
      );
      if (advErr) throw new DbError('advance player country', advErr.message);
    }

    return json({ year, reacting, results, next_cursor: next });
  } catch (e) {
    return jsonError('Could not simulate the year', 500, e, 'fork/simulate-year');
  }
}
