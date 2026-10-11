import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase, eqValue, type FakeHandler, type FakeQuery } from '../test/fakeSupabase.js'

let current: ReturnType<typeof fakeSupabase>
vi.mock('../lib/supabase.js', () => ({ getSupabase: () => current.client }))
vi.mock('../lib/auth.js', () => ({ authenticatePlayer: async () => 'user-1' }))
const runAgent = vi.fn()
vi.mock('../agents/runAgents.js', () => ({ runAgent: (...args: unknown[]) => runAgent(...args) }))

const { handleSimulateYear, handleForkCreate } = await import('./handlers.js')

type Body = { year: number; reacting: string[]; results: unknown[]; next_cursor: number | null; retry_after_seconds: number; [k: string]: unknown }

const WORLD = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const env = { SUPABASE_URL: 'x', SUPABASE_SERVICE_KEY: 'y' } as never

function state(code: string, year: number, gdpPc: number, pop = 1e8) {
  return { world_id: WORLD, country_code: code, year, indicators: { gdp_per_capita: gdpPc, population: pop }, policies: {}, relations: {}, agent_memory_summary: null }
}

function post(body: unknown) {
  return new Request('https://api/x', { method: 'POST', body: JSON.stringify(body), headers: { authorization: 'Bearer t' } })
}

function worldHandler(latest: ReturnType<typeof state>[], prior: ReturnType<typeof state>[], apiCalls: unknown[] = []): FakeHandler {
  return (q: FakeQuery) => {
    if (q.table === 'worlds') return { data: [{ id: WORLD, player_id: 'user-1', player_country_code: 'MEX', is_live: false }] }
    if (q.table === 'api_calls') return q.op === 'select' ? { data: apiCalls } : {}
    if (q.table === 'latest_country_states') return { data: latest }
    if (q.table === 'country_states' && q.op === 'select') return { data: prior }
    if (q.table === 'world_events') return { data: [] }
    return {}
  }
}

beforeEach(() => runAgent.mockReset())

describe('POST /api/fork/simulate-year', () => {
  // USA > CHN > JPN > RUS by total GDP; CHN already reacted this year (at 2027).
  const latest = [state('MEX', 2026, 11000), state('USA', 2026, 80000, 3e8), state('CHN', 2027, 12000, 1.4e9), state('JPN', 2026, 35000, 1.2e8), state('RUS', 2026, 12000, 1.4e8)]
  const prior = [state('CHN', 2026, 12000, 1.4e9)]

  it('processes a batch of 3 with ok / skipped / error and returns the next cursor', async () => {
    current = fakeSupabase(worldHandler(latest, prior))
    runAgent.mockImplementation(async (_w: string, code: string) =>
      code === 'JPN' ? { country_code: code, success: false, error: 'llm_failed' } : { country_code: code, success: true })

    const res = await handleSimulateYear(post({ world_id: WORLD, player_country_code: 'USA' }), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Body
    expect(body.year).toBe(2026)
    expect(body.reacting).toEqual(['USA', 'CHN', 'JPN', 'RUS'])
    expect(body.results).toEqual([
      { country_code: 'USA', status: 'ok' },
      { country_code: 'CHN', status: 'skipped' },
      { country_code: 'JPN', status: 'error', error: 'llm_failed' },
    ])
    expect(body.next_cursor).toBe(3)
    // the body's player_country_code is ignored: USA (not the player) was simulated
    expect(runAgent).toHaveBeenCalledWith(WORLD, 'USA', env, expect.objectContaining({ simYear: 2026 }))
    // rate-limit record written on the start call, player not advanced yet
    expect(current.log.some(q => q.table === 'api_calls' && q.op === 'insert')).toBe(true)
    expect(current.log.some(q => q.table === 'country_states' && q.op === 'upsert')).toBe(false)
  })

  it('on the final batch advances the player country to year + 1', async () => {
    current = fakeSupabase(worldHandler(latest, prior, [{ id: 1 }]))
    runAgent.mockResolvedValue({ country_code: 'RUS', success: true })
    const res = await handleSimulateYear(post({ world_id: WORLD, cursor: 3 }), env)
    const body = (await res.json()) as Body
    expect(body.results).toEqual([{ country_code: 'RUS', status: 'ok' }])
    expect(body.next_cursor).toBeNull()
    const adv = current.log.find(q => q.table === 'country_states' && q.op === 'upsert')
    expect(adv?.payload).toMatchObject({ country_code: 'MEX', year: 2027, world_id: WORLD })
  })

  it('rejects a continuation without a recent start', async () => {
    current = fakeSupabase(worldHandler(latest, prior, []))
    const res = await handleSimulateYear(post({ world_id: WORLD, cursor: 3 }), env)
    expect(res.status).toBe(409)
  })

  it('returns 429 with retry_after_seconds over the daily limit', async () => {
    const calls = Array.from({ length: 20 }, () => ({ created_at: new Date(Date.now() - 3600_000).toISOString() }))
    current = fakeSupabase(worldHandler(latest, prior, calls))
    const res = await handleSimulateYear(post({ world_id: WORLD }), env)
    expect(res.status).toBe(429)
    const body = (await res.json()) as Body
    expect(body.retry_after_seconds).toBeGreaterThan(80000)
    expect(res.headers.get('Retry-After')).toBe(String(body.retry_after_seconds))
    expect(runAgent).not.toHaveBeenCalled()
  })

  it('403s for someone else\'s world and 400s for a bad world id', async () => {
    current = fakeSupabase(q => (q.table === 'worlds' ? { data: [{ player_id: 'other', player_country_code: 'MEX', is_live: false }] } : {}))
    expect((await handleSimulateYear(post({ world_id: WORLD }), env)).status).toBe(403)
    expect((await handleSimulateYear(post({ world_id: 'live' }), env)).status).toBe(400)
  })
})

describe('POST /api/fork/create', () => {
  const live = [state('MEX', 2026, 11000), state('USA', 2026, 80000)].map(s => ({ ...s, world_id: 'live' }))

  it('rolls the world back when a later step fails, and hides the DB error', async () => {
    current = fakeSupabase(q => {
      if (q.table === 'api_calls') return q.op === 'select' ? { data: [] } : {}
      if (q.table === 'latest_country_states') return { data: live }
      if (q.table === 'game_sessions') return { error: { message: 'secret internal detail' } }
      return {}
    })
    const res = await handleForkCreate(post({ country_code: 'mex' }), env)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret internal detail')
    const inserted = current.log.find(q => q.table === 'worlds' && q.op === 'insert')
    const del = current.log.find(q => q.table === 'worlds' && q.op === 'delete')
    expect(del).toBeTruthy()
    expect(eqValue(del!, 'id')).toBe((inserted!.payload as { id: string }).id)
  })

  it('creates a fork from the latest live states', async () => {
    current = fakeSupabase(q => {
      if (q.table === 'api_calls') return q.op === 'select' ? { data: [] } : {}
      if (q.table === 'latest_country_states') return { data: live }
      return {}
    })
    const res = await handleForkCreate(post({ country_code: 'MEX' }), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Body
    expect(body).toMatchObject({ year: 2026, countryCode: 'MEX' })
    const copy = current.log.find(q => q.table === 'country_states' && q.op === 'insert')
    expect((copy!.payload as unknown[]).length).toBe(2)
    expect(current.log.some(q => q.table === 'worlds' && q.op === 'delete')).toBe(false)
  })

  it('limits fork creation to 5 per hour', async () => {
    const calls = Array.from({ length: 5 }, () => ({ created_at: new Date(Date.now() - 600_000).toISOString() }))
    current = fakeSupabase(q => (q.table === 'api_calls' && q.op === 'select' ? { data: calls } : {}))
    const res = await handleForkCreate(post({ country_code: 'MEX' }), env)
    expect(res.status).toBe(429)
    expect(((await res.json()) as { retry_after_seconds: number }).retry_after_seconds).toBeGreaterThan(0)
  })
})
