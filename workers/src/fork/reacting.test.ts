import { describe, it, expect } from 'vitest'
import { computeReactingSet, nextCursor, MAX_REACTING, type ReactingState } from './reacting.js'

function st(code: string, gdpPc: number, pop: number, relations: Record<string, string> = {}): [string, ReactingState] {
  return [code, { country_code: code, indicators: { gdp_per_capita: gdpPc, population: pop }, relations }]
}

const curated = ['USA', 'CHN', 'RUS', 'IND', 'GBR', 'DEU', 'FRA', 'JPN', 'BRA', 'AUS', 'CAN', 'KOR', 'MEX', 'IDN', 'TUR']

const states = new Map<string, ReactingState>([
  st('USA', 80000, 330e6),
  st('CHN', 12000, 1400e6),
  st('JPN', 35000, 125e6),
  st('DEU', 50000, 83e6),
  st('IND', 2500, 1400e6),
  st('GBR', 45000, 67e6),
  st('FRA', 42000, 68e6),
  st('BRA', 9000, 215e6),
  st('CAN', 52000, 39e6),
  st('RUS', 12000, 144e6, { MEX: 'rival' }),
  st('KOR', 33000, 52e6),
  st('AUS', 60000, 26e6),
  st('IDN', 4800, 275e6),
  st('TUR', 10000, 85e6),
  st('MEX', 11000, 128e6, { TUR: 'enemy' }),
  st('NGA', 2000, 220e6),
])

describe('computeReactingSet', () => {
  it('puts related countries first, then event counterparts, then GDP fill, capped and without the player', () => {
    const set = computeReactingSet('MEX', states, [{ from_country: 'IDN', to_country: 'MEX' }], curated)
    expect(set).toHaveLength(MAX_REACTING)
    expect(set).not.toContain('MEX')
    // Tier 1: MEX's own relation (TUR) and others' relation to MEX (RUS), by GDP
    expect(set.slice(0, 2)).toEqual(['RUS', 'TUR'])
    // Tier 2: event counterpart
    expect(set[2]).toBe('IDN')
    // Tier 3: largest economies
    expect(set[3]).toBe('USA')
    expect(set[4]).toBe('CHN')
    // non-curated countries never react
    expect(set).not.toContain('NGA')
  })

  it('is deterministic and ignores invalid relation values / keys', () => {
    const odd = new Map(states)
    odd.set('MEX', { country_code: 'MEX', indicators: {}, relations: { TUR: 'bestie', 'DROP TABLE': 'enemy' } })
    const a = computeReactingSet('MEX', odd, [], curated)
    const b = computeReactingSet('MEX', odd, [], curated)
    expect(a).toEqual(b)
    expect(a[0]).toBe('RUS') // RUS still lists MEX as a rival
  })

  it('skips countries with no state in the fork', () => {
    const small = new Map([...states].filter(([k]) => ['MEX', 'USA', 'CHN'].includes(k)))
    expect(computeReactingSet('MEX', small, [], curated)).toEqual(['USA', 'CHN'])
  })
})

describe('nextCursor', () => {
  it('advances by 3 and ends with null', () => {
    expect(nextCursor(0, 12)).toBe(3)
    expect(nextCursor(9, 12)).toBeNull()
    expect(nextCursor(0, 2)).toBeNull()
    expect(nextCursor(0, 0)).toBeNull()
  })
})
