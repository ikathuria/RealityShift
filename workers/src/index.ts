import { runSeed } from './seed.js';
import { runAgent } from './agents/runAgents.js';

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

    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', service: 'realityshift-api' });
    }

    // POST /api/seed — seed Supabase with World Bank data for all countries
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

    // POST /api/agents/run — run agent for a single country
    // Body: { world_id: string, country_code: string }
    // Called once per country by GitHub Actions monthly sync.
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

    // POST /api/sync/country — Milestone 5
    if (url.pathname === '/api/sync/country' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      return Response.json({ message: 'sync/country not yet implemented' }, { status: 501 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
