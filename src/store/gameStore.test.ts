import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeSupabaseMock, type QueryRecord, type QueryResult } from '../test/supabaseMock'

// gameStore reads VITE_AI_PROXY_URL (via workerApi) and the supabase client at
// import time, so each test re-imports it with fresh mocks.

let respond: (q: QueryRecord) => QueryResult
let calls: QueryRecord[]

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_AI_PROXY_URL', 'https://api.example.com')
  respond = () => ({ data: null })
  const mock = makeSupabaseMock(q => respond(q))
  calls = mock.calls
  vi.doMock('../lib/supabase', () => ({ supabase: mock.client }))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.doUnmock('../lib/supabase')
})

const fork = { worldId: 'fork-1', countryCode: 'IND', year: 2026, createdAt: '2026-08-01T00:00:00.000Z' }

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  }
}

async function loadStore() {
  const { useGameStore } = await import('./gameStore')
  useGameStore.getState().enterFork(fork)
  return useGameStore
}

describe('simulateYear', () => {
  it('loops on next_cursor until null, reports who reacted, and advances the fork a year', async () => {
    const reacting = ['USA', 'CHN', 'PAK', 'GBR', 'RUS']
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        year: 2026, reacting, next_cursor: 3,
        results: [
          { country_code: 'USA', status: 'ok' },
          { country_code: 'CHN', status: 'ok' },
          { country_code: 'PAK', status: 'error', error: 'model timeout' },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        year: 2026, reacting, next_cursor: null,
        results: [{ country_code: 'GBR', status: 'ok' }, { country_code: 'RUS', status: 'skipped' }],
      }))
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()
    const progress: unknown[] = []
    const unsub = store.subscribe(s => { if (s.simulateProgress) progress.push(s.simulateProgress) })
    await store.getState().simulateYear('jwt')
    unsub()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const bodies = fetchMock.mock.calls.map(c => JSON.parse(c[1].body))
    expect(bodies).toEqual([{ world_id: 'fork-1', cursor: 0 }, { world_id: 'fork-1', cursor: 3, year: 2026 }])
    // The server picks the player's country; the client no longer sends it.
    expect(bodies.every(b => !('player_country_code' in b))).toBe(true)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt')

    expect(progress).toContainEqual({ year: 2026, reacting, done: 3, current: ['GBR', 'RUS'] })

    const s = store.getState()
    expect(s.isSimulating).toBe(false)
    expect(s.activeFork?.year).toBe(2027)
    expect(s.resumeFrom).toBeNull()
    expect(s.lastSimulation).toMatchObject({ year: 2026, reacting, complete: true, error: null })
    expect(s.lastSimulation?.results.filter(r => r.status === 'ok').map(r => r.country_code)).toEqual(['USA', 'CHN', 'GBR'])
  })

  it('stops on a 429 with a "try again" message and does not advance the year', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { error: 'Too many', retry_after_seconds: 1800 })))
    const store = await loadStore()
    await store.getState().simulateYear('jwt')

    const s = store.getState()
    expect(s.activeFork?.year).toBe(2026)
    expect(s.lastSimulation?.complete).toBe(false)
    expect(s.lastSimulation?.error).toMatch(/try again in 30 minutes/i)
  })

  it('keeps the cursor after a mid-year failure and resumes from it next time', async () => {
    const reacting = ['USA', 'CHN', 'PAK', 'GBR']
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { year: 2026, reacting, next_cursor: 3, results: [] }))
      .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => { throw new SyntaxError('not json') } })
      .mockResolvedValueOnce(jsonResponse(200, { year: 2026, reacting, next_cursor: null, results: [{ country_code: 'GBR', status: 'ok' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()
    await store.getState().simulateYear('jwt')
    expect(store.getState().lastSimulation?.error).toMatch(/\(500\)/)
    expect(store.getState().resumeFrom).toEqual({ worldId: 'fork-1', cursor: 3, year: 2026 })
    expect(store.getState().activeFork?.year).toBe(2026)

    await store.getState().simulateYear('jwt')
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ world_id: 'fork-1', cursor: 3, year: 2026 })
    expect(store.getState().activeFork?.year).toBe(2027)
  })

  it('drops a stale resume point when the server answers 409', async () => {
    const reacting = ['USA', 'CHN', 'PAK', 'GBR']
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { year: 2026, reacting, next_cursor: 3, results: [] }))
      .mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => { throw new SyntaxError('not json') } })
      .mockResolvedValueOnce(jsonResponse(409, { error: 'Start the year with cursor 0' }))
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()
    await store.getState().simulateYear('jwt')
    await store.getState().simulateYear('jwt')
    expect(store.getState().lastSimulation?.error).toMatch(/cursor 0/)
    expect(store.getState().resumeFrom).toBeNull()
  })

  it('bails out if the server cursor does not advance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { year: 2026, reacting: ['USA'], next_cursor: 0, results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const store = await loadStore()
    await store.getState().simulateYear('jwt')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.getState().lastSimulation?.error).toMatch(/stopped making progress/)
  })
})

describe('createFork', () => {
  it('turns a fetch rejection into a message instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { useGameStore } = await import('./gameStore')
    await expect(useGameStore.getState().createFork('IND', 'jwt')).resolves.toMatch(/could not reach/i)
  })

  it('handles a non-JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 502, headers: new Headers(), json: async () => { throw new SyntaxError('<html>') },
    }))
    const { useGameStore } = await import('./gameStore')
    await expect(useGameStore.getState().createFork('IND', 'jwt')).resolves.toMatch(/\(502\)/)
  })

  it('explains a 429 rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { error: 'slow down', retry_after_seconds: 45 })))
    const { useGameStore } = await import('./gameStore')
    await expect(useGameStore.getState().createFork('IND', 'jwt')).resolves.toMatch(/try again in 45 seconds/i)
  })
})

describe('publishFork', () => {
  it('publishes through the publish_world RPC with a trimmed, capped title', async () => {
    respond = q => (q.rpc ? { data: { is_public: true, title: 'x'.repeat(80) } } : {})
    const store = await loadStore()
    const err = await store.getState().publishFork('fork-1', true, `  ${'x'.repeat(100)}  `)
    expect(err).toBeNull()
    const rpc = calls.find(c => c.rpc)!
    expect(rpc.rpc).toBe('publish_world')
    expect(rpc.args).toEqual({ p_world_id: 'fork-1', p_publish: true, p_title: 'x'.repeat(80) })
    expect(store.getState().activeFork?.isPublic).toBe(true)
    // No direct UPDATE on worlds.
    expect(calls.some(c => c.table === 'worlds')).toBe(false)
  })

  it('rolls the optimistic state back when the RPC returns an error', async () => {
    respond = q => (q.rpc ? { error: { message: 'world not found or not yours' } } : {})
    const store = await loadStore()
    const err = await store.getState().publishFork('fork-1', true, 'My world')
    expect(err).toMatch(/could not publish/i)
    expect(store.getState().activeFork?.isPublic).toBeFalsy()
    expect(store.getState().activeFork?.title).toBeUndefined()
  })
})

describe('savePolicyDraft', () => {
  it('surfaces a failed upsert and keeps the draft', async () => {
    respond = q => (q.upsert ? { error: { message: 'denied' } } : q.table === 'latest_country_states' && q.single
      ? { data: { year: 2028, indicators: { tax_rate: 20 }, policies: {} } }
      : {})
    const store = await loadStore()
    store.getState().setPolicyDraft({ tax_rate: 25 })
    const err = await store.getState().savePolicyDraft()
    expect(err).toMatch(/could not save/i)
    expect(store.getState().policyDraft).toEqual({ tax_rate: 25 })
    // Writes onto the fork's latest year, not a stale one.
    expect((calls.find(c => c.upsert)!.upsert as { year: number }).year).toBe(2028)
  })
})
