// HTTP helpers: CORS, JSON errors that never leak exception text, bearer
// parsing and a constant-time secret comparison.

export const DEFAULT_SITE_URL = 'https://ikathuria.github.io/RealityShift';

/** Origins allowed to call /api/* from a browser, besides SITE_URL's origin. */
const EXTRA_ORIGINS = ['https://ishani.kathuria.net', 'http://localhost:5173'];

export function siteUrl(env: { SITE_URL?: string }): string {
  return (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function allowedOrigins(env: { SITE_URL?: string }): Set<string> {
  const set = new Set(EXTRA_ORIGINS);
  try {
    set.add(new URL(siteUrl(env)).origin);
  } catch {
    set.add(new URL(DEFAULT_SITE_URL).origin);
  }
  return set;
}

/** CORS headers for this request: ACAO only when the Origin is allow-listed. */
export function corsHeaders(request: Request, env: { SITE_URL?: string }): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-worker-secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigins(env).has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/** Answer a CORS preflight. */
export function preflight(request: Request, env: { SITE_URL?: string }): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}

/**
 * Copy `res` with CORS headers added. A response that already allows every
 * origin (`*`, e.g. the public RSS feed) keeps it. Responses read from
 * caches.default have immutable headers, so this always builds a new Response.
 */
export function withCors(request: Request, env: { SITE_URL?: string }, res: Response): Response {
  const out = new Response(res.body, res);
  const cors = corsHeaders(request, env);
  delete cors.Vary; // merged below so an existing Vary is kept
  const wildcard = out.headers.get('Access-Control-Allow-Origin') === '*';
  if (!wildcard) out.headers.delete('Access-Control-Allow-Origin');
  for (const [k, v] of Object.entries(cors)) {
    if (k === 'Access-Control-Allow-Origin' && wildcard) continue;
    out.headers.set(k, v);
  }
  const vary = out.headers.get('Vary');
  if (!vary) out.headers.set('Vary', 'Origin');
  else if (!/\borigin\b/i.test(vary)) out.headers.set('Vary', `${vary}, Origin`);
  return out;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * A JSON error with a generic, client-safe message. The underlying exception
 * (if any) is logged server-side only — never returned to the caller.
 */
export function jsonError(message: string, status: number, err?: unknown, context?: string): Response {
  if (err !== undefined) {
    console.error(`[${context ?? 'api'}] ${message}:`, err instanceof Error ? err.stack ?? err.message : err);
  }
  return json({ error: message }, status);
}

/** Parse a JSON object body; null when it is missing, malformed or not an object. */
export async function parseJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(request.headers.get('authorization') ?? '');
  return m ? m[1] : null;
}

/**
 * Constant-time string equality. Both inputs are hashed first so the
 * comparison loop always runs over 32 bytes, whatever the input lengths.
 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
