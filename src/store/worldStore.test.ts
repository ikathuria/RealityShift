import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeSupabaseMock, type QueryRecord, type QueryResult } from '../test/supabaseMock'

let respond: (q: QueryRecord) => QueryResult
let calls: QueryRecord[]

beforeEach(() => {
  vi.resetModules()
  respond = () => ({ data: [] })
})
afterEach(() => vi.doUnmock('../lib/supabase'))

async function loadStore({ supabase = true } = {}) {
  const mock = makeSupabaseMock(q => respond(q))
  calls = mock.calls
  vi.doMock('../lib/supabase', () => ({ supabase: supabase ? mock.client : null }))
  const { useWorldStore } = await import('./worldStore')
  return useWorldStore
}

const row = (code: string, year: number) => ({
  world_id: 'live', country_code: code, year, indicators: { gdp_per_capita: 1000 }, policies: {}, relations: {},
  agent_memory_summary: null, last_updated: '2026-08-01T00:00:00Z',
})

describe('demo data stays out of real worlds', () => {
  it('shows an empty decision log for a curated country with no decisions, not the demo log', async () => {
    const store = await loadStore()
    await store.getState().loadCountryDecisions('USA')
    expect(store.getState().countryDecisions.USA).toEqual([])
  })

  it('shows no events for a world without events, not demo events', async () => {
    const store = await loadStore()
    await store.getState().loadWorldEvents('fork-1', 30)
    expect(store.getState().worldEvents).toEqual([])
  })

  it('lists only countries with real rows, from the latest-state view', async () => {
    respond = q => (q.table === 'latest_country_states' ? { data: [row('IND', 2026), row('USA', 2026)] } : { data: [] })
    const store = await loadStore()
    await store.getState().loadAllCountries()
    const s = store.getState()
    expect(Object.keys(s.countryData).sort()).toEqual(['IND', 'USA'])
    expect(s.countriesTracked).toBe(2)
    expect(s.allCountriesStatus).toBe('ready')
    expect(calls.every(c => c.table !== 'country_states')).toBe(true)
  })

  it('marks a country with no state as missing instead of inventing numbers', async () => {
    respond = () => ({ data: null })
    const store = await loadStore()
    await store.getState().loadCountry('FRA')
    expect(store.getState().countryData.FRA).toBeUndefined()
    expect(store.getState().countryStatus.FRA).toBe('missing')
  })

  it('counts tracked countries with a head count on the view', async () => {
    respond = q => (q.table === 'latest_country_states' ? { count: 20 } : {})
    const store = await loadStore()
    await store.getState().loadCountriesTracked('live')
    expect(store.getState().countriesTracked).toBe(20)
    expect(calls[0].selectOptions).toEqual({ count: 'exact', head: true })
  })

  it('uses the bundled samples in the demo world and when Supabase is not configured', async () => {
    const store = await loadStore()
    store.getState().setActiveWorldId('2026-demo')
    await store.getState().loadCountryDecisions('USA')
    expect(store.getState().countryDecisions.USA.length).toBeGreaterThan(0)

    vi.resetModules()
    const offline = await loadStore({ supabase: false })
    await offline.getState().loadWorldEvents('live')
    expect(offline.getState().worldEvents.length).toBeGreaterThan(0)
    expect(offline.getState().worldEvents.every(e => e.world_id === '2026-demo')).toBe(true)
  })
})
