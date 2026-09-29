import { supabase } from './supabase';

export interface PublicWorld {
  worldId: string;
  countryCode: string | null;
  title: string;
  forkedAtYear: number | null;
  publishedAt: string | null;
  createdAt: string;
}

interface WorldRow {
  id: string;
  player_country_code: string | null;
  title: string | null;
  forked_at_year: number | null;
  published_at: string | null;
  created_at: string;
}

/** Map a raw `worlds` row to the Hall's view model, with a sensible title fallback. */
export function mapPublicWorld(row: WorldRow): PublicWorld {
  return {
    worldId: row.id,
    countryCode: row.player_country_code,
    title: row.title?.trim() || defaultTitle(row.player_country_code, row.forked_at_year),
    forkedAtYear: row.forked_at_year,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

/** A readable title when the owner published without naming their world. */
export function defaultTitle(countryCode: string | null, year: number | null): string {
  const where = countryCode ?? 'a nation';
  return year ? `${where} — forked ${year}` : `${where} — a forked world`;
}

/**
 * Fetch published forks for the public Hall of Worlds, newest first. Read-only
 * and unauthenticated (relies on the "public read published forks" RLS policy).
 * Degrades to an empty list when the DB is unconfigured or unreachable.
 */
export async function fetchPublicWorlds(limit = 100): Promise<PublicWorld[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('worlds')
      .select('id, player_country_code, title, forked_at_year, published_at, created_at')
      .eq('is_public', true)
      .order('published_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as WorldRow[]).map(mapPublicWorld);
  } catch {
    return [];
  }
}
