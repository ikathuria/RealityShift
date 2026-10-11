import { describe, it, expect } from 'vitest'
import { normalizeDivergence } from './compareState.js'
import { applyCorrection } from './publishDivergence.js'

describe('normalizeDivergence', () => {
  const ind = { gdp_per_capita: 50000, unemployment: 4 }

  it('coerces string numbers, drops non-numerics and unknown indicators, and caps corrections', () => {
    const r = normalizeDivergence(
      {
        diverged: true,
        delta: { unemployment: '1.5', gdp_per_capita: 'lots' },
        explanation: 'Unemployment is higher in reality.',
        self_correction: { unemployment: '3', gdp_per_capita: -20000, made_up: 5 },
      },
      ind,
    )
    expect(r.delta).toEqual({ unemployment: 1.5 })
    expect(r.self_correction).toEqual({ unemployment: 0.5, gdp_per_capita: -5000 })
  })

  it('returns empty maps when not diverged', () => {
    const r = normalizeDivergence({ diverged: false, delta: { unemployment: 1 }, self_correction: { unemployment: 1 } }, ind)
    expect(r).toMatchObject({ diverged: false, delta: {}, self_correction: {} })
  })
})

describe('applyCorrection', () => {
  it('adds numerically (never string-concatenates) and keeps levels non-negative', () => {
    const out = applyCorrection({ unemployment: 4, tax_rate: 0.2 }, { unemployment: '0.5', tax_rate: -1, nope: 'x' })
    expect(out.unemployment).toBe(4.5)
    expect(out.tax_rate).toBe(0)
    expect(out).not.toHaveProperty('nope')
  })
})
