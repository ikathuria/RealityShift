import { countryName } from '../data/countries';
import { INK, tileMarkup, flagUrl } from '../lib/gameArt';

/** React wrappers for the arcade art in lib/gameArt. */

export function EventIcon({ type, size = 28 }: { type: string; size?: number }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0 }}
      // Static, trusted markup from the table above — no user input reaches it.
      dangerouslySetInnerHTML={{ __html: tileMarkup(type) }}
    />
  );
}

/** Country flag with the arcade ink outline. Renders nothing for unknown codes. */
export function Flag({ iso3, height = 20 }: { iso3: string; height?: number }) {
  const src = flagUrl(iso3);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`Flag of ${countryName(iso3)}`}
      width={Math.round(height * 4 / 3)}
      height={height}
      className="game-flag"
      loading="lazy"
    />
  );
}

/** Cartoon portrait for the AI head of government. */
export function AgentAvatar({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r="16" fill="#74c0fc" stroke={INK} strokeWidth="3" />
      {/* suit + tie */}
      <path d="M7 31c2-6 6-8 11-8s9 2 11 8" fill="#1f2a44" stroke={INK} strokeWidth="2.5" />
      <path d="M18 23l-2 3 2 5 2-5z" fill="#FFE600" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      {/* head */}
      <circle cx="18" cy="15" r="6.5" fill="#ffd7a8" stroke={INK} strokeWidth="2.5" />
      {/* visor eyes: it's an AI */}
      <rect x="13" y="13" width="10" height="3.5" rx="1.75" fill={INK} />
      <circle cx="16" cy="14.75" r="0.9" fill="#00F0FF" />
      <circle cx="20" cy="14.75" r="0.9" fill="#00F0FF" />
    </svg>
  );
}
