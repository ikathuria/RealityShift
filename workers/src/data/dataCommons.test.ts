import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  DC_VARIABLES,
  parseCountryIndicators,
  parseGlobalValues,
  fetchCountryIndicators,
  fetchGlobalIndicator,
} from './dataCommons.js'

afterEach(() => vi.restoreAllMocks())

// A trimmed real-shape response for country/USA.
const countryResponse = {
  byVariable: {
    LifeExpectancy_Person: {
      byEntity: {
        'country/USA': { orderedFacets: [{ observations: [{ date: '2023', value: 78.38 }] }] },
      },
    },
    GiniIndex_EconomicActivity: {
      byEntity: {
        'country/USA': {
          // Multiple facets — the first (most preferred) wins.
          orderedFacets: [
            { observations: [{ date: '2023', value: 41.8 }] },
            { observations: [{ date: '2019', value: 39.0 }] },
          ],
        },
      },
    },
    // Present in the graph but no observation for this entity.
    'sdg/SI_POV_DAY1': { byEntity: { 'country/USA': { orderedFacets: [] } } },
  },
}

describe('parseCountryIndicators', () => {
  it('extracts the first facet/observation value per known variable', () => {
    const out = parseCountryIndicators(countryResponse, 'country/USA')
    expect(out.life_expectancy).toBe(78.38)
    expect(out.gini_index).toBe(41.8) // preferred facet, not the 39.0 fallback
  })

  it('yields null for variables with no observation', () => {
    const out = parseCountryIndicators(countryResponse, 'country/USA')
    expect(out.extreme_poverty).toBeNull()
  })

  it('returns null for every key when the response is empty', () => {
    const out = parseCountryIndicators({}, 'country/USA')
    for (const k of Object.keys(DC_VARIABLES)) {
      expect(out[k as keyof typeof DC_VARIABLES]).toBeNull()
    }
  })

  it('is null when the requested entity is absent', () => {
    const out = parseCountryIndicators(countryResponse, 'country/IND')
    expect(out.life_expectancy).toBeNull()
  })
})

describe('parseGlobalValues', () => {
  const globalResponse = {
    byVariable: {
      LifeExpectancy_Person: {
        byEntity: {
          'country/USA': { orderedFacets: [{ observations: [{ date: '2023', value: 78.38 }] }] },
          'country/IND': { orderedFacets: [{ observations: [{ date: '2023', value: 72.0 }] }] },
          'country/XXX': { orderedFacets: [] }, // no value -> dropped
          'wikidataId/Q30': { orderedFacets: [{ observations: [{ value: 1 }] }] }, // non-country -> dropped
        },
      },
    },
  }

  it('maps country/<ISO3> entities to a plain ISO3 -> value record', () => {
    const out = parseGlobalValues(globalResponse, 'LifeExpectancy_Person')
    expect(out).toEqual({ USA: 78.38, IND: 72.0 })
  })

  it('drops entities without a numeric value and non-3-letter codes', () => {
    const out = parseGlobalValues(globalResponse, 'LifeExpectancy_Person')
    expect(out.XXX).toBeUndefined()
    expect(Object.keys(out)).not.toContain('Q30')
  })
})

describe('fetch wrappers', () => {
  it('fetchCountryIndicators posts the right body and passes the key header', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      void init
      return new Response(JSON.stringify(countryResponse), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await fetchCountryIndicators('USA', 'test-key')
    expect(out.life_expectancy).toBe(78.38)

    const init = fetchMock.mock.calls[0][1]!
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'X-API-Key': 'test-key' })
    const body = JSON.parse(init.body!)
    expect(body.date).toBe('LATEST')
    expect(body.entity.dcids).toEqual(['country/USA'])
    expect(body.variable.dcids).toContain('LifeExpectancy_Person')
  })

  it('fetchGlobalIndicator uses the all-countries entity expression', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
      void init
      return new Response(
        JSON.stringify({
          byVariable: {
            [DC_VARIABLES.life_expectancy]: {
              byEntity: { 'country/USA': { orderedFacets: [{ observations: [{ value: 78 }] }] } },
            },
          },
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const out = await fetchGlobalIndicator('life_expectancy', 'k')
    expect(out).toEqual({ USA: 78 })
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body!)
    expect(body.entity.expression).toContain('containedInPlace')
  })

  it('throws on a non-OK upstream status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 429 })))
    await expect(fetchCountryIndicators('USA', 'k')).rejects.toThrow('429')
  })
})
