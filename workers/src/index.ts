export interface Env {
  GROQ_API_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  SUPABASE_URL: string;
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

    if (url.pathname === '/api/agents/run' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      // Milestone 3: will import and call runAgents here
      return Response.json({ message: 'agents/run not yet implemented' }, { status: 501 });
    }

    if (url.pathname === '/api/sync/country' && request.method === 'POST') {
      const denied = requireSecret(request, env);
      if (denied) return denied;
      // Milestone 5: will import and call syncCountry here
      return Response.json({ message: 'sync/country not yet implemented' }, { status: 501 });
    }

    return new Response('Not Found', { status: 404 });
  },
};
