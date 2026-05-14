import { runSeed } from './seed.js';
import { runAgent } from './agents/runAgents.js';
import { syncCountry } from './sync/syncCountry.js';
import { getSupabase } from './lib/supabase.js';

export interface Env {
  GROQ_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  NEWS_API_KEY: string;
  WORKER_SECRET: string;
  ANTHROPIC_API_KEY?: string;
}

function requireSecret(request: Request, env: Env): Response | null {
  const secret = request.headers.get('x-worker-secret');
  if (secret !== env.WORKER_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}

async function parseBody<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── Health ────────────────────────────────────────────────────────────────
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', service: 'realityshift-api' });
    }

    // ── GET /api/countries — list all country codes in the live world ─────────
    // Called by the GitHub Actions monthly-sync workflow to build its loop.
    if (url.pathname === '/api/countries' && request.method === 'GET') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      try {
        const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        const worldId = url.searchParams.get('world_id') ?? 'live';
        const { data } = await db
          .from('country_states')
          .select('country_code')
          .eq('world_id', worldId)
          .order('country_code');

        const seen = new Set<string>();
        const codes: string[] = [];
        for (const row of (data ?? []) as { country_code: string }[]) {
          if (!seen.has(row.country_code)) {
            seen.add(row.country_code);
            codes.push(row.country_code);
          }
        }
        return Response.json({ codes });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // ── POST /api/seed ────────────────────────────────────────────────────────
    if (url.pathname === '/api/seed' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      try {
        const result = await runSeed(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        return Response.json(result);
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // ── POST /api/agents/run — run agent for one country ──────────────────────
    // Body: { world_id: string, country_code: string }
    if (url.pathname === '/api/agents/run' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      try {
        const { world_id, country_code } = await parseBody<{
          world_id: string;
          country_code: string;
        }>(request);
        if (!world_id || !country_code) {
          return Response.json({ error: 'world_id and country_code required' }, { status: 400 });
        }
        const result = await runAgent(world_id, country_code, env);
        return Response.json(result);
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // ── POST /api/sync/country — monthly real-world sync for one country ──────
    // Body: { country_code: string, world_id?: string }
    // Only affects the live world — forks are silently skipped.
    if (url.pathname === '/api/sync/country' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      try {
        const { country_code, world_id = 'live' } = await parseBody<{
          country_code: string;
          world_id?: string;
        }>(request);
        if (!country_code) {
          return Response.json({ error: 'country_code required' }, { status: 400 });
        }
        const result = await syncCountry(country_code, world_id, env);
        return Response.json(result);
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
