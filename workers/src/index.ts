import { runSeed } from './seed.js';
import { runAgent } from './agents/runAgents.js';
import { syncCountry } from './sync/syncCountry.js';
import { getSupabase } from './lib/supabase.js';
import { buildSharePage, parseShareWorldId } from './social/share.js';
import { postToInstagram, buildCaption, instagramConfigured } from './social/instagram.js';
import { getForkShareData, SHARE_WORLD_COLUMNS, type ForkShareData, type ShareWorldRow } from './social/shareData.js';
import { handleForkCreate, handleSimulateYear } from './fork/handlers.js';
import { loadMediaIndex, mediaConfigured } from './media/mediaIndex.js';
import { authenticatePlayer } from './lib/auth.js';
import { loadLatestStates } from './lib/db.js';
import { isIso3, isWorldId, finiteNumber } from './lib/sanitize.js';
import {
  json,
  jsonError,
  parseJsonObject,
  preflight,
  safeEqual,
  siteUrl,
  withCors,
} from './lib/http.js';
import {
  fetchCountryIndicators as fetchDcCountry,
  fetchGlobalIndicator as fetchDcGlobal,
  DC_VARIABLES,
  type DcKey,
} from './data/dataCommons.js';

export interface Env {
  GROQ_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  NEWS_API_KEY: string;
  WORKER_SECRET: string;
  ANTHROPIC_API_KEY?: string;
  // ── Sharing + social (optional; features no-op until set) ──
  /** Public origin of the frontend SPA, e.g. https://ikathuria.github.io/RealityShift.
   *  Its origin is also allowed by CORS. */
  SITE_URL?: string;
  /** Public B2/CDN base for reading media indexes. When set, the media index is
   *  served as-is from `${MEDIA_PUBLIC_BASE}/index/<world>/media.json`. */
  MEDIA_PUBLIC_BASE?: string;
  /** Private B2 bucket access (S3-compatible API) for the media index endpoint.
   *  Same names as the media layer (media/realityshift_media/storage.py). When
   *  MEDIA_PUBLIC_BASE is unset and these are set, the Worker presigns the index
   *  and re-presigns every asset URL in it on each request. */
  B2_KEY_ID?: string;
  B2_APP_KEY?: string;
  B2_BUCKET?: string;
  B2_REGION?: string;
  /** Optional S3 endpoint override; default https://s3.<B2_REGION>.backblazeb2.com */
  B2_S3_ENDPOINT?: string;
  /** Instagram Graph API — a Business/Creator IG user id and a long-lived token. */
  IG_USER_ID?: string;
  IG_ACCESS_TOKEN?: string;
  /** Data Commons REST v2 key (free, no quota — https://docs.datacommons.org/api).
   *  When unset, the /api/datacommons/* routes return empty data so the UI degrades. */
  DATA_COMMONS_API_KEY?: string;
}

/** Secret-protected (CI / admin) routes: constant-time check of x-worker-secret. */
async function requireSecret(request: Request, env: Env): Promise<Response | null> {
  const secret = request.headers.get('x-worker-secret') ?? '';
  if (!env.WORKER_SECRET || !(await safeEqual(secret, env.WORKER_SECRET))) {
    return jsonError('Unauthorized', 401);
  }
  return null;
}

// ── Data Commons proxy helpers ──────────────────────────────────────────────
/** Edge-cache TTL for Data Commons responses; real-world stats move ~yearly. */
const DC_TTL = 86_400; // 24h

/** JSON response for the Data Commons routes (CORS is added by the /api wrapper). */
function dcResponse(data: unknown, ttl: number, status = 200): Response {
  const headers: Record<string, string> = {
    'Cache-Control': ttl > 0 ? `public, max-age=${ttl}` : 'no-store',
  };
  if (data === null) return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Edge cache. NOTE: caches.default is a no-op on *.workers.dev hostnames — it
// only stores entries on a custom domain/route. On workers.dev every request
// misses and we fall through to Data Commons (the browser still honours the
// Cache-Control max-age). Both helpers swallow cache errors so a cache problem
// can never fail the request.
async function dcCacheGet(request: Request): Promise<Response | null> {
  try {
    return (await caches.default.match(request)) ?? null;
  } catch {
    return null;
  }
}

/** Build the response, stash a clone in the edge cache, and return it. */
function dcCachePut(request: Request, data: unknown, ttl: number, ctx: ExecutionContext): Response {
  const res = dcResponse(data, ttl);
  try {
    ctx.waitUntil(caches.default.put(request, res.clone()).catch(() => undefined));
  } catch {
    // cache unavailable — serve uncached
  }
  return res;
}

async function handleDataCommons(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  // GET /api/datacommons/country?iso3=USA -> { indicators: { key: number|null } }
  if (url.pathname === '/api/datacommons/country' && request.method === 'GET') {
    const iso3 = (url.searchParams.get('iso3') ?? '').toUpperCase();
    if (!isIso3(iso3)) return dcResponse({ error: 'iso3 (3-letter code) required' }, 0, 400);
    if (!env.DATA_COMMONS_API_KEY) return dcResponse({ indicators: null, reason: 'not_configured' }, 300);
    const cached = await dcCacheGet(request);
    if (cached) return cached;
    try {
      const indicators = await fetchDcCountry(iso3, env.DATA_COMMONS_API_KEY);
      return dcCachePut(request, { indicators, source: 'Data Commons (data.un.org)' }, DC_TTL, ctx);
    } catch (e) {
      return jsonError('Data Commons request failed', 502, e, 'datacommons');
    }
  }

  // GET /api/datacommons/global?metric=life_expectancy -> { values: { ISO3: number } }
  if (url.pathname === '/api/datacommons/global' && request.method === 'GET') {
    const metric = url.searchParams.get('metric') ?? '';
    if (!(metric in DC_VARIABLES)) {
      return dcResponse({ error: `unknown metric; one of ${Object.keys(DC_VARIABLES).join(', ')}` }, 0, 400);
    }
    if (!env.DATA_COMMONS_API_KEY) return dcResponse({ values: {}, reason: 'not_configured' }, 300);
    const cached = await dcCacheGet(request);
    if (cached) return cached;
    try {
      const values = await fetchDcGlobal(metric as DcKey, env.DATA_COMMONS_API_KEY);
      return dcCachePut(request, { values, source: 'Data Commons (data.un.org)' }, DC_TTL, ctx);
    } catch (e) {
      return jsonError('Data Commons request failed', 502, e, 'datacommons');
    }
  }

  return jsonError('Not Found', 404);
}

// ── GET /api/media/index/:worldId ────────────────────────────────────────────
// Live and published worlds are public; a private fork needs the owner's token.
async function handleMediaIndex(request: Request, env: Env, rawId: string): Promise<Response> {
  let id: string;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    return jsonError('Not Found', 404);
  }
  if (!isWorldId(id)) return jsonError('Not Found', 404);
  if (id !== 'live') id = id.toLowerCase();

  let isPublic = id === 'live';
  if (!isPublic) {
    const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const { data, error } = await db.from('worlds').select('player_id, is_public, is_live').eq('id', id).maybeSingle();
    if (error) return jsonError('Could not load the media index', 500, error.message, 'media/index');
    const w = data as { player_id: string | null; is_public: boolean; is_live: boolean } | null;
    if (!w) return jsonError('No media index for this world', 404);
    isPublic = w.is_public || w.is_live;
    if (!isPublic) {
      const userId = await authenticatePlayer(request, env);
      if (!userId) return jsonError('Unauthorized', 401);
      if (userId !== w.player_id) return jsonError('Forbidden', 403);
    }
  }

  if (!mediaConfigured(env)) return jsonError('No media index for this world', 404);
  const index = await loadMediaIndex(env, id);
  if (!index) return jsonError('No media index for this world', 404);
  return json(index, 200, {
    // Presigned URLs inside live for hours; keep shared caches short.
    'Cache-Control': isPublic ? 'public, max-age=300' : 'private, no-store',
  });
}

// ── GET /api/world/feed.xml — RSS 2.0 divergence feed ───────────────────────
async function handleFeed(env: Env): Promise<Response> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data, error } = await db
    .from('divergences')
    .select('id, country_code, sim_year, narrative, published_at, delta')
    .order('published_at', { ascending: false })
    .limit(50);
  if (error || !data) {
    if (error) console.error('[feed] read divergences:', error.message);
    return new Response('Internal Server Error', { status: 500 });
  }

  type DivRow = {
    id: number;
    country_code: string;
    sim_year: number;
    narrative: string | null;
    published_at: string;
    delta: Record<string, unknown> | null;
  };

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Links point at the SPA (SITE_URL), not at this Worker, which has no /world page.
  const worldLink = `${siteUrl(env)}/world`;

  const items = (data as DivRow[]).map(d => {
    const magnitude = Object.values(d.delta ?? {}).reduce<number>((a, v) => a + Math.abs(finiteNumber(v) ?? 0), 0);
    const severity = magnitude > 5 ? '🔴' : magnitude > 2 ? '🟡' : '🟢';
    const shortNarrative = (d.narrative ?? '').split('\n\nNews used:')[0].slice(0, 400);
    const pubDate = new Date(d.published_at).toUTCString();
    return `    <item>
      <title>${severity} ${escapeXml(String(d.country_code))} — sim yr ${Number(d.sim_year)} divergence (Δ${magnitude.toFixed(1)})</title>
      <link>${escapeXml(worldLink)}</link>
      <guid isPermaLink="false">divergence-${Number(d.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(shortNarrative)}</description>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RealityShift — Divergence Feed</title>
    <link>${escapeXml(worldLink)}</link>
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
      // Public feed: any origin may read it.
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// ── Instagram ────────────────────────────────────────────────────────────────
function captionFor(share: ForkShareData): string {
  return buildCaption({
    country: share.countryCode ?? 'A nation',
    simDate: share.simDate,
    worldTitle: share.worldTitle,
    cutoff: share.cutoff,
    liveWorld: share.liveWorld,
  });
}

/** Post a world's front page and record instagram_posted_at on success. */
async function postWorld(env: Env, worldId: string, share: ForkShareData) {
  const result = await postToInstagram(env, { imageUrl: share.imageUrl, caption: captionFor(share) });
  if (result.ok) {
    const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const { error } = await db
      .from('worlds')
      .update({ instagram_posted_at: new Date().toISOString() })
      .eq('id', worldId);
    if (error) console.error(`[instagram] posted ${worldId} but could not record it:`, error.message);
  } else if (!result.skipped) {
    console.error(`[instagram] post ${worldId} failed:`, result.error);
  }
  return result;
}

/** Cron: post the newest published world that has media and was never posted. */
async function instagramCron(env: Env): Promise<void> {
  const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data, error } = await db
    .from('worlds')
    .select(SHARE_WORLD_COLUMNS)
    .eq('is_public', true)
    .is('instagram_posted_at', null)
    .order('published_at', { ascending: false })
    .limit(10);
  if (error) {
    console.error('[instagram cron] read worlds:', error.message);
    return;
  }
  for (const row of (data ?? []) as ShareWorldRow[]) {
    const share = await getForkShareData(env, row.id, row);
    if (!share?.hasMedia) continue;
    await postWorld(env, row.id, share);
    return; // one post per run, whatever the outcome
  }
}

// ── Router ───────────────────────────────────────────────────────────────────
async function routeApi(request: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const { pathname } = url;
  const method = request.method;

  if (pathname === '/api/health') {
    return json({ status: 'ok', service: 'realityshift-api' });
  }

  // Data Commons proxy (browser-facing, key hidden, edge-cached). Google's open
  // knowledge graph — the same data behind data.un.org.
  if (pathname.startsWith('/api/datacommons/')) return handleDataCommons(request, env, url, ctx);

  // GET /api/countries — country codes in a world (monthly-sync workflow loop).
  if (pathname === '/api/countries' && method === 'GET') {
    const denied = await requireSecret(request, env);
    if (denied) return denied;
    const worldId = url.searchParams.get('world_id') ?? 'live';
    if (!isWorldId(worldId)) return jsonError('Invalid world_id', 400);
    try {
      const db = getSupabase(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
      const states = await loadLatestStates(db, worldId);
      return json({ codes: states.map(s => s.country_code) });
    } catch (e) {
      return jsonError('Could not list countries', 500, e, 'countries');
    }
  }

  // POST /api/seed
  if (pathname === '/api/seed' && method === 'POST') {
    const denied = await requireSecret(request, env);
    if (denied) return denied;
    try {
      return json(await runSeed(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY));
    } catch (e) {
      return jsonError('Seed failed', 500, e, 'seed');
    }
  }

  // POST /api/agents/run — one agent step (= one sim year) for one country.
  // Body: { world_id, country_code }. On the live world this returns
  // { skipped: true, reason } once the live year has reached the real year.
  if (pathname === '/api/agents/run' && method === 'POST') {
    const denied = await requireSecret(request, env);
    if (denied) return denied;
    const body = await parseJsonObject(request);
    const worldId = body?.world_id;
    const countryCode = typeof body?.country_code === 'string' ? body.country_code.toUpperCase() : '';
    if (!isWorldId(worldId) || !isIso3(countryCode)) {
      return jsonError('world_id and country_code (ISO3) required', 400);
    }
    const result = await runAgent(worldId, countryCode, env);
    return json(result, result.success ? 200 : 500);
  }

  // POST /api/sync/country — monthly real-world sync for one country, applied
  // in place to the live world's current sim year. Body: { country_code, world_id? }
  if (pathname === '/api/sync/country' && method === 'POST') {
    const denied = await requireSecret(request, env);
    if (denied) return denied;
    const body = await parseJsonObject(request);
    const worldId = body?.world_id ?? 'live';
    const countryCode = typeof body?.country_code === 'string' ? body.country_code.toUpperCase() : '';
    if (!isWorldId(worldId) || !isIso3(countryCode)) {
      return jsonError('country_code (ISO3) required', 400);
    }
    const result = await syncCountry(countryCode, worldId, env);
    return json(result, result.error ? 500 : 200);
  }

  if (pathname === '/api/fork/create' && method === 'POST') return handleForkCreate(request, env);
  if (pathname === '/api/fork/simulate-year' && method === 'POST') return handleSimulateYear(request, env);

  const mediaMatch = /^\/api\/media\/index\/([^/]+)\/?$/.exec(pathname);
  if (mediaMatch && method === 'GET') return handleMediaIndex(request, env, mediaMatch[1]);

  if (pathname === '/api/world/feed.xml' && method === 'GET') return handleFeed(env);

  // POST /api/social/instagram/post — publish one world's front page.
  // Secret-protected (CI / manual). No-ops when IG creds are unset. Body: { world_id }
  if (pathname === '/api/social/instagram/post' && method === 'POST') {
    const denied = await requireSecret(request, env);
    if (denied) return denied;
    const body = await parseJsonObject(request);
    const worldId = body?.world_id;
    if (!isWorldId(worldId)) return jsonError('world_id required', 400);
    if (!instagramConfigured(env)) {
      return json({ skipped: true, reason: 'IG_USER_ID / IG_ACCESS_TOKEN not set' });
    }
    const share = await getForkShareData(env, worldId);
    if (!share?.hasMedia) return jsonError('No public front-page image found for this world', 404);
    const result = await postWorld(env, worldId, share);
    if (result.ok || result.skipped) return json(result);
    return jsonError('Instagram post failed', 502);
  }

  return jsonError('Not Found', 404);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Every /api/* route answers CORS preflight and carries CORS headers.
    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return preflight(request, env);
      let res: Response;
      try {
        res = await routeApi(request, env, url, ctx);
      } catch (e) {
        res = jsonError('Internal error', 500, e, url.pathname);
      }
      return withCors(request, env, res);
    }

    // GET /share/:worldId — server-rendered OG preview for social crawlers.
    // Humans are redirected to the SPA wall; crawlers read the meta tags.
    // Only `live` or a UUID is accepted; anything else 404s.
    if (url.pathname.startsWith('/share/') && request.method === 'GET') {
      const worldId = parseShareWorldId(url.pathname);
      if (!worldId) return new Response('Not Found', { status: 404 });
      const data = await getForkShareData(env, worldId);
      if (!data) return new Response('Not Found', { status: 404 });
      return new Response(buildSharePage(data), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=600',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },

  // ── Cron: auto-post the newest unposted published world to Instagram ────────
  // Wired via [triggers].crons in wrangler.toml. No-ops until IG creds are set.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!instagramConfigured(env)) return;
    ctx.waitUntil(
      instagramCron(env).catch(e => {
        // Best-effort; a failed post should not throw out of the cron.
        console.error('[instagram cron]', e instanceof Error ? e.message : e);
      }),
    );
  },
};
