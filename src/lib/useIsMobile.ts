import { useSyncExternalStore } from 'react';

// Single source of truth for the "phone-ish" breakpoint. The arcade HUD is a
// desktop-first layout (fixed-width panels, a multi-item header bar); below this
// width those need to stack instead of overflow off-screen. useSyncExternalStore
// keeps the value in sync with the media query without a set-state-in-effect
// (which this repo's lint config rejects) and without a wrong first paint.
const QUERY = '(max-width: 640px)';

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

// SSR / non-browser render: assume desktop. The client re-reads on hydration.
function getServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
