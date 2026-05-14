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

export interface Divergence {
  id: number;
  country_code: string;
  sim_year: number;
  real_date: string;
  sim_state: Record<string, number>;
  delta: Record<string, number>;
  narrative: string;
  published_at: string;
}

export interface AgentDecision {
  id: number;
  world_id: string;
  country_code: string;
  year: number;
  decision: Record<string, number>;
  reasoning: string;
  historical_parallel: { name: string; similarity_score: number | null } | null;
  projected_indicators: Record<string, number>;
  created_at: string;
}

export interface WorldEvent {
  id: number;
  world_id: string;
  from_country: string;
  to_country: string | null;
  event_type: string;
  details: string;
  sim_year: number;
  created_at: string;
}

export type ChoroplethMode =
  | 'gdp_per_capita'
  | 'military_spend'
  | 'unemployment'
  | 'education_spend'
  | 'healthcare_spend'
  | 'divergence';

interface WorldStore {
  // Globe / country state
  selectedCountry: string | null;
  countryData: Record<string, CountryState>;
  choroplethMode: ChoroplethMode;
  choroplethValues: Map<string, number>;
  /** Which world_id to query — 'live' by default; overridden when in a fork game */
  activeWorldId: string;

  // Divergence dashboard
  recentDivergences: Divergence[];
  divergenceMagnitudes: Map<string, number>; // iso3 → max absolute delta sum
  countryDecisions: Record<string, AgentDecision[]>;

  // World events feed
  worldEvents: WorldEvent[];

  // Actions
  selectCountry: (iso3: string | null) => void;
  loadCountry: (iso3: string) => Promise<void>;
  setChoroplethMode: (mode: ChoroplethMode) => void;
  setActiveWorldId: (worldId: string) => void;
  loadChoropleth: () => Promise<void>;
  loadRecentDivergences: (limit?: number) => Promise<void>;
  loadCountryDecisions: (iso3: string) => Promise<void>;
  loadWorldEvents: (worldId?: string, limit?: number) => Promise<void>;
}

/** Sum of absolute values in a delta object — proxy for "how diverged is this country" */
function deltaMagnitude(delta: Record<string, number>): number {
  return Object.values(delta).reduce((acc, v) => acc + Math.abs(v), 0);
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  selectedCountry: null,
  countryData: {},
  choroplethMode: 'gdp_per_capita',
  choroplethValues: new Map(),
  activeWorldId: 'live',
  recentDivergences: [],
  divergenceMagnitudes: new Map(),
  countryDecisions: {},
  worldEvents: [],

  selectCountry: (iso3) => {
    set({ selectedCountry: iso3 });
    if (iso3) {
      get().loadCountry(iso3);
      get().loadCountryDecisions(iso3);
    }
  },

  loadCountry: async (iso3) => {
    if (!supabase) return;
    const worldId = get().activeWorldId;
    const { data, error } = await supabase
      .from('country_states')
      .select('*')
      .eq('world_id', worldId)
      .eq('country_code', iso3)
      .order('year', { ascending: false })
      .limit(1)
      .single();
    if (!error && data) {
      set(s => ({ countryData: { ...s.countryData, [iso3]: data as CountryState } }));
    }
  },

  setChoroplethMode: (mode) => {
    set({ choroplethMode: mode });
    get().loadChoropleth();
  },

  setActiveWorldId: (worldId) => {
    set({ activeWorldId: worldId, countryData: {}, countryDecisions: {} });
  },

  loadChoropleth: async () => {
    if (!supabase) return;
    const mode = get().choroplethMode;
    const worldId = get().activeWorldId;

    if (mode === 'divergence' && worldId === 'live') {
      // Use pre-loaded divergence magnitudes (live world only)
      set({ choroplethValues: new Map(get().divergenceMagnitudes) });
      return;
    }

    const { data, error } = await supabase
      .from('country_states')
      .select('country_code, indicators')
      .eq('world_id', worldId);

    if (error || !data) return;

    const values = new Map<string, number>();
    for (const row of data as CountryState[]) {
      const val = row.indicators[mode === 'divergence' ? 'gdp_per_capita' : mode];
      if (typeof val === 'number') values.set(row.country_code, val);
    }
    set({ choroplethValues: values });
  },

  loadRecentDivergences: async (limit = 50) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('divergences')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error || !data) return;

    const divs = data as Divergence[];

    // Build per-country magnitude map (max magnitude per country from recent records)
    const magnitudes = new Map<string, number>();
    for (const d of divs) {
      const mag = deltaMagnitude(d.delta);
      const prev = magnitudes.get(d.country_code) ?? 0;
      if (mag > prev) magnitudes.set(d.country_code, mag);
    }

    set({ recentDivergences: divs, divergenceMagnitudes: magnitudes });

    // If we're currently in divergence choropleth mode, refresh the globe colours
    if (get().choroplethMode === 'divergence') {
      set({ choroplethValues: new Map(magnitudes) });
    }
  },

  loadCountryDecisions: async (iso3) => {
    if (!supabase) return;
    const worldId = get().activeWorldId;
    const { data, error } = await supabase
      .from('agent_decisions')
      .select('*')
      .eq('world_id', worldId)
      .eq('country_code', iso3)
      .order('year', { ascending: false })
      .limit(20);

    if (!error && data) {
      set(s => ({ countryDecisions: { ...s.countryDecisions, [iso3]: data as AgentDecision[] } }));
    }
  },

  loadWorldEvents: async (worldId = 'live', limit = 40) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('world_events')
      .select('*')
      .eq('world_id', worldId)
      .order('sim_year', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error && data) {
      set({ worldEvents: data as WorldEvent[] });
    }
  },
}));
