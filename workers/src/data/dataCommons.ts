// Server-side Data Commons client (Google's open knowledge graph, the same
// infrastructure behind the UN System Data Commons: https://data.un.org).
//
// The Data Commons REST v2 API is free but needs an API key, which must NOT ship
// in the browser bundle — so the frontend calls this through the Worker proxy in
// index.ts, which holds DATA_COMMONS_API_KEY and caches responses. This module
// is pure (fetch in, typed values out) so it can be unit-tested without the key.
//
// Variables here are chosen to COMPLEMENT src/data/worldbank.ts (which already
// covers GDP/pop/tax/spend/unemployment), not duplicate it. DCIDs were verified
// live against country/USA + all-countries before being hard-coded.

const OBSERVATION_URL = 'https://api.datacommons.org/v2/observation';

/** Our stable indicator keys -> Data Commons statistical-variable DCIDs. */
export const DC_VARIABLES = {
  life_expectancy:   'LifeExpectancy_Person',                   // years
  gini_index:        'GiniIndex_EconomicActivity',              // 0-100 (higher = more unequal)
  co2_per_capita:    'Amount_Emissions_CarbonDioxide_PerCapita',// tonnes / person / year
  internet_users:    'Count_Person_IsInternetUser_PerCapita',   // % of population
  energy_per_capita: 'Amount_Consumption_Energy_PerCapita',     // kg oil-equivalent / person
  extreme_poverty:   'sdg/SI_POV_DAY1',                         // % below $2.15/day
} as const;

export type DcKey = keyof typeof DC_VARIABLES;
export type DcIndicators = Record<DcKey, number | null>;

const DCID_TO_KEY: Record<string, DcKey> = Object.fromEntries(
  (Object.entries(DC_VARIABLES) as [DcKey, string][]).map(([k, dcid]) => [dcid, k]),
) as Record<string, DcKey>;

// ── Response shape (only the parts we read) ─────────────────────────────────
interface DcObservation { date?: string; value?: number }
interface DcFacet { observations?: DcObservation[] }
interface DcEntity { orderedFacets?: DcFacet[] }
interface DcVariable { byEntity?: Record<string, DcEntity> }
interface DcResponse { byVariable?: Record<string, DcVariable> }

/**
 * The most-preferred latest value for an entity, or null. Data Commons orders
 * facets by source preference, so the first facet's first observation is the
 * value the platform itself would surface.
 */
function latestValue(entity: DcEntity | undefined): number | null {
  const obs = entity?.orderedFacets?.[0]?.observations?.[0]?.value;
  return typeof obs === 'number' ? obs : null;
}

async function postObservation(body: unknown, apiKey: string): Promise<DcResponse> {
  const res = await fetch(OBSERVATION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Data Commons ${res.status}`);
  return (await res.json()) as DcResponse;
}

/** Map a Data Commons observation response to our keyed indicators, for one country. */
export function parseCountryIndicators(json: DcResponse, entityDcid: string): DcIndicators {
  const out = emptyIndicators();
  for (const [dcid, variable] of Object.entries(json.byVariable ?? {})) {
    const key = DCID_TO_KEY[dcid];
    if (key) out[key] = latestValue(variable.byEntity?.[entityDcid]);
  }
  return out;
}

/** Map an all-countries response to `{ ISO3 -> value }` for one variable (choropleth). */
export function parseGlobalValues(json: DcResponse, dcid: string): Record<string, number> {
  const out: Record<string, number> = {};
  const byEntity = json.byVariable?.[dcid]?.byEntity ?? {};
  for (const [entityDcid, entity] of Object.entries(byEntity)) {
    const iso3 = entityDcid.replace(/^country\//, '');
    const v = latestValue(entity);
    if (iso3.length === 3 && v !== null) out[iso3] = v;
  }
  return out;
}

function emptyIndicators(): DcIndicators {
  return Object.fromEntries(
    (Object.keys(DC_VARIABLES) as DcKey[]).map(k => [k, null]),
  ) as DcIndicators;
}

/** All complementary indicators for a single country (one API call). */
export async function fetchCountryIndicators(iso3: string, apiKey: string): Promise<DcIndicators> {
  const entityDcid = `country/${iso3}`;
  const json = await postObservation(
    {
      date: 'LATEST',
      select: ['value', 'date', 'entity', 'variable'],
      variable: { dcids: Object.values(DC_VARIABLES) },
      entity: { dcids: [entityDcid] },
    },
    apiKey,
  );
  return parseCountryIndicators(json, entityDcid);
}

/** One indicator for every country (one API call) — for the choropleth. */
export async function fetchGlobalIndicator(key: DcKey, apiKey: string): Promise<Record<string, number>> {
  const dcid = DC_VARIABLES[key];
  const json = await postObservation(
    {
      date: 'LATEST',
      select: ['value', 'date', 'entity', 'variable'],
      variable: { dcids: [dcid] },
      entity: { expression: 'Earth<-containedInPlace+{typeOf:Country}' },
    },
    apiKey,
  );
  return parseGlobalValues(json, dcid);
}
