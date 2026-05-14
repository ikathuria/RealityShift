import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface RegionPolicies {
  housing:   number;  // 0–10: rent control / zoning strictness
  transport: number;  // 0–10: transit / infrastructure funding
  local_tax: number;  // 5–40: municipal tax rate %
}

export interface RegionState {
  world_id:     string;
  country_code: string;
  region_code:  string;
  region_name:  string;
  year:         number;
  population:   number | null;
  policies:     RegionPolicies;
  last_updated: string;
}

export const REGION_POLICY_DEFAULTS: RegionPolicies = {
  housing:   5,
  transport: 5,
  local_tax: 20,
};

export const SUPPORTED_DRILL_COUNTRIES = new Set([
  'IND', 'USA', 'GBR', 'DEU', 'BRA', 'CHN', 'FRA', 'AUS', 'CAN', 'JPN',
]);

interface SelectedRegion {
  code:        string;
  name:        string;
  countryCode: string;
}

interface RegionStore {
  selectedRegion: SelectedRegion | null;
  regionStates:   Record<string, RegionState>; // key: `${worldId}:${regionCode}`
  regionDraft:    Partial<RegionPolicies>;

  selectRegion:     (region: SelectedRegion | null) => void;
  loadRegion:       (regionCode: string, worldId: string) => Promise<void>;
  setRegionDraft:   (patch: Partial<RegionPolicies>) => void;
  saveRegionPolicy: (worldId: string) => Promise<void>;
}

export const useRegionStore = create<RegionStore>((set, get) => ({
  selectedRegion: null,
  regionStates:   {},
  regionDraft:    {},

  selectRegion: (region) => {
    set({ selectedRegion: region, regionDraft: {} });
    if (region) get().loadRegion(region.code, 'live');
  },

  loadRegion: async (regionCode, worldId) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('region_states')
      .select('*')
      .eq('world_id', worldId)
      .eq('region_code', regionCode)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      const row = data as RegionState;
      set(s => ({
        regionStates: {
          ...s.regionStates,
          [`${worldId}:${regionCode}`]: row,
        },
      }));
    }
  },

  setRegionDraft: (patch) =>
    set(s => ({ regionDraft: { ...s.regionDraft, ...patch } })),

  saveRegionPolicy: async (worldId) => {
    if (!supabase) return;
    const { selectedRegion, regionDraft, regionStates } = get();
    if (!selectedRegion) return;

    const key    = `${worldId}:${selectedRegion.code}`;
    const existing = regionStates[key];
    const basePolicies: RegionPolicies = existing?.policies ?? REGION_POLICY_DEFAULTS;
    const merged: RegionPolicies = { ...basePolicies, ...regionDraft };

    const upsertRow = {
      world_id:    worldId,
      country_code: selectedRegion.countryCode,
      region_code:  selectedRegion.code,
      region_name:  selectedRegion.name,
      year:         existing?.year ?? new Date().getFullYear(),
      population:   existing?.population ?? null,
      policies:     merged,
      last_updated: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('region_states')
      .upsert(upsertRow, { onConflict: 'world_id,region_code,year' })
      .select()
      .single();

    if (!error && data) {
      set(s => ({
        regionStates: { ...s.regionStates, [key]: data as RegionState },
        regionDraft:  {},
      }));
    }
  },
}));
