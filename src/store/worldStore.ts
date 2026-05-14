import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface CountryState {
  world_id: string;
  country_code: string;
  year: number;
  indicators: Record<string, number>;
  policies: Record<string, unknown>;
  relations: Record<string, string>;
  agent_memory_summary: string | null;
  last_updated: string;
}

export type ChoroplethMode = 'gdp_per_capita' | 'military_spend' | 'unemployment' | 'education_spend' | 'healthcare_spend';

interface WorldStore {
  selectedCountry: string | null;
  countryData: Record<string, CountryState>;
  choroplethMode: ChoroplethMode;
  choroplethValues: Map<string, number>;

  selectCountry: (iso3: string | null) => void;
  loadCountry: (iso3: string) => Promise<void>;
  setChoroplethMode: (mode: ChoroplethMode) => void;
  loadChoropleth: () => Promise<void>;
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  selectedCountry: null,
  countryData: {},
  choroplethMode: 'gdp_per_capita',
  choroplethValues: new Map(),

  selectCountry: (iso3) => {
    set({ selectedCountry: iso3 });
    if (iso3 && !get().countryData[iso3]) {
      get().loadCountry(iso3);
    }
  },

  loadCountry: async (iso3) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('country_states')
      .select('*')
      .eq('world_id', 'live')
      .eq('country_code', iso3)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      set(s => ({
        countryData: { ...s.countryData, [iso3]: data as CountryState },
      }));
    }
  },

  setChoroplethMode: (mode) => {
    set({ choroplethMode: mode });
    get().loadChoropleth();
  },

  loadChoropleth: async () => {
    if (!supabase) return;
    const mode = get().choroplethMode;

    // Fetch the relevant indicator for all countries from Supabase
    const { data, error } = await supabase
      .from('country_states')
      .select(`country_code, indicators`)
      .eq('world_id', 'live');

    if (error || !data) return;

    const values = new Map<string, number>();
    for (const row of data as CountryState[]) {
      const val = row.indicators[mode];
      if (typeof val === 'number') values.set(row.country_code, val);
    }
    set({ choroplethValues: values });
  },
}));
