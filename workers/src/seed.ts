// One-shot seed: fetches World Bank indicators for all countries and upserts
// into country_states for world_id='live'. Exposed as POST /api/seed.
// Safe to re-run — upserts on (world_id, country_code, year).

import { getSupabase } from './lib/supabase.js';

const CURRENT_YEAR = new Date().getFullYear();

// World Bank indicator codes
const WB_INDICATORS = {
  gdp_per_capita:   'NY.GDP.PCAP.CD',   // current USD
  population:       'SP.POP.TOTL',
  tax_rate:         'GC.TAX.TOTL.GD.ZS', // % of GDP
  military_spend:   'MS.MIL.XPND.GD.ZS', // % of GDP
  education_spend:  'SE.XPD.TOTL.GD.ZS', // % of GDP
  healthcare_spend: 'SH.XPD.CHEX.GD.ZS', // % of GDP
  unemployment:     'SL.UEM.TOTL.ZS',    // % of labor force
} as const;

type IndicatorKey = keyof typeof WB_INDICATORS;

interface WBResponse {
  page:    number;
  pages:   number;
  total:   number;
  per_page: number;
}

interface WBDataPoint {
  countryiso3code: string;
  date: string;
  value: number | null;
  country: { id: string; value: string };
}

// Fetch all countries for one indicator in a single request (mrv=5 looks back
// up to 5 years to find the most recent non-null value per country).
async function fetchIndicator(
  code: string
): Promise<Map<string, number>> {
  const url =
    `https://api.worldbank.org/v2/country/all/indicator/${code}` +
    `?format=json&mrv=5&per_page=500`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`World Bank API error for ${code}: ${res.status}`);

  const [, data] = (await res.json()) as [WBResponse, WBDataPoint[]];
  if (!Array.isArray(data)) return new Map();

  // Keep only the most recent non-null value per country
  const latest = new Map<string, number>();
  for (const point of data) {
    const iso3 = point.countryiso3code;
    if (!iso3 || point.value === null) continue;
    if (!latest.has(iso3)) {
      latest.set(iso3, point.value);
    }
  }
  return latest;
}

export async function runSeed(supabaseUrl: string, serviceKey: string): Promise<{ seeded: number; errors: string[] }> {
  const db = getSupabase(supabaseUrl, serviceKey);
  const errors: string[] = [];

  // Fetch all indicators in parallel
  const results = await Promise.allSettled(
    Object.entries(WB_INDICATORS).map(async ([key, code]) => ({
      key: key as IndicatorKey,
      data: await fetchIndicator(code),
    }))
  );

  // Merge into a single map: iso3 → indicators{}
  const byCountry = new Map<string, Record<string, number>>();
  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(String(result.reason));
      continue;
    }
    const { key, data } = result.value;
    for (const [iso3, value] of data) {
      if (!byCountry.has(iso3)) byCountry.set(iso3, {});
      byCountry.get(iso3)![key] = value;
    }
  }

  // Filter to real countries (iso3 codes are 3 uppercase letters; WB also
  // returns aggregates like "WLD", "EUU" — skip those with no GDP data)
  const rows = Array.from(byCountry.entries())
    .filter(([iso3, ind]) => /^[A-Z]{3}$/.test(iso3) && ind.gdp_per_capita !== undefined)
    .map(([country_code, indicators]) => ({
      world_id: 'live',
      country_code,
      year: CURRENT_YEAR,
      indicators,
      policies: {},
      relations: {},
      last_updated: new Date().toISOString(),
    }));

  // Upsert in batches of 50
  const BATCH = 50;
  let seeded = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await db.from('country_states').upsert(batch, {
      onConflict: 'world_id,country_code,year',
    });
    if (error) {
      errors.push(`Batch ${i / BATCH}: ${error.message}`);
    } else {
      seeded += batch.length;
    }
  }

  return { seeded, errors };
}
