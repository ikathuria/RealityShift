import { runSeed } from './seed.js';

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', service: 'realityshift-api' });
    }

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

    if (url.pathname === '/api/agents/run' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      return Response.json({ message: 'agents/run not yet implemented' }, { status: 501 });
    }

    if (url.pathname === '/api/sync/country' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      return Response.json({ message: 'sync/country not yet implemented' }, { status: 501 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
