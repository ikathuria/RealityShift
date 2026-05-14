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

/** Countries with curated history — eligible for full agent simulation */
const CURATED_COUNTRIES = [
  'USA','CHN','RUS','IND','GBR','DEU','FRA','JPN',
  'BRA','AUS','CAN','KOR','MEX','IDN','TUR','SAU','ZAF','NGA','PAK','UKR',
];

/** Verify a player JWT using the service-role client (passes JWT through to Supabase Auth). */
async function verifyPlayerJWT(token: string, env: Env): Promise<string | null> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
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

    // ── POST /api/fork/create — fork the live world for a player ─────────────
    // Auth: Bearer <player_jwt>
    // Body: { country_code }
    if (url.pathname === '/api/fork/create' && request.method === 'POST') {
      const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
      const userId = await verifyPlayerJWT(token, env);
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      try {
        const { country_code } = await parseBody<{ country_code: string }>(request);
        if (!country_code) return Response.json({ error: 'country_code required' }, { status: 400 });

        const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

        // Get all latest country states from live world
        const { data: allStates, error: statesErr } = await db
          .from('country_states')
          .select('*')
          .eq('world_id', 'live')
          .order('country_code')
          .order('year', { ascending: false });

        if (statesErr || !allStates) {
          return Response.json({ error: 'Failed to read live world' }, { status: 500 });
        }

        // Deduplicate: keep latest year per country
        type StateRow = {
          world_id: string; country_code: string; year: number;
          indicators: Record<string, number>; policies: Record<string, unknown>;
          relations: Record<string, string>; agent_memory_summary: string | null;
          last_updated: string;
        };
        const seen = new Set<string>();
        const latestStates: StateRow[] = [];
        for (const s of allStates as StateRow[]) {
          if (!seen.has(s.country_code)) {
            seen.add(s.country_code);
            latestStates.push(s);
          }
        }

        const playerState = latestStates.find(s => s.country_code === country_code);
        const currentYear = playerState?.year ?? 2025;

        // Create fork world
        const forkId = crypto.randomUUID();
        const { error: worldErr } = await db.from('worlds').insert({
          id: forkId,
          fork_of: 'live',
          is_live: false,
          player_id: userId,
          forked_at_year: currentYear,
          player_country_code: country_code,
        });
        if (worldErr) return Response.json({ error: worldErr.message }, { status: 500 });

        // Copy all country states to the fork (in batches of 50)
        const forkStates = latestStates.map(s => ({ ...s, world_id: forkId }));
        for (let i = 0; i < forkStates.length; i += 50) {
          const { error: insertErr } = await db.from('country_states').insert(forkStates.slice(i, i + 50));
          if (insertErr) return Response.json({ error: insertErr.message }, { status: 500 });
        }

        // Create game session
        await db.from('game_sessions').insert({
          player_id: userId,
          world_id: forkId,
          country_code,
        });

        return Response.json({ worldId: forkId, year: currentYear, countryCode: country_code });
      } catch (e) {
        return Response.json({ error: String(e) }, { status: 500 });
      }
    }

    // ── POST /api/fork/simulate-year — run agents for one year in a fork ──────
    // Auth: Bearer <player_jwt>
    // Body: { world_id, player_country_code }
    // Runs agents for up to 8 curated countries (excluding player's) then advances player's country.
    if (url.pathname === '/api/fork/simulate-year' && request.method === 'POST') {
      const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
      const userId = await verifyPlayerJWT(token, env);
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      try {
        const { world_id, player_country_code } = await parseBody<{
          world_id: string;
          player_country_code: string;
        }>(request);

        if (!world_id || !player_country_code) {
          return Response.json({ error: 'world_id and player_country_code required' }, { status: 400 });
        }

        const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

        // Verify the world belongs to this player
        const { data: world, error: worldErr } = await db
          .from('worlds')
          .select('player_id')
          .eq('id', world_id)
          .single();
        if (worldErr || !world || (world as { player_id: string }).player_id !== userId) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Run agents for curated countries (excluding player's), max 8
        const toSimulate = CURATED_COUNTRIES
          .filter(c => c !== player_country_code)
          .slice(0, 8);

        const results: Array<{ country: string; status: 'ok' | 'error'; error?: string }> = [];
        for (const countryCode of toSimulate) {
          try {
            await runAgent(world_id, countryCode, env);
            results.push({ country: countryCode, status: 'ok' });
          } catch (e) {
            results.push({ country: countryCode, status: 'error', error: String(e).slice(0, 80) });
          }
        }

        // Advance the player's own country by copying current year state to year+1
        const { data: playerState } = await db
          .from('country_states')
          .select('*')
          .eq('world_id', world_id)
          .eq('country_code', player_country_code)
          .order('year', { ascending: false })
          .limit(1)
          .single();

        if (playerState) {
          const ps = playerState as { year: number; [key: string]: unknown };
          await db.from('country_states').upsert({
            ...ps,
            year: ps.year + 1,
            last_updated: new Date().toISOString(),
          });
        }

        return Response.json({ processed: results.length, results });
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
