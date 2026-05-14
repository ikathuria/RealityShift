import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useWorldStore } from './worldStore';

const WORKER_URL = (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? '';

export interface Fork {
  worldId: string;
  countryCode: string;
  year: number;
  createdAt: string;
}

interface SimulateResult {
  country: string;
  status: 'ok' | 'error';
  error?: string;
}

interface GameStore {
  activeFork: Fork | null;
  playerForks: Fork[];
  policyDraft: Record<string, number>;
  isSimulating: boolean;
  simulateLog: SimulateResult[];

  loadPlayerForks: (userId: string) => Promise<void>;
  createFork: (countryCode: string, jwt: string) => Promise<{ worldId: string; year: number } | string>;
  enterFork: (fork: Fork) => void;
  exitFork: () => void;
  setPolicyDraft: (updates: Record<string, number>) => void;
  savePolicyDraft: () => Promise<void>;
  simulateYear: (jwt: string) => Promise<void>;
}

const INDICATOR_KEYS = new Set([
  'gdp_per_capita', 'population', 'tax_rate',
  'military_spend', 'education_spend', 'healthcare_spend', 'unemployment',
]);

export const useGameStore = create<GameStore>((set, get) => ({
  activeFork: null,
  playerForks: [],
  policyDraft: {},
  isSimulating: false,
  simulateLog: [],

  loadPlayerForks: async (userId) => {
    if (!supabase) return;
    const { data } = await supabase
      .from('worlds')
      .select('id, forked_at_year, created_at, player_country_code')
      .eq('player_id', userId)
      .eq('is_live', false)
      .order('created_at', { ascending: false });

    if (!data) return;
    const forks: Fork[] = (data as {
      id: string;
      forked_at_year: number;
      created_at: string;
      player_country_code: string;
    }[]).map(w => ({
      worldId: w.id,
      countryCode: w.player_country_code,
      year: w.forked_at_year,
      createdAt: w.created_at,
    }));
    set({ playerForks: forks });
  },

  createFork: async (countryCode, jwt) => {
    const res = await fetch(`${WORKER_URL}/api/fork/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ country_code: countryCode }),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error: string };
      return err.error ?? 'Fork creation failed';
    }

    const data = (await res.json()) as { worldId: string; year: number };
    const fork: Fork = {
      worldId: data.worldId,
      countryCode,
      year: data.year,
      createdAt: new Date().toISOString(),
    };
    set(s => ({ playerForks: [fork, ...s.playerForks] }));
    return data;
  },

  enterFork: (fork) => {
    set({ activeFork: fork, policyDraft: {}, simulateLog: [] });
    const ws = useWorldStore.getState();
    ws.setActiveWorldId(fork.worldId);
    ws.loadChoropleth();
    ws.loadCountry(fork.countryCode);
  },

  exitFork: () => {
    set({ activeFork: null, policyDraft: {}, simulateLog: [] });
    const ws = useWorldStore.getState();
    ws.setActiveWorldId('live');
    ws.loadChoropleth();
  },

  setPolicyDraft: (updates) => {
    set(s => ({ policyDraft: { ...s.policyDraft, ...updates } }));
  },

  savePolicyDraft: async () => {
    if (!supabase) return;
    const { activeFork, policyDraft } = get();
    if (!activeFork || Object.keys(policyDraft).length === 0) return;

    const indicators: Record<string, number> = {};
    const policies: Record<string, number> = {};

    for (const [k, v] of Object.entries(policyDraft)) {
      if (INDICATOR_KEYS.has(k)) indicators[k] = v;
      else policies[k] = v;
    }

    const { data: current } = await supabase
      .from('country_states')
      .select('indicators, policies')
      .eq('world_id', activeFork.worldId)
      .eq('country_code', activeFork.countryCode)
      .eq('year', activeFork.year)
      .single();

    await supabase.from('country_states').upsert({
      world_id: activeFork.worldId,
      country_code: activeFork.countryCode,
      year: activeFork.year,
      indicators: { ...(current?.indicators ?? {}), ...indicators },
      policies: { ...(current?.policies ?? {}), ...policies },
      last_updated: new Date().toISOString(),
    });

    // Reload the panel data
    await useWorldStore.getState().loadCountry(activeFork.countryCode);
  },

  simulateYear: async (jwt) => {
    const { activeFork } = get();
    if (!activeFork) return;

    // Save any pending draft first
    await get().savePolicyDraft();

    set({ isSimulating: true, simulateLog: [] });

    try {
      const res = await fetch(`${WORKER_URL}/api/fork/simulate-year`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          world_id: activeFork.worldId,
          player_country_code: activeFork.countryCode,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { results: SimulateResult[] };
        set({ simulateLog: data.results });

        // Advance fork year
        set(s => ({
          activeFork: s.activeFork
            ? { ...s.activeFork, year: s.activeFork.year + 1 }
            : null,
        }));

        // Refresh world data + events
        const ws = useWorldStore.getState();
        await ws.loadChoropleth();
        await ws.loadCountry(activeFork.countryCode);
        await ws.loadWorldEvents(activeFork.worldId, 30);
      }
    } finally {
      set({ isSimulating: false });
    }
  },
}));
