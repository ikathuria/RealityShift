import { useEffect, useState } from 'react';
import { fetchCountryEnrichment, type DcIndicators } from '../data/dataCommons';

// Module-level memo: real-world baselines don't change within a session, so
// re-selecting a country never refetches. Shared across all hook instances.
const cache = new Map<string, DcIndicators | null>();
const inflight = new Set<string>();

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
    if (!iso3 || cache.has(iso3) || inflight.has(iso3)) return;
    inflight.add(iso3);
    let cancelled = false;
    fetchCountryEnrichment(iso3).then(result => {
      cache.set(iso3, result);
      inflight.delete(iso3);
      if (!cancelled) bump(v => v + 1);
    });
    return () => { cancelled = true; };
  }, [iso3]);

  const data = iso3 && cache.has(iso3) ? cache.get(iso3) ?? null : null;
  const loading = !!iso3 && !cache.has(iso3);
  return { data, loading };
}
