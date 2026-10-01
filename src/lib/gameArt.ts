import { ISO3_TO_ISO2 } from '../data/countries';

/**
 * Hand-drawn-style SVG glyphs for the arcade HUD. Each is a flat colour fill
 * with a heavy ink outline so they read as one set (and not as OS emoji,
 * which render differently on every platform).
 *
 * Glyphs are kept as SVG markup strings so the same art can be used both in
 * React (components/GameIcons) and as Cesium billboard images on the globe.
 */
export const INK = '#0b0f19';

const GLOBE_GLYPH = '<circle cx="16" cy="16" r="8"/><path d="M8 16h16M16 8c-3 3-3 13 0 16M16 8c3 3 3 13 0 16"/>';

const ICONS: Record<string, { bg: string; glyph: string }> = {
  // Handshake: two hands meeting
  trade_deal: { bg: '#5cc46a', glyph: '<path d="M6 17l5-5 4 2 4-3 7 6"/><path d="M11 19l3 3M14 17l4 4M18 16l3 3"/>' },
  // No-entry disc
  sanction: { bg: '#ff6b6b', glyph: '<circle cx="16" cy="16" r="8"/><path d="M10.5 21.5l11-11"/>' },
  // Shield
  military_posture: { bg: '#FFE600', glyph: '<path d="M16 6l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V9z"/>' },
  // Megaphone
  diplomatic_protest: { bg: '#ffa94d', glyph: '<path d="M7 14v4h4l8 5V9l-8 5z"/><path d="M23 13c1.5 1.5 1.5 4.5 0 6"/>' },
  // Chain links
  alliance_formed: { bg: '#74c0fc', glyph: '<rect x="6" y="12" width="11" height="8" rx="4"/><rect x="15" y="12" width="11" height="8" rx="4"/>' },
  // Broken links
  alliance_broken: { bg: '#ff8fab', glyph: '<path d="M14 12h-4a4 4 0 000 8h4"/><path d="M18 12h4a4 4 0 010 8h-4"/><path d="M16 8v3M16 21v3"/>' },
  // Warning triangle
  conflict_risk: { bg: '#ff6b6b', glyph: '<path d="M16 7l10 17H6z"/><path d="M16 13v5M16 21.5v.5"/>' },
};

function iconParts(type: string) {
  return ICONS[type] ?? { bg: '#74c0fc', glyph: GLOBE_GLYPH };
}

export function tileMarkup(type: string): string {
  const { bg, glyph } = iconParts(type);
  return `<rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="${bg}" stroke="${INK}" stroke-width="3"/>`
    + `<g fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
}

/**
 * Map-pin image for the globe: the event tile on a short ink stem, with a
 * yellow ring when it's the newest event. Returned as a data: URL for Cesium.
 */
export function eventPinDataUrl(type: string, highlight = false): string {
  const ring = highlight
    ? `<rect x="-1" y="-1" width="34" height="34" rx="10" fill="none" stroke="#FFE600" stroke-width="3"/>`
    : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="104" viewBox="-4 -4 40 52">`
    + `<path d="M12 30h8l-4 12z" fill="${INK}"/>`
    + `<ellipse cx="16" cy="44" rx="5" ry="1.8" fill="${INK}" opacity="0.35"/>`
    + ring + tileMarkup(type)
    + `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Self-hosted flag SVGs from the flag-icons package. Vite emits each as its own
// asset, and the browser only fetches the ones actually rendered.
const FLAG_URLS = import.meta.glob<string>('/node_modules/flag-icons/flags/4x3/*.svg', {
  eager: true, query: '?no-inline', import: 'default',
});

export function flagUrl(iso3: string): string | undefined {
  const iso2 = ISO3_TO_ISO2[iso3];
  return iso2 ? FLAG_URLS[`/node_modules/flag-icons/flags/4x3/${iso2}.svg`] : undefined;
}

