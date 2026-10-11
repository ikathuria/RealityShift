// Orchestrates the monthly sync for a single country:
//   fetchNews → compareState → publishDivergence
//
// Only runs on the live world (is_live = true). Forks never receive
// real-world data — this check is the enforcement point.

import { fetchCountryNews, formatHeadlines } from './fetchNews.js';
import { compareState } from './compareState.js';
import { publishDivergence } from './publishDivergence.js';
import { getSupabase } from '../lib/supabase.js';
import { DbError } from '../lib/db.js';
import countryHistories from '../data/history/country_histories.json';
import type { CountryStateRow } from '../agents/prompt.js';
import type { Env } from '../index.js';

interface CountryHistory { country: string }

export interface SyncResult {
  country_code: string;
  diverged: boolean;
  explanation: string;
  error?: string;
}

export async function syncCountry(
  countryCode: string,
  worldId: string,
  env: Env
): Promise<SyncResult> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Safety check: only sync live worlds
  const { data: world, error: worldErr } = await db
    .from('worlds')
    .select('is_live')
    .eq('id', worldId)
    .maybeSingle();
  if (worldErr) {
    console.error(`[syncCountry] ${countryCode}: read world failed:`, worldErr.message);
    return { country_code: countryCode, diverged: false, explanation: 'Sync failed.', error: 'db_error' };
  }

  if (!world?.is_live) {
    return {
      country_code: countryCode,
      diverged: false,
      explanation: `Skipped: world ${worldId} is not the live world.`,
    };
  }

  // Current (latest-year) state; corrections are applied to this year in place.
  const { data: stateData, error: stateError } = await db
    .from('latest_country_states')
    .select('*')
    .eq('world_id', worldId)
    .eq('country_code', countryCode)
    .maybeSingle();

  if (stateError || !stateData) {
    if (stateError) console.error(`[syncCountry] ${countryCode}: read state failed:`, stateError.message);
    return {
      country_code: countryCode,
      diverged: false,
      explanation: 'No state found.',
      error: stateError ? 'db_error' : 'no_state',
    };
  }

  const state = stateData as CountryStateRow;

  // Resolve human-readable country name for NewsAPI query
  const countryName =
    (countryHistories as Record<string, CountryHistory>)[countryCode]?.country ?? countryCode;

  try {
    // 1. Fetch real-world news
    const headlines = await fetchCountryNews(countryName, env.NEWS_API_KEY);
    const newsBlock = formatHeadlines(headlines);

    // 2. Compare simulated state to news
    const result = await compareState(countryName, state, newsBlock, env.GROQ_API_KEY);

    // 3. Publish divergence report and apply self-correction (always record, even if small)
    await publishDivergence(state, result, newsBlock, env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    return {
      country_code: countryCode,
      diverged: result.diverged,
      explanation: result.explanation,
    };
  } catch (err) {
    // Detail is logged only; the client gets a short code.
    console.error(`[syncCountry] ${countryCode}:`, err instanceof Error ? err.message : err);
    return {
      country_code: countryCode,
      diverged: false,
      explanation: 'Sync failed.',
      error: err instanceof DbError ? 'db_error' : 'sync_failed',
    };
  }
}
