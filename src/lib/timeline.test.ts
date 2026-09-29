import { describe, it, expect } from 'vitest'
import { buildTimeline, divergenceMagnitude, cumulativeMagnitude } from './timeline'
import type { Divergence } from '../store/worldStore'

function div(partial: Partial<Divergence>): Divergence {
  return {
    id: 1,
    country_code: 'USA',
    sim_year: 2026,
    real_date: '2026-01-01',
    sim_state: {},
    delta: {},
    narrative: '',
    published_at: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('divergenceMagnitude', () => {
  it('sums absolute values of the delta', () => {
    expect(divergenceMagnitude(div({ delta: { gdp: 3, mil: -2 } }))).toBe(5)
    expect(divergenceMagnitude(div({ delta: {} }))).toBe(0)
  })
})

describe('buildTimeline', () => {
  it('returns an empty array for no divergences', () => {
    expect(buildTimeline([])).toEqual([])
  })

  it('buckets by sim_year in ascending order', () => {
    const steps = buildTimeline([
      div({ id: 1, sim_year: 2028 }),
      div({ id: 2, sim_year: 2026 }),
      div({ id: 3, sim_year: 2027 }),
    ])
    expect(steps.map(s => s.year)).toEqual([2026, 2027, 2028])
  })

  it('orders items within a year by descending magnitude', () => {
    const steps = buildTimeline([
      div({ id: 1, sim_year: 2026, delta: { a: 1 } }),
      div({ id: 2, sim_year: 2026, delta: { a: 9 } }),
      div({ id: 3, sim_year: 2026, delta: { a: 4 } }),
    ])
    expect(steps).toHaveLength(1)
    expect(steps[0].items.map(d => d.id)).toEqual([2, 3, 1])
    expect(steps[0].magnitude).toBe(14)
  })

  it('omits years with no divergences (only steps where something happened)', () => {
    const steps = buildTimeline([
      div({ id: 1, sim_year: 2026 }),
      div({ id: 2, sim_year: 2030 }),
    ])
    expect(steps.map(s => s.year)).toEqual([2026, 2030])
  })
})

describe('cumulativeMagnitude', () => {
  it('accumulates magnitude up to and including the given index', () => {
    const steps = buildTimeline([
      div({ id: 1, sim_year: 2026, delta: { a: 2 } }),
      div({ id: 2, sim_year: 2027, delta: { a: 3 } }),
      div({ id: 3, sim_year: 2028, delta: { a: 5 } }),
    ])
    expect(cumulativeMagnitude(steps, 0)).toBe(2)
    expect(cumulativeMagnitude(steps, 1)).toBe(5)
    expect(cumulativeMagnitude(steps, 2)).toBe(10)
  })
})
