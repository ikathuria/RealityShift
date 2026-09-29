import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  DC_KEYS,
  DC_INDICATOR_META,
  fetchCountryEnrichment,
  fetchGlobalEnrichment,
} from './dataCommons'

// The client no-ops without a proxy origin; give it one for these tests.
vi.stubEnv('VITE_AI_PROXY_URL', 'http://worker.test')

afterEach(() => vi.restoreAllMocks())

describe('indicator metadata', () => {
  it('has matching metadata for every key', () => {
    for (const key of DC_KEYS) {
      expect(DC_INDICATOR_META[key]).toBeDefined()
      expect(DC_INDICATOR_META[key].label).toBeTruthy()
    }
  })
})

describe('fetchCountryEnrichment', () => {
  it('returns the indicators object from the proxy', async () => {
    const indicators = { life_expectancy: 78.4, gini_index: 41.8, co2_per_capita: 13.6, internet_users: 93.1, energy_per_capita: 6363, extreme_poverty: null }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ indicators }), { status: 200 })))
    const out = await fetchCountryEnrichment('USA')
    expect(out).toEqual(indicators)
  })

  it('returns null when the proxy reports it is unconfigured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ indicators: null, reason: 'not_configured' }), { status: 200 })))
    expect(await fetchCountryEnrichment('USA')).toBeNull()
  })

  it('returns null on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 502 })))
    expect(await fetchCountryEnrichment('USA')).toBeNull()
  })

  it('returns null (never throws) on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await fetchCountryEnrichment('USA')).toBeNull()
  })

  it('URL-encodes the iso3 into the query', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      void url
      return new Response(JSON.stringify({ indicators: {} }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await fetchCountryEnrichment('USA')
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/datacommons/country?iso3=USA')
  })
})

describe('fetchGlobalEnrichment', () => {
  it('maps the values object into a Map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ values: { USA: 78.4, IND: 72 } }), { status: 200 })))
    const out = await fetchGlobalEnrichment('life_expectancy')
    expect(out.get('USA')).toBe(78.4)
    expect(out.get('IND')).toBe(72)
  })

  it('returns an empty Map on failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })))
    expect((await fetchGlobalEnrichment('life_expectancy')).size).toBe(0)
  })
})
