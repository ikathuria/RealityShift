import { supabase } from './supabase';

/**
 * The one place that decides whether bundled 2026 sample data may be shown.
 *
 * Demo/sample data is only allowed in an explicit sample context: the
 * `2026-demo` world (e.g. /wall/2026-demo), or a build with no Supabase
 * configured at all, where there is no real world to show. It is never mixed
 * into the live world or a fork, so an empty world looks empty.
 */
export const DEMO_WORLD_ID = '2026-demo';

export function isDemoWorld(worldId: string): boolean {
  return worldId === DEMO_WORLD_ID || !supabase;
}
