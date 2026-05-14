// Typed World Bank API client for the frontend.
// Each function returns the most recent available value for a country.

const BASE = 'https://api.worldbank.org/v2/country';

export interface CountryIndicators {
  gdp_per_capita:   number | null; // current USD
  population:       number | null;
  tax_rate:         number | null; // % of GDP
  military_spend:   number | null; // % of GDP
  education_spend:  number | null; // % of GDP
  healthcare_spend: number | null; // % of GDP
  unemployment:     number | null; // % of labor force
}

const CODES: Record<keyof CountryIndicators, string> = {
  gdp_per_capita:   'NY.GDP.PCAP.CD',
  population:       'SP.POP.TOTL',
  tax_rate:         'GC.TAX.TOTL.GD.ZS',
  military_spend:   'MS.MIL.XPND.GD.ZS',
  education_spend:  'SE.XPD.TOTL.GD.ZS',
  healthcare_spend: 'SH.XPD.CHEX.GD.ZS',
  unemployment:     'SL.UEM.TOTL.ZS',
};

interface WBPoint {
  date: string;
  value: number | null;
}

async function fetchOne(iso3: string, indicator: string): Promise<number | null> {
  const url = `${BASE}/${iso3}/indicator/${indicator}?format=json&mrv=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const [, data] = (await res.json()) as [unknown, WBPoint[] | null];
  if (!Array.isArray(data)) return null;
  const found = data.find(d => d.value !== null);
  return found?.value ?? null;
}

// Fetch all 7 indicators for a single country in parallel.
export async function fetchCountryIndicators(iso3: string): Promise<CountryIndicators> {
  const entries = Object.entries(CODES) as [keyof CountryIndicators, string][];
  const results = await Promise.all(
    entries.map(([key, code]) => fetchOne(iso3, code).then(v => [key, v] as const))
  );
  return Object.fromEntries(results) as unknown as CountryIndicators;
}

// Fetch a single indicator for all countries (used for choropleth).
export async function fetchAllCountriesIndicator(
  key: keyof CountryIndicators
): Promise<Map<string, number>> {
  const code = CODES[key];
  const url = `${BASE}/all/indicator/${code}?format=json&mrv=5&per_page=500`;
  const res = await fetch(url);
  if (!res.ok) return new Map();
  const [, data] = (await res.json()) as [unknown, (WBPoint & { countryiso3code: string })[] | null];
  if (!Array.isArray(data)) return new Map();

  const latest = new Map<string, number>();
  for (const point of data) {
    if (!point.countryiso3code || point.value === null) continue;
    if (!latest.has(point.countryiso3code)) {
      latest.set(point.countryiso3code, point.value);
    }
  }
  return latest;
}
