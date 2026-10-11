import { DEMO_2026_MEDIA_ENTRIES } from '../data/demoSamples';
import { isDemoWorld } from './demo';
import { supabase } from './supabase';
import { WORKER_URL } from './workerApi';

/**
 * The `simulation` block hashed into each asset's Genblaze manifest.
 *
 * - Fork: `real_world_data_cutoff` is the fork's creation time as a full
 *   ISO-8601 UTC timestamp (JS toISOString style); it is NOT the divergence date.
 * - Live world: `live_world: true` and a null cutoff, because the live world
 *   keeps ingesting real news every month.
 * - Sample: `sample: true` marks bundled synthetic demo content.
 */
export interface SimProvenance {
  fork_id: string;
  parent_fork_id: string | null;
  divergence_date: string;
  sim_date: string;
  real_world_data_cutoff: string | null;
  live_world: boolean;
  sample: boolean;
  nation_iso: string | null;
  is_counterfactual: boolean;
  consensus_reality: boolean;
}

export interface MediaEntry {
  sim_date: string;            // ISO date
  nation_iso: string | null;
  kind: string;                // "front_page" | "broadcast" | ...
  b2_url: string;
  manifest_uri: string;
  canonical_hash: string;
  duration?: number | null;         // seconds, broadcasts
  provenance?: SimProvenance | null; // simulation.* block
}

export interface MediaIndex {
  world_id: string;
  count: number;
  media: MediaEntry[];
  /** True for the bundled 2026 sample set, which callers must label as such. */
  sample?: boolean;
}

const B2_BASE = ((import.meta.env.VITE_B2_PUBLIC_BASE as string | undefined) ?? '').replace(/\/$/, '');
// Last-resort fallback only. A presigned URL for the live world's index in a
// PRIVATE bucket, printed by the media batch. Like every presigned URL it
// EXPIRES (<= 7 days), and so do the presigned media URLs inside it, so it goes
// stale on its own. The Worker endpoint below re-presigns on demand instead.
const PRESIGNED_LIVE_INDEX_URL = (import.meta.env.VITE_MEDIA_INDEX_URL as string | undefined) ?? '';

interface IndexSource {
  url: string;
  /** Send the player's Supabase session as a Bearer token (private forks). */
  auth: boolean;
}

/**
 * Where to look for a world's media index, best first:
 *   1. the Worker's `/api/media/index/:worldId` (fresh URLs; private forks need the owner's token),
 *   2. a public bucket at VITE_B2_PUBLIC_BASE,
 *   3. the expiring presigned VITE_MEDIA_INDEX_URL (live world only),
 *   4. in local dev with none of the above, a same-origin mock under public/index/.
 */
export function mediaIndexSources(worldId: string): IndexSource[] {
  const id = encodeURIComponent(worldId);
  const sources: IndexSource[] = [];
  if (WORKER_URL) sources.push({ url: `${WORKER_URL}/api/media/index/${id}`, auth: worldId !== 'live' });
  if (B2_BASE) sources.push({ url: `${B2_BASE}/index/${id}/media.json`, auth: false });
  if (PRESIGNED_LIVE_INDEX_URL && worldId === 'live') sources.push({ url: PRESIGNED_LIVE_INDEX_URL, auth: false });
  if (!sources.length && import.meta.env.DEV) sources.push({ url: `/index/${id}/media.json`, auth: false });
  return sources;
}

async function sessionToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function isMediaIndex(x: unknown): x is MediaIndex {
  return !!x && typeof x === 'object' && Array.isArray((x as MediaIndex).media);
}

/**
 * A world's media index, or null when it has none (or none is reachable).
 * Sample media is returned only in the explicit demo context (see lib/demo);
 * a real world with no media gets null, so it renders as an empty state.
 */
export async function fetchMediaIndex(worldId: string): Promise<MediaIndex | null> {
  if (isDemoWorld(worldId)) return demoMediaIndex(worldId);

  let token: string | null | undefined;
  for (const source of mediaIndexSources(worldId)) {
    try {
      const headers: Record<string, string> = {};
      if (source.auth) {
        if (token === undefined) token = await sessionToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(source.url, { cache: 'no-cache', headers });
      if (!res.ok) continue;
      const data: unknown = await res.json();
      if (isMediaIndex(data)) return data;
    } catch {
      // Try the next source.
    }
  }
  return null;
}

/** The bundled 2026 sample set, clearly flagged. */
export function demoMediaIndex(worldId: string): MediaIndex {
  return {
    world_id: worldId,
    count: DEMO_2026_MEDIA_ENTRIES.length,
    media: DEMO_2026_MEDIA_ENTRIES,
    sample: true,
  };
}
