// Orchestrates the monthly sync for a single country:
//   fetchNews → compareState → publishDivergence
//
// Only runs on the live world (is_live = true). Forks never receive
// real-world data — this check is the enforcement point.

import { fetchCountryNews, formatHeadlines } from './fetchNews.js';
import { compareState } from './compareState.js';
import { publishDivergence } from './publishDivergence.js';
import { getSupabase } from '../lib/supabase.js';
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
  const { data: world } = await db
    .from('worlds')
    .select('is_live')
    .eq('id', worldId)
    .single();

  if (!world?.is_live) {
    return {
      country_code: countryCode,
      diverged: false,
      explanation: `Skipped: world ${worldId} is not the live world.`,
    };
  }

  // Fetch most recent country state
  const { data: stateData, error: stateError } = await db
    .from('country_states')
    .select('*')
    .eq('world_id', worldId)
    .eq('country_code', countryCode)
    .order('year', { ascending: false })
    .limit(1)
    .single();

  if (stateError || !stateData) {
    return {
      country_code: countryCode,
      diverged: false,
      explanation: 'No state found.',
      error: stateError?.message,
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
    return {
      country_code: countryCode,
      diverged: false,
      explanation: 'Sync failed.',
      error: String(err),
    };
  }
}
