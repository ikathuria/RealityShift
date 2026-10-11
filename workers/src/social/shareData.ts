// Everything a share page / social post needs for a world.

import { getSupabase } from '../lib/supabase.js';
import { siteUrl } from '../lib/http.js';
import { loadMediaIndex, pickFrontPage, type MediaEnv } from '../media/mediaIndex.js';
import { shareTitle } from './share.js';

export interface ShareWorldRow {
  id: string;
  player_country_code: string | null;
  forked_at_year: number | null;
  title: string | null;
  is_public: boolean;
  is_live: boolean;
}

export const SHARE_WORLD_COLUMNS = 'id, player_country_code, forked_at_year, title, is_public, is_live';

export interface ForkShareData {
  title: string;
  description: string;
  imageUrl: string;
  canonicalUrl: string;
  countryCode: string | null;
  simDate: string | null;
  /** Real-world data cutoff (ISO timestamp) for a fork; null for the live world or when unknown. */
  cutoff: string | null;
  /** True for the live world (no cutoff: it keeps ingesting real news monthly). */
  liveWorld: boolean;
  worldTitle: string | null;
  /** True when a real (non-sample) front-page image was found. */
  hasMedia: boolean;
}

const BASE_DESCRIPTION =
  'A continuous AI wargame across ~195 countries. Fork it on demand and read the news from a world that never happened — with verifiable provenance.';

type ShareEnv = MediaEnv & { SITE_URL?: string; SUPABASE_URL: string; SUPABASE_SERVICE_KEY: string };

/**
 * Share data for a world, or null when the world does not exist (the route
 * then 404s). Private (unpublished, non-live) worlds get a generic card and
 * their media index is never read. `worldId` must already be validated.
 */
export async function getForkShareData(
  env: ShareEnv,
  worldId: string,
  preloaded?: ShareWorldRow,
): Promise<ForkShareData | null> {
  const site = siteUrl(env);
  const canonicalUrl = `${site}/wall/${worldId}`;
  const fallbackImage = `${site}/earth-cartoon.png`;

  let row: ShareWorldRow | null = preloaded ?? null;
  if (!row) {
    try {
      const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
      const { data, error } = await db.from('worlds').select(SHARE_WORLD_COLUMNS).eq('id', worldId).maybeSingle();
      if (error) {
        console.error(`[share] world lookup ${worldId}:`, error.message);
      } else if (!data) {
        return null; // unknown world -> 404
      } else {
        row = data as ShareWorldRow;
      }
    } catch (e) {
      console.error(`[share] world lookup ${worldId}:`, e instanceof Error ? e.message : e);
    }
  }

  const visible = !!row && (row.is_public || row.is_live);
  if (!visible) {
    // Private fork, or the DB was unreachable: generic card, no media lookup.
    return {
      title: shareTitle('A nation', null, null),
      description: BASE_DESCRIPTION,
      imageUrl: fallbackImage,
      canonicalUrl,
      countryCode: null,
      simDate: null,
      cutoff: null,
      liveWorld: false,
      worldTitle: null,
      hasMedia: false,
    };
  }

  const w = row as ShareWorldRow;
  const fp = pickFrontPage(await loadMediaIndex(env, w.id));
  const prov = fp?.provenance ?? null;
  const cutoffRaw = prov?.real_world_data_cutoff;
  const cutoff = typeof cutoffRaw === 'string' && cutoffRaw ? cutoffRaw : null;
  const liveWorld = w.is_live || prov?.live_world === true;

  const provenanceLine = liveWorld
    ? 'Live world · updated monthly with real news.'
    : cutoff
      ? `No real-world data after ${cutoff.slice(0, 10)}.`
      : '';

  return {
    title: shareTitle(w.player_country_code ?? 'A nation', w.forked_at_year, w.title),
    description: provenanceLine ? `${BASE_DESCRIPTION} ${provenanceLine}` : BASE_DESCRIPTION,
    imageUrl: fp?.b2_url ?? fallbackImage,
    canonicalUrl,
    countryCode: w.player_country_code,
    simDate: typeof fp?.sim_date === 'string' ? fp.sim_date : null,
    cutoff: liveWorld ? null : cutoff,
    liveWorld,
    worldTitle: w.title,
    hasMedia: !!fp,
  };
}
