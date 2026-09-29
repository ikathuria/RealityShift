// Server-rendered share pages. The frontend is static (GitHub Pages) and social
// crawlers do not run JS, so per-fork Open Graph previews have to come from the
// Worker. A human who opens the link is redirected on to the SPA; a crawler
// reads the meta tags and never follows the redirect.

export interface SharePageOptions {
  title: string;
  description: string;
  imageUrl: string;
  /** Where a human visitor should end up (the SPA wall for this world). */
  canonicalUrl: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Full HTML document with OG/Twitter meta and a human redirect to the SPA. */
export function buildSharePage(opts: SharePageOptions): string {
  const title = esc(opts.title);
  const desc = esc(opts.description);
  const image = esc(opts.imageUrl);
  const canonical = esc(opts.canonicalUrl);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="RealityShift" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${image}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${image}" />
<meta http-equiv="refresh" content="0; url=${canonical}" />
</head>
<body style="background:#0b1020;color:#e6ebff;font-family:system-ui,sans-serif;text-align:center;padding:40px">
<p>Opening this world…</p>
<p><a href="${canonical}" style="color:#4fd6ff">View it on RealityShift →</a></p>
<script>location.replace(${JSON.stringify(opts.canonicalUrl)});</script>
</body>
</html>`;
}

/** A share headline for a published fork. */
export function shareTitle(country: string, forkedYear: number | null, worldTitle?: string | null): string {
  if (worldTitle && worldTitle.trim()) return `${worldTitle.trim()} — a RealityShift world`;
  const yr = forkedYear ? ` (forked ${forkedYear})` : '';
  return `${country}${yr} — a world that never happened`;
}
