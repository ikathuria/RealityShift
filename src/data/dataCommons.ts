// Frontend client for the Data Commons enrichment, served through our Worker
// proxy (workers/src/data/dataCommons.ts) so the API key stays server-side.
//
// These indicators COMPLEMENT the World Bank set in worldbank.ts (life
// expectancy, inequality, emissions, connectivity, energy, poverty) — data the
// UN System Data Commons (data.un.org) surfaces that World Bank's 7 don't.
// Keys here must match DC_VARIABLES in the Worker.

/** Worker proxy origin, read per-call so it stays overridable in tests. */
function workerBase(): string {
  return (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '';
}

export type DcKey =
  | 'life_expectancy'
  | 'gini_index'
  | 'co2_per_capita'
  | 'internet_users'
  | 'energy_per_capita'
  | 'extreme_poverty';

export type DcIndicators = Record<DcKey, number | null>;

/** Display metadata for each enrichment indicator. */
export const DC_INDICATOR_META: Record<DcKey, { label: string; unit: string; decimals: number }> = {
  life_expectancy:   { label: 'Life Expectancy',   unit: 'yrs',      decimals: 1 },
  gini_index:        { label: 'Income Inequality', unit: 'Gini',     decimals: 1 },
  co2_per_capita:    { label: 'CO₂ per Capita',     unit: 't',        decimals: 1 },
  internet_users:    { label: 'Internet Users',    unit: '%',        decimals: 1 },
  energy_per_capita: { label: 'Energy Use',        unit: 'kgoe',     decimals: 0 },
  extreme_poverty:   { label: 'Extreme Poverty',   unit: '%',        decimals: 1 },
};

export const DC_KEYS = Object.keys(DC_INDICATOR_META) as DcKey[];

interface CountryResponse {
  indicators?: DcIndicators | null;
  reason?: string;
}

/**
 * Complementary indicators for one country, or null when the proxy is
 * unconfigured/unreachable (callers treat null as "no enrichment").
 */
export async function fetchCountryEnrichment(iso3: string): Promise<DcIndicators | null> {
  const base = workerBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/datacommons/country?iso3=${encodeURIComponent(iso3)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as CountryResponse;
    return json.indicators ?? null;
  } catch {
    return null;
  }
}

interface GlobalResponse {
  values?: Record<string, number>;
}

/** One enrichment indicator for every country (choropleth). Empty map on failure. */
export async function fetchGlobalEnrichment(metric: DcKey): Promise<Map<string, number>> {
  const base = workerBase();
  if (!base) return new Map();
  try {
    const res = await fetch(`${base}/api/datacommons/global?metric=${encodeURIComponent(metric)}`);
    if (!res.ok) return new Map();
    const json = (await res.json()) as GlobalResponse;
    return new Map(Object.entries(json.values ?? {}));
  } catch {
    return new Map();
  }
}
