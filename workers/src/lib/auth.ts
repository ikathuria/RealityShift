import { getSupabase } from './supabase.js';
import { bearerToken } from './http.js';

/**
 * The Supabase user id for the request's `Authorization: Bearer <access token>`,
 * or null when it is missing or invalid. One subrequest (Supabase Auth) when a
 * token is present.
 */
export async function authenticatePlayer(
  request: Request,
  env: { SUPABASE_URL: string; SUPABASE_SERVICE_KEY: string },
): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (e) {
    console.error('[auth] getUser failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
