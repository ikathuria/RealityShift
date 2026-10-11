import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { postWorker, type WorkerResult } from '../lib/workerApi';
import { useWorldStore } from './worldStore';

export interface Fork {
  worldId: string;
  countryCode: string;
  /** The fork's current simulated year (the player's latest country_states year). */
  year: number;
  createdAt: string;
  isPublic?: boolean;
  title?: string | null;
}

/** Matches PublishToHall's input and the publish_world RPC's server-side trim. */
export const WORLD_TITLE_MAX = 80;

export interface SimulateCountryResult {
  country_code: string;
  status: 'ok' | 'error' | 'skipped';
  error?: string;
}

interface SimulateYearResponse {
  year: number;
  reacting: string[];
  results: SimulateCountryResult[];
  next_cursor: number | null;
}

/** Live progress while a year is being simulated, chunk by chunk. */
export interface SimulateProgress {
  year: number | null;
  /** Countries reacting this year; null until the first chunk reports them. */
  reacting: string[] | null;
  /** How many of `reacting` have been processed so far. */
  done: number;
  /** The countries in the chunk currently being simulated. */
  current: string[];
}

/** Outcome of the last simulate-year run, for an honest "who reacted" list. */
export interface SimulateSummary {
  year: number | null;
  reacting: string[];
  results: SimulateCountryResult[];
  complete: boolean;
  error: string | null;
}

export type OpenForkResult =
  | { status: 'ok'; fork: Fork }
  | { status: 'not_found' }
  | { status: 'forbidden'; isPublic: boolean }
  | { status: 'error'; error: string };

interface GameStore {
  activeFork: Fork | null;
  policyDraft: Record<string, number>;
  isSimulating: boolean;
  simulateProgress: SimulateProgress | null;
  lastSimulation: SimulateSummary | null;
  /** Where to pick up if a year stopped partway (e.g. a network blip). */
  /** Where a partly simulated year stopped; `year` pins the retry to that year. */
  resumeFrom: { worldId: string; cursor: number; year: number | null } | null;

  openFork: (worldId: string, userId: string) => Promise<OpenForkResult>;
  createFork: (countryCode: string, jwt: string) => Promise<{ worldId: string; year: number } | string>;
  enterFork: (fork: Fork) => void;
  exitFork: () => void;
  setPolicyDraft: (updates: Record<string, number>) => void;
  /** Returns an error message, or null on success (or when there is nothing to save). */
  savePolicyDraft: () => Promise<string | null>;
  simulateYear: (jwt: string) => Promise<void>;
  /** Returns an error message, or null on success. */
  publishFork: (worldId: string, isPublic: boolean, title?: string) => Promise<string | null>;
}

const INDICATOR_KEYS = new Set([
  'gdp_per_capita', 'population', 'tax_rate',
  'military_spend', 'education_spend', 'healthcare_spend', 'unemployment',
]);

// Each simulate-year call handles at most 3 countries and the reacting set is
// capped at 12, so a healthy year takes ~4 calls. The guard stops a buggy
// cursor from looping forever.
const MAX_SIMULATE_CALLS = 20;

interface WorldRow {
  id: string;
  player_id: string | null;
  is_live: boolean;
  forked_at_year: number;
  created_at: string;
  player_country_code: string | null;
  is_public: boolean | null;
  title: string | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  activeFork: null,
  policyDraft: {},
  isSimulating: false,
  simulateProgress: null,
  lastSimulation: null,
  resumeFrom: null,

  openFork: async (worldId, userId) => {
    if (!supabase) return { status: 'error', error: 'Forks need the database, which is not configured.' };
    const { data, error } = await supabase
      .from('worlds')
      .select('id, player_id, is_live, forked_at_year, created_at, player_country_code, is_public, title')
      .eq('id', worldId)
      .maybeSingle();
    if (error) return { status: 'error', error: 'Could not load this world. Try reloading.' };
    // RLS hides other players' private forks, so "not yours" and "missing" look
    // the same from here unless the fork was published.
    if (!data) return { status: 'not_found' };
    const w = data as WorldRow;
    if (w.is_live || w.player_id !== userId || !w.player_country_code) {
      return { status: 'forbidden', isPublic: !!w.is_public };
    }

    // The fork's current year is the player's latest simulated year, not the
    // year it was forked at.
    const { data: latest } = await supabase
      .from('latest_country_states')
      .select('year')
      .eq('world_id', worldId)
      .eq('country_code', w.player_country_code)
      .maybeSingle();

    return {
      status: 'ok',
      fork: {
        worldId: w.id,
        countryCode: w.player_country_code,
        year: (latest as { year: number } | null)?.year ?? w.forked_at_year,
        createdAt: w.created_at,
        isPublic: !!w.is_public,
        title: w.title,
      },
    };
  },

  publishFork: async (worldId, isPublic, title) => {
    if (!supabase) return 'Publishing needs the database, which is not configured.';
    const before = get().activeFork;
    const cleanTitle = title?.trim().slice(0, WORLD_TITLE_MAX) || null;
    const patch = (fork: Fork | null, next: Partial<Fork>) =>
      fork && fork.worldId === worldId ? { ...fork, ...next } : fork;

    // Optimistic so the toggle feels instant; rolled back below on failure.
    set(s => ({
      activeFork: patch(s.activeFork, { isPublic, ...(isPublic ? { title: cleanTitle } : {}) }),
    }));

    const { data, error } = await supabase
      .rpc('publish_world', { p_world_id: worldId, p_publish: isPublic, p_title: cleanTitle })
      .maybeSingle();

    if (error || !data) {
      set(s => ({ activeFork: before && s.activeFork?.worldId === worldId ? before : s.activeFork }));
      return isPublic
        ? 'Could not publish this world. Check you are still signed in and try again.'
        : 'Could not make this world private. Try again.';
    }

    const row = data as { is_public: boolean; title: string | null };
    set(s => ({ activeFork: patch(s.activeFork, { isPublic: row.is_public, title: row.title }) }));
    return null;
  },

  createFork: async (countryCode, jwt) => {
    const res = await postWorker<{ worldId: string; year: number }>(
      '/api/fork/create',
      { country_code: countryCode },
      jwt,
    );
    if (!res.ok) return res.error;
    if (!res.data?.worldId) return 'The game server did not return a world. Try again.';
    return { worldId: res.data.worldId, year: res.data.year };
  },

  enterFork: (fork) => {
    set({ activeFork: fork, policyDraft: {}, simulateProgress: null, lastSimulation: null });
    const ws = useWorldStore.getState();
    ws.setActiveWorldId(fork.worldId);
    ws.loadCountry(fork.countryCode);
  },

  exitFork: () => {
    set({ activeFork: null, policyDraft: {}, simulateProgress: null, lastSimulation: null });
    useWorldStore.getState().setActiveWorldId('live');
  },

  setPolicyDraft: (updates) => {
    set(s => ({ policyDraft: { ...s.policyDraft, ...updates } }));
  },

  savePolicyDraft: async () => {
    const { activeFork, policyDraft } = get();
    if (!activeFork || Object.keys(policyDraft).length === 0) return null;
    if (!supabase) return 'Saving needs the database, which is not configured.';

    const indicators: Record<string, number> = {};
    const policies: Record<string, number> = {};
    for (const [k, v] of Object.entries(policyDraft)) {
      if (INDICATOR_KEYS.has(k)) indicators[k] = v;
      else policies[k] = v;
    }

    // Write onto the latest year, whatever it is now.
    const { data: current, error: readError } = await supabase
      .from('latest_country_states')
      .select('year, indicators, policies')
      .eq('world_id', activeFork.worldId)
      .eq('country_code', activeFork.countryCode)
      .maybeSingle();
    if (readError) return 'Could not read your country’s current state, so nothing was saved. Try again.';

    const cur = current as { year: number; indicators: Record<string, number>; policies: Record<string, unknown> } | null;
    const { error } = await supabase.from('country_states').upsert(
      {
        world_id: activeFork.worldId,
        country_code: activeFork.countryCode,
        year: cur?.year ?? activeFork.year,
        indicators: { ...(cur?.indicators ?? {}), ...indicators },
        policies: { ...(cur?.policies ?? {}), ...policies },
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'world_id,country_code,year' },
    );
    if (error) return 'Could not save your policy draft. Your changes are still here; try again.';

    set({ policyDraft: {} });
    await useWorldStore.getState().loadCountry(activeFork.countryCode);
    return null;
  },

  simulateYear: async (jwt) => {
    const fork = get().activeFork;
    if (!fork || get().isSimulating) return;

    set({ isSimulating: true, simulateProgress: { year: null, reacting: null, done: 0, current: [] } });

    // Save any pending draft first, so the year runs on the player's choices.
    const saveError = await get().savePolicyDraft();
    if (saveError) {
      set({
        isSimulating: false,
        simulateProgress: null,
        lastSimulation: { year: null, reacting: [], results: [], complete: false, error: saveError },
      });
      return;
    }

    const resume = get().resumeFrom;
    const resuming = resume?.worldId === fork.worldId;
    let cursor: number | null = resuming ? resume.cursor : 0;
    // Once known, every call names the year it belongs to, so a resumed batch can
    // never spill into the next year if the server already finished this one.
    let year: number | null = resuming ? resume.year : null;
    let reacting: string[] = [];
    const results: SimulateCountryResult[] = [];
    let error: string | null = null;

    for (let calls = 0; cursor !== null; calls++) {
      if (calls >= MAX_SIMULATE_CALLS) {
        error = 'The simulation stopped making progress. Try again in a moment.';
        break;
      }
      const res: WorkerResult<SimulateYearResponse> = await postWorker<SimulateYearResponse>(
        '/api/fork/simulate-year',
        year === null ? { world_id: fork.worldId, cursor } : { world_id: fork.worldId, cursor, year },
        jwt,
      );
      if (!res.ok) {
        error = res.error;
        // 409 on a resumed batch: the server no longer recognises this year
        // (session expired or the year moved on), so the next click starts fresh.
        if (res.status === 409 && cursor !== 0) set({ resumeFrom: null });
        break;
      }

      const data: SimulateYearResponse = res.data;
      year = data.year;
      reacting = Array.isArray(data.reacting) ? data.reacting : [];
      results.push(...(Array.isArray(data.results) ? data.results : []));

      const next: number | null = typeof data.next_cursor === 'number' ? data.next_cursor : null;
      if (next !== null && next <= cursor) {
        error = 'The simulation stopped making progress. Try again in a moment.';
        break;
      }
      cursor = next;
      set({
        resumeFrom: cursor === null ? null : { worldId: fork.worldId, cursor, year },
        simulateProgress: {
          year,
          reacting,
          done: cursor ?? reacting.length,
          current: cursor === null ? [] : reacting.slice(cursor, cursor + 3),
        },
      });
    }

    const complete = cursor === null && !error;
    set(s => ({
      isSimulating: false,
      simulateProgress: null,
      lastSimulation: { year, reacting, results, complete, error },
      // Once the year completes the server has moved the whole fork to year+1.
      activeFork: complete && year !== null && s.activeFork?.worldId === fork.worldId
        ? { ...s.activeFork, year: year + 1 }
        : s.activeFork,
    }));

    if (results.length || complete) {
      const ws = useWorldStore.getState();
      await Promise.all([
        ws.loadCountry(fork.countryCode),
        ws.loadWorldEvents(fork.worldId, 30),
      ]);
    }
  },
}));
