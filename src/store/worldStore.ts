import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { isDemoWorld } from '../lib/demo';
import {
  DEMO_2026_REALITY_STATES,
  DEMO_2026_AGENT_DECISIONS,
  DEMO_2026_WORLD_EVENTS,
} from '../data/demoSamples';

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

/**
 * Per-country load state, so a panel can tell "still loading" apart from
 * "this world has no simulated state for that country" and "the request failed".
 */
export type CountryStatus = 'loading' | 'ready' | 'missing' | 'error';

/** Load state of the all-countries table/leaderboard. */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

// The view returns exactly one row (the latest year) per (world, country), so
// "current state" reads never pull every year and never hit PostgREST's
// 1000-row cap.
const LATEST_STATES = 'latest_country_states';

interface WorldStore {
  // Globe / country state
  selectedCountry: string | null;
  countryData: Record<string, CountryState>;
  countryStatus: Record<string, CountryStatus>;
  allCountriesStatus: LoadStatus;
  /** Which world_id to query — 'live' by default; overridden when in a fork game */
  activeWorldId: string;

  // Divergence dashboard
  recentDivergences: Divergence[];
  countryDecisions: Record<string, AgentDecision[]>;

  // World events feed
  worldEvents: WorldEvent[];

  /** Distinct countries present in the active world. Null until loaded. */
  countriesTracked: number | null;

  /** True once the globe has geometry on screen. Lets other surfaces avoid
   *  showing instructions that point at an empty canvas. */
  globeReady: boolean;

  // Globe visual feedback
  pulseCountry: string | null;

  // Actions
  selectCountry: (iso3: string | null) => void;
  loadCountry: (iso3: string) => Promise<void>;
  loadAllCountries: () => Promise<void>;
  setActiveWorldId: (worldId: string) => void;
  setPulseCountry: (iso3: string | null) => void;
  loadRecentDivergences: (limit?: number) => Promise<void>;
  loadCountryDecisions: (iso3: string) => Promise<void>;
  loadWorldEvents: (worldId?: string, limit?: number) => Promise<void>;
  loadCountriesTracked: (worldId?: string) => Promise<void>;
  setGlobeReady: (ready: boolean) => void;
}

export const useWorldStore = create<WorldStore>((set, get) => ({
  selectedCountry: null,
  countryData: {},
  countryStatus: {},
  allCountriesStatus: 'idle',
  activeWorldId: 'live',
  recentDivergences: [],
  countryDecisions: {},
  worldEvents: [],
  countriesTracked: null,
  globeReady: false,
  pulseCountry: null,

  setPulseCountry: (iso3) => set({ pulseCountry: iso3 }),

  selectCountry: (iso3) => {
    set({ selectedCountry: iso3 });
    if (iso3) {
      get().loadCountry(iso3);
      get().loadCountryDecisions(iso3);
    }
  },

  loadCountry: async (iso3) => {
    const worldId = get().activeWorldId;
    const setStatus = (status: CountryStatus, row?: CountryState) => {
      // Drop the answer if the player switched worlds while it was in flight.
      if (get().activeWorldId !== worldId) return;
      set(s => ({
        countryStatus: { ...s.countryStatus, [iso3]: status },
        ...(row ? { countryData: { ...s.countryData, [iso3]: row } } : {}),
      }));
    };

    if (!supabase || isDemoWorld(worldId)) {
      const demo = DEMO_2026_REALITY_STATES[iso3];
      setStatus(demo ? 'ready' : 'missing', demo);
      return;
    }

    if (!get().countryData[iso3]) setStatus('loading');
    try {
      const { data, error } = await supabase
        .from(LATEST_STATES)
        .select('*')
        .eq('world_id', worldId)
        .eq('country_code', iso3)
        .maybeSingle();
      if (error) setStatus(get().countryData[iso3] ? 'ready' : 'error');
      else if (!data) setStatus('missing');
      else setStatus('ready', data as CountryState);
    } catch {
      setStatus(get().countryData[iso3] ? 'ready' : 'error');
    }
  },

  loadAllCountries: async () => {
    const worldId = get().activeWorldId;

    if (!supabase || isDemoWorld(worldId)) {
      const map = { ...DEMO_2026_REALITY_STATES };
      set({
        countryData: map,
        countryStatus: Object.fromEntries(Object.keys(map).map(c => [c, 'ready' as const])),
        countriesTracked: Object.keys(map).length,
        allCountriesStatus: 'ready',
      });
      return;
    }

    set({ allCountriesStatus: 'loading' });
    try {
      const { data, error } = await supabase
        .from(LATEST_STATES)
        .select('*')
        .eq('world_id', worldId);
      if (get().activeWorldId !== worldId) return;
      if (error || !data) {
        set({ allCountriesStatus: 'error' });
        return;
      }
      // Only real rows. Countries this world has no state for are simply absent,
      // so tables and rankings never show made-up numbers as if they were real.
      const map: Record<string, CountryState> = {};
      for (const row of data as CountryState[]) map[row.country_code] = row;
      set({
        countryData: map,
        countryStatus: Object.fromEntries(Object.keys(map).map(c => [c, 'ready' as const])),
        countriesTracked: Object.keys(map).length,
        allCountriesStatus: 'ready',
      });
    } catch {
      if (get().activeWorldId === worldId) set({ allCountriesStatus: 'error' });
    }
  },

  setActiveWorldId: (worldId) => {
    if (worldId === get().activeWorldId) return;
    set({
      activeWorldId: worldId,
      countryData: {},
      countryStatus: {},
      countryDecisions: {},
      worldEvents: [],
      countriesTracked: null,
      allCountriesStatus: 'idle',
    });
  },

  setGlobeReady: (ready) => set({ globeReady: ready }),

  loadCountriesTracked: async (worldId) => {
    const id = worldId ?? get().activeWorldId;
    if (!supabase || isDemoWorld(id)) {
      set({ countriesTracked: Object.keys(DEMO_2026_REALITY_STATES).length });
      return;
    }
    // One row per country in the view, so an exact head count is the number of
    // distinct countries — no rows are transferred.
    const { count, error } = await supabase
      .from(LATEST_STATES)
      .select('country_code', { count: 'exact', head: true })
      .eq('world_id', id);
    if (error || count === null) return;
    set({ countriesTracked: count });
  },

  loadRecentDivergences: async (limit = 50) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('divergences')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error || !data) return;
    set({ recentDivergences: data as Divergence[] });
  },

  loadCountryDecisions: async (iso3) => {
    const worldId = get().activeWorldId;
    const put = (rows: AgentDecision[]) => {
      if (get().activeWorldId !== worldId) return;
      set(s => ({ countryDecisions: { ...s.countryDecisions, [iso3]: rows } }));
    };

    if (!supabase || isDemoWorld(worldId)) {
      put(DEMO_2026_AGENT_DECISIONS[iso3] ?? []);
      return;
    }
    const { data, error } = await supabase
      .from('agent_decisions')
      .select('*')
      .eq('world_id', worldId)
      .eq('country_code', iso3)
      .order('year', { ascending: false })
      .limit(20);

    // An empty list renders as "no decisions yet"; never as someone else's log.
    put(!error && data ? (data as AgentDecision[]) : []);
  },

  loadWorldEvents: async (worldId = 'live', limit = 40) => {
    if (!supabase || isDemoWorld(worldId)) {
      set({ worldEvents: DEMO_2026_WORLD_EVENTS.slice(0, limit) });
      return;
    }
    const { data, error } = await supabase
      .from('world_events')
      .select('*')
      .eq('world_id', worldId)
      .order('sim_year', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    // A world with no events shows an empty feed, not sample events.
    set({ worldEvents: !error && data ? (data as WorldEvent[]) : [] });
  },
}));
