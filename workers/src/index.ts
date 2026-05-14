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

    // ── GET /api/world/feed.xml — RSS 2.0 divergence feed ────────────────────
    if (url.pathname === '/api/world/feed.xml' && request.method === 'GET') {
      try {
        const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
        const { data, error } = await db
          .from('divergences')
          .select('id, country_code, sim_year, narrative, published_at, delta')
          .order('published_at', { ascending: false })
          .limit(50);

        if (error || !data) {
          return new Response('Internal Server Error', { status: 500 });
        }

        type DivRow = {
          id: number;
          country_code: string;
          sim_year: number;
          narrative: string;
          published_at: string;
          delta: Record<string, number>;
        };

        const escapeXml = (s: string) =>
          s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const origin = `${url.protocol}//${url.host}`;

        const items = (data as DivRow[]).map(d => {
          const magnitude = Object.values(d.delta).reduce((a, v) => a + Math.abs(v), 0);
          const severity = magnitude > 5 ? '🔴' : magnitude > 2 ? '🟡' : '🟢';
          const shortNarrative = d.narrative.split('\n\nNews used:')[0].slice(0, 400);
          const pubDate = new Date(d.published_at).toUTCString();
          return `    <item>
      <title>${severity} ${escapeXml(d.country_code)} — sim yr ${d.sim_year} divergence (Δ${magnitude.toFixed(1)})</title>
      <link>${escapeXml(origin)}/world</link>
      <guid isPermaLink="false">divergence-${d.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(shortNarrative)}</description>
    </item>`;
        }).join('\n');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RealityShift — Divergence Feed</title>
    <link>${escapeXml(origin)}/world</link>
    <description>Live simulation vs. reality divergence tracker. Updated monthly.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (e) {
        return new Response('Internal Server Error', { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
