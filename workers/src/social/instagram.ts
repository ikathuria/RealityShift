// Instagram auto-posting via the Facebook Graph API (Instagram Graph API for
// Business/Creator accounts). Two-step publish: create a media container from a
// public image URL, then publish the container.
//
// SCAFFOLD: this is fully implemented but no-ops safely until the user provides
// an IG_USER_ID and IG_ACCESS_TOKEN. Nothing is posted without those secrets.
// The image must be a PUBLIC https URL (Graph API fetches it server-side), so
// this pairs with a public B2 base (MEDIA_PUBLIC_BASE).

import { cleanText } from '../lib/sanitize.js';

const GRAPH_VERSION = 'v21.0';

export interface InstagramEnv {
  IG_USER_ID?: string;
  IG_ACCESS_TOKEN?: string;
}

export interface PostResult {
  ok: boolean;
  skipped?: boolean;
  mediaId?: string;
  error?: string;
}

export function instagramConfigured(env: InstagramEnv): boolean {
  return !!(env.IG_USER_ID && env.IG_ACCESS_TOKEN);
}

/** Max length of a user-supplied world title in a caption. */
export const CAPTION_TITLE_MAX = 80;

/**
 * Make a user-supplied string safe to put in a public caption: strip control
 * and invisible characters, fold to one line, cap the length, and neutralise
 * @mentions, #hashtags and links so a world title can't tag accounts, hijack
 * hashtags or advertise URLs from the project's account.
 */
export function sanitizeCaptionText(v: unknown, max = CAPTION_TITLE_MAX): string {
  let s = cleanText(v, 500, { singleLine: true });
  s = s
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link]')
    .replace(/\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|me|ly|gg|app|dev|xyz|info|biz|tv|link|site|online|shop)\b\S*/gi, '[link]')
    .replace(/@/g, '\uff20') // fullwidth @: not parsed as a mention
    .replace(/#/g, '\uff03'); // fullwidth #: not parsed as a hashtag
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '\u2026' : s;
}

/** Compose a caption for a front page. Keeps within IG's 2,200-char limit. */
export function buildCaption(opts: {
  country: string;
  simDate?: string | null;
  worldTitle?: string | null;
  /** Real-world data cutoff (ISO timestamp) for a fork; null for the live world. */
  cutoff?: string | null;
  /** True for the live world, which keeps ingesting real news (no cutoff). */
  liveWorld?: boolean;
}): string {
  const lines: string[] = [];
  const title = sanitizeCaptionText(opts.worldTitle);
  const country = sanitizeCaptionText(opts.country, 40) || 'A nation';
  lines.push(
    title
      ? `\u{1F4F0} ${title}`
      : `\u{1F4F0} ${country}: a front page from a world that never happened`,
  );
  const simDate = sanitizeCaptionText(opts.simDate, 40);
  if (simDate) lines.push(`\u{1F5D3}\uFE0F Simulated ${simDate}`);
  const cutoff = sanitizeCaptionText(opts.cutoff, 40);
  if (cutoff) lines.push(`\u{1F50F} No real-world data after ${cutoff} \u2014 verifiable provenance.`);
  else if (opts.liveWorld) lines.push('\u{1F30D} Live world \u00b7 updated monthly with real news.');
  lines.push('');
  lines.push('AI-generated alternate history from RealityShift. Fork your own timeline.');
  lines.push('');
  lines.push('#RealityShift #AInews #alternatehistory #geopolitics #simulation #AIart #worldbuilding');
  return lines.join('\n').slice(0, 2200);
}

async function graphPost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = (json.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return json;
}

/**
 * Post a single image to the configured Instagram account. Returns
 * { skipped: true } when credentials are absent — callers can always invoke it.
 */
export async function postToInstagram(
  env: InstagramEnv,
  input: { imageUrl: string; caption: string },
): Promise<PostResult> {
  if (!instagramConfigured(env)) return { ok: false, skipped: true };
  const igUserId = env.IG_USER_ID as string;
  const token = env.IG_ACCESS_TOKEN as string;

  try {
    // 1 · create media container
    const container = await graphPost(`${igUserId}/media`, {
      image_url: input.imageUrl,
      caption: input.caption,
      access_token: token,
    });
    const creationId = String(container.id ?? '');
    if (!creationId) return { ok: false, error: 'No creation id returned from Graph API' };

    // 2 · publish it
    const published = await graphPost(`${igUserId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    return { ok: true, mediaId: String(published.id ?? '') };
  } catch (e) {
    return { ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}
