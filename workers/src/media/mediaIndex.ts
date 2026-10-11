// Read a world's media index (index/<world_id>/media.json, written by the media
// batch in media/realityshift_media/index.py) and make every URL in it usable
// right now.
//
// Two storage modes:
//  - MEDIA_PUBLIC_BASE set (public bucket / CDN): the index is fetched from
//    `${MEDIA_PUBLIC_BASE}/index/<id>/media.json` and returned as-is.
//  - Private B2 bucket: the Worker presigns a GET for the index with the B2 S3
//    credentials, then re-presigns every B2 asset URL inside it (the presigned
//    URLs the batch baked in expire after <= 7 days).
//
// Env (same names the media layer uses — see media/realityshift_media/storage.py):
//   B2_KEY_ID, B2_APP_KEY, B2_BUCKET, B2_REGION   required for the private mode
//   B2_S3_ENDPOINT                                 optional, default https://s3.<region>.backblazeb2.com

import { presignGet, uriEncode, type S3Credentials } from './presign.js';

export interface MediaEnv {
  MEDIA_PUBLIC_BASE?: string;
  B2_KEY_ID?: string;
  B2_APP_KEY?: string;
  B2_BUCKET?: string;
  B2_REGION?: string;
  B2_S3_ENDPOINT?: string;
}

export interface MediaProvenance {
  real_world_data_cutoff?: string | null;
  live_world?: boolean;
  sample?: boolean;
  [key: string]: unknown;
}

export interface MediaEntry {
  sim_date?: string;
  nation_iso?: string | null;
  kind?: string;
  b2_url?: string;
  manifest_uri?: string;
  canonical_hash?: string;
  duration?: number | null;
  provenance?: MediaProvenance | null;
  [key: string]: unknown;
}

export interface MediaIndex {
  world_id?: string;
  count?: number;
  media: MediaEntry[];
  [key: string]: unknown;
}

/** Presigned URLs we hand out live this long (B2 caps presigns at 7 days). */
export const PRESIGN_TTL_SECONDS = 6 * 3600;

interface B2Config {
  creds: S3Credentials;
  bucket: string;
  host: string;
}

export function b2Config(env: MediaEnv): B2Config | null {
  if (!env.B2_KEY_ID || !env.B2_APP_KEY || !env.B2_BUCKET || !env.B2_REGION) return null;
  let host = `s3.${env.B2_REGION}.backblazeb2.com`;
  if (env.B2_S3_ENDPOINT) {
    try {
      host = new URL(env.B2_S3_ENDPOINT).host;
    } catch {
      return null;
    }
  }
  return {
    creds: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APP_KEY, region: env.B2_REGION },
    bucket: env.B2_BUCKET,
    host,
  };
}

export function mediaConfigured(env: MediaEnv): boolean {
  return !!env.MEDIA_PUBLIC_BASE || b2Config(env) !== null;
}

/** Canonical path-style URL path for an object: /<bucket>/<key>. */
function objectPath(bucket: string, key: string): string {
  return `/${uriEncode(bucket)}/${uriEncode(key, false)}`;
}

export function presignObject(cfg: B2Config, key: string, ttl = PRESIGN_TTL_SECONDS): Promise<string> {
  return presignGet(cfg.creds, cfg.host, objectPath(cfg.bucket, key), ttl);
}

/**
 * Recover the object key from an asset URL the batch wrote (plain or already
 * presigned; virtual-hosted `https://<bucket>.s3.<region>.backblazeb2.com/<key>`
 * or path-style `https://s3.<region>.backblazeb2.com/<bucket>/<key>`). Returns
 * null for URLs that are not in this bucket, which are then left untouched.
 */
export function objectKeyFromUrl(url: string, bucket: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  if (!host.endsWith('backblazeb2.com')) return null;
  let path: string;
  try {
    path = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
  } catch {
    return null;
  }
  const b = bucket.toLowerCase();
  if (host.startsWith(`${b}.`)) return path || null;
  if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1) || null;
  return null;
}

/** Fields of an index entry that hold B2 URLs needing a fresh signature. */
const URL_FIELDS = ['b2_url', 'manifest_uri'] as const;

/** Re-presign every B2 URL in the index (returns a new object). */
export async function represignIndex(index: MediaIndex, cfg: B2Config): Promise<MediaIndex> {
  const media = await Promise.all(
    (index.media ?? []).map(async entry => {
      const out: MediaEntry = { ...entry };
      for (const field of URL_FIELDS) {
        const v = entry[field];
        if (typeof v !== 'string') continue;
        const key = objectKeyFromUrl(v, cfg.bucket);
        if (key) out[field] = await presignObject(cfg, key);
      }
      return out;
    }),
  );
  return { ...index, media };
}

function isIndex(v: unknown): v is MediaIndex {
  return !!v && typeof v === 'object' && Array.isArray((v as { media?: unknown }).media);
}

/**
 * Load a world's media index with every URL usable now, or null when there is
 * no index (or storage is not configured / unreachable). `worldId` must already
 * be validated (live or a UUID). One subrequest either way (presigning is local
 * WebCrypto work, not a request).
 */
export async function loadMediaIndex(env: MediaEnv, worldId: string): Promise<MediaIndex | null> {
  const key = `index/${worldId}/media.json`;
  try {
    if (env.MEDIA_PUBLIC_BASE) {
      const base = env.MEDIA_PUBLIC_BASE.replace(/\/+$/, '');
      const res = await fetch(`${base}/${key}`, { cf: { cacheTtl: 300 } } as RequestInit);
      if (!res.ok) return null;
      const body = (await res.json()) as unknown;
      return isIndex(body) ? body : null;
    }
    const cfg = b2Config(env);
    if (!cfg) return null;
    const res = await fetch(await presignObject(cfg, key, 300));
    if (!res.ok) {
      // 404 = no index yet; 403 from B2 also means "no such key" for a
      // key-restricted application key. Anything else is worth a log line.
      if (res.status !== 404 && res.status !== 403) console.warn(`[mediaIndex] ${worldId}: HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as unknown;
    return isIndex(body) ? represignIndex(body, cfg) : null;
  } catch (e) {
    console.error(`[mediaIndex] ${worldId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * The front-page entry to show for a world: the newest front_page that is not
 * sample/demo media. Returns null when there is none.
 */
export function pickFrontPage(index: MediaIndex | null): MediaEntry | null {
  if (!index) return null;
  const real = index.media.filter(m => m && typeof m.b2_url === 'string' && !m.provenance?.sample);
  const fronts = real.filter(m => m.kind === 'front_page');
  if (!fronts.length) return null;
  return fronts.sort((a, b) => String(b.sim_date ?? '').localeCompare(String(a.sim_date ?? '')))[0];
}
