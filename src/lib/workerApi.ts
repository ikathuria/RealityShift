/**
 * Small, defensive client for the Cloudflare Worker's JSON API.
 *
 * Every failure mode resolves to `{ ok: false, error }` with a message that is
 * safe to show a player: fetch rejections (offline, CORS, DNS), non-2xx
 * responses whose body may not be JSON, and 429 rate limits with a
 * human-readable "try again" hint. Callers never need a try/catch.
 */

export const WORKER_URL = ((import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '').replace(/\/$/, '');

export type WorkerResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number | null; error: string; retryAfterSeconds?: number };

/** "in 40 seconds" / "in 12 minutes" / "in 3 hours" — for 429 messages. */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 90) return `in ${Math.max(1, Math.round(seconds))} seconds`;
  if (seconds < 90 * 60) return `in ${Math.round(seconds / 60)} minutes`;
  return `in ${Math.round(seconds / 3600)} hours`;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function postWorker<T>(
  path: string,
  body: unknown,
  jwt: string | null,
): Promise<WorkerResult<T>> {
  if (!WORKER_URL) {
    return { ok: false, status: null, error: 'The game server is not configured, so this action is unavailable.' };
  }

  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: null, error: 'Could not reach the game server. Check your connection and try again.' };
  }

  const json = (await readJson(res)) as (Record<string, unknown> | null);

  if (!res.ok) {
    const serverMsg = typeof json?.error === 'string' ? json.error : null;
    if (res.status === 429) {
      const retry = typeof json?.retry_after_seconds === 'number'
        ? json.retry_after_seconds
        : Number(res.headers.get('Retry-After')) || undefined;
      return {
        ok: false,
        status: 429,
        retryAfterSeconds: retry,
        error: `You've hit the limit for now. Try again ${retry ? formatRetryAfter(retry) : 'later'}.`,
      };
    }
    if (res.status === 401) {
      return { ok: false, status: 401, error: 'Your session has expired. Sign in again and retry.' };
    }
    return {
      ok: false,
      status: res.status,
      error: serverMsg ?? `The game server returned an error (${res.status}). Try again in a moment.`,
    };
  }

  if (json === null) {
    return { ok: false, status: res.status, error: 'The game server sent an unreadable reply. Try again in a moment.' };
  }
  return { ok: true, data: json as T };
}
