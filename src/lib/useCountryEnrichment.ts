import { useEffect, useState } from 'react';
import { fetchCountryEnrichment, type DcIndicators } from '../data/dataCommons';

// Module-level memo: real-world baselines don't change within a session, so
// re-selecting a country never refetches. Shared across all hook instances.
const cache = new Map<string, DcIndicators | null>();
// One shared request per country. Every subscriber awaits the same promise, so
// an instance that mounts while another's fetch is in flight (StrictMode's
// double mount, or switching A→B→A) still re-renders when it lands.
const inflight = new Map<string, Promise<void>>();

function load(iso3: string): Promise<void> {
  let p = inflight.get(iso3);
  if (!p) {
    p = fetchCountryEnrichment(iso3)
      .catch(() => null)
      .then(result => { cache.set(iso3, result); })
      .finally(() => { inflight.delete(iso3); });
    inflight.set(iso3, p);
  }
  return p;
}

/** Test hook: forget everything cached between test cases. */
export function resetEnrichmentCache(): void {
  cache.clear();
  inflight.clear();
}

export interface EnrichmentState {
  data: DcIndicators | null;
  loading: boolean;
}

/**
 * Data Commons enrichment for one country (life expectancy, inequality, etc.),
 * loaded lazily through the Worker proxy. Returns null data when the enrichment
 * is unavailable — callers should simply omit the section.
 */
export function useCountryEnrichment(iso3: string | null): EnrichmentState {
  // Bumped only from the async callback (never synchronously in the effect) to
  // re-read the module cache once a fetch resolves.
  const [, bump] = useState(0);

  useEffect(() => {
    if (!iso3 || cache.has(iso3)) return;
    let cancelled = false;
    load(iso3).then(() => {
      if (!cancelled) bump(v => v + 1);
    });
    return () => { cancelled = true; };
  }, [iso3]);

  const data = iso3 && cache.has(iso3) ? cache.get(iso3) ?? null : null;
  const loading = !!iso3 && !cache.has(iso3);
  return { data, loading };
}
