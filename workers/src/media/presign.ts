// AWS Signature V4 query-string presigning for GET, hand-rolled on WebCrypto
// (no SDK dependency). Used against Backblaze B2's S3-compatible API, matching
// what media/realityshift_media/presign.py does with boto3.

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(data));
}

/** RFC 3986 encoding as SigV4 requires (encodeURIComponent leaves !'()* alone). */
export function uriEncode(s: string, encodeSlash = true): string {
  const out = encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return encodeSlash ? out : out.replace(/%2F/g, '/');
}

function amzDate(d: Date): { date: string; datetime: string } {
  const datetime = d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return { date: datetime.slice(0, 8), datetime };
}

/**
 * Presign a GET for `https://<host><path>` (path already in canonical,
 * URI-encoded form, starting with "/"). Returns the full signed URL.
 */
export async function presignGet(
  creds: S3Credentials,
  host: string,
  canonicalPath: string,
  expiresSeconds: number,
  now: Date = new Date(),
): Promise<string> {
  const { date, datetime } = amzDate(now);
  const scope = `${date}/${creds.region}/s3/aws4_request`;
  const params: [string, string][] = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${creds.accessKeyId}/${scope}`],
    ['X-Amz-Date', datetime],
    ['X-Amz-Expires', String(Math.max(1, Math.min(604800, Math.floor(expiresSeconds))))],
    ['X-Amz-SignedHeaders', 'host'],
  ];
  const query = params
    .map(([k, v]) => [uriEncode(k), uriEncode(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const canonicalRequest = ['GET', canonicalPath, query, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, scope, await sha256Hex(canonicalRequest)].join('\n');

  let key: ArrayBuffer = await hmac(enc.encode(`AWS4${creds.secretAccessKey}`), date);
  key = await hmac(key, creds.region);
  key = await hmac(key, 's3');
  key = await hmac(key, 'aws4_request');
  const signature = hex(await hmac(key, stringToSign));

  return `https://${host}${canonicalPath}?${query}&X-Amz-Signature=${signature}`;
}
