import { describe, it, expect } from 'vitest'
import {
  applyDecision,
  normalizeDecision,
  normalizeDeltas,
  normalizeProjections,
  parseDecision,
  parseDecisionJson,
  DecisionError,
  DELTA_LIMITS,
  GDP_GROWTH_LIMIT,
} from './decision.js'

describe('parseDecisionJson', () => {
  it('accepts plain JSON, fenced JSON and JSON wrapped in prose', () => {
    expect(parseDecisionJson('{"a":1}')).toEqual({ a: 1 })
    expect(parseDecisionJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseDecisionJson('Sure! Here it is: {"a":1} hope that helps')).toEqual({ a: 1 })
  })
  it('throws DecisionError when there is no JSON object', () => {
    expect(() => parseDecisionJson('no json here')).toThrow(DecisionError)
    expect(() => parseDecisionJson('[1,2,3]')).toThrow(DecisionError)
  })
})

describe('normalizeDeltas', () => {
  it('coerces numeric strings, drops non-numerics and clamps to annual limits', () => {
    const d = normalizeDeltas({
      tax_rate_delta: '1.5',
      military_spend_delta: 40,
      education_spend_delta: 'a lot',
      healthcare_spend_delta: null,
      trade_openness_delta: -9,
      bogus_delta: 3,
    })
    expect(d).toEqual({
      tax_rate_delta: 1.5,
      military_spend_delta: DELTA_LIMITS.military_spend_delta,
      trade_openness_delta: -DELTA_LIMITS.trade_openness_delta,
    })
  })
  it('drops NaN and Infinity', () => {
    expect(normalizeDeltas({ tax_rate_delta: NaN, military_spend_delta: Infinity })).toEqual({})
  })
})

describe('normalizeProjections (percent vs fraction)', () => {
  it('keeps percent values and clamps growth to ±15', () => {
    expect(normalizeProjections({ gdp_growth_pct: 2.5, inflation_est: 3.1 })).toEqual({ gdp_growth_pct: 2.5, inflation_est: 3.1 })
    expect(normalizeProjections({ gdp_growth_pct: 80 }).gdp_growth_pct).toBe(GDP_GROWTH_LIMIT)
    expect(normalizeProjections({ gdp_growth_pct: -40 }).gdp_growth_pct).toBe(-GDP_GROWTH_LIMIT)
  })
  it('treats the block as fractions when inflation is a fraction, scaling both by 100', () => {
    const p = normalizeProjections({ gdp_growth_pct: 0.06, inflation_est: 0.03 })
    expect(p.gdp_growth_pct).toBeCloseTo(6)
    expect(p.inflation_est).toBeCloseTo(3)
  })
  it('keeps a small growth value as percent when there is no fraction signal', () => {
    expect(normalizeProjections({ gdp_growth_pct: 0.1, inflation_est: 2 }).gdp_growth_pct).toBe(0.1)
    expect(normalizeProjections({ gdp_growth_pct: 0.1 }).gdp_growth_pct).toBe(0.1)
  })
  it('clamps unemployment_delta and coerces strings', () => {
    expect(normalizeProjections({ unemployment_delta: '12' }).unemployment_delta).toBe(5)
    expect(normalizeProjections({ unemployment_delta: 'up' })).toEqual({})
  })
})

describe('normalizeDecision', () => {
  it('validates events, relations, and text fields', () => {
    const d = normalizeDecision(
      {
        policies_adjusted: { tax_rate_delta: 0.5 },
        reasoning: 'Because.\u0000',
        historical_parallel: 'null',
        projected_indicators: { gdp_growth_pct: '2.0' },
        events: [
          { type: 'sanction', target: 'chn', details: 'Tariffs on steel.' },
          { type: 'conflict_risk', target: 'RUS', details: 'not allowed from the LLM' },
          { type: 'trade_deal', target: 'USA', details: 'self target dropped' },
          { type: 'trade_deal', target: 'not-a-code', details: 'global' },
          { type: 'diplomatic_protest', details: '' },
          { type: 'alliance_formed', details: 'fourth valid event is over the cap' },
          { type: 'alliance_broken', details: 'over the cap' },
        ],
        relations_update: { chn: 'Rival', RUS: 'frenemy', 'X; drop': 'ally', USA: 'ally', DEU: 'ally' },
      },
      'USA',
    )
    expect(d.reasoning).toBe('Because.')
    expect(d.historical_parallel).toBeNull()
    expect(d.projected_indicators.gdp_growth_pct).toBe(2)
    expect(d.events).toEqual([
      { type: 'sanction', target: 'CHN', details: 'Tariffs on steel.' },
      { type: 'trade_deal', details: 'self target dropped' },
      { type: 'trade_deal', details: 'global' },
    ])
    expect(d.relations_update).toEqual({ CHN: 'rival', DEU: 'ally' })
  })

  it('tolerates a completely malformed object', () => {
    const d = parseDecision('{"policies_adjusted": "nope", "events": "x", "relations_update": [1]}', 'USA')
    expect(d.policies_adjusted).toEqual({})
    expect(d.events).toEqual([])
    expect(d.relations_update).toEqual({})
    expect(d.reasoning).toBeTruthy()
  })
})

describe('applyDecision', () => {
  const base = { tax_rate: 20, military_spend: 99.5, education_spend: 0.2, healthcare_spend: 8, gdp_per_capita: 10000, unemployment: 1 }

  it('applies annual growth once (not /12) and moves spending levels', () => {
    const { indicators } = applyDecision(base, {}, {
      policies_adjusted: { tax_rate_delta: 1 },
      projected_indicators: { gdp_growth_pct: 5 },
    })
    expect(indicators.gdp_per_capita).toBeCloseTo(10500)
    expect(indicators.tax_rate).toBe(21)
  })

  it('keeps %-of-GDP levels within [0, 100] and unemployment >= 0', () => {
    const { indicators } = applyDecision(base, {}, {
      policies_adjusted: { military_spend_delta: 1.5, education_spend_delta: -1 },
      projected_indicators: { unemployment_delta: -5 },
    })
    expect(indicators.military_spend).toBe(100)
    expect(indicators.education_spend).toBe(0)
    expect(indicators.unemployment).toBe(0)
  })

  it('merges policies: keeps player levels and applies trade_openness_delta to the level', () => {
    const { policies } = applyDecision(base, { trade_openness: 9.5, press_freedom: 3, active_tags: ['x'], tax_rate_delta: 0.2 }, {
      policies_adjusted: { trade_openness_delta: 1 },
      projected_indicators: {},
    })
    expect(policies).toEqual({ trade_openness: 10, press_freedom: 3, active_tags: ['x'] })
  })

  it('starts trade_openness from the 0-10 midpoint when unset', () => {
    const { policies } = applyDecision(base, {}, { policies_adjusted: { trade_openness_delta: -0.5 }, projected_indicators: {} })
    expect(policies.trade_openness).toBe(4.5)
  })

  it('does not mutate its inputs', () => {
    const ind = { ...base }
    const pol = { trade_openness: 5 }
    applyDecision(ind, pol, { policies_adjusted: { tax_rate_delta: 1, trade_openness_delta: 1 }, projected_indicators: { gdp_growth_pct: 3 } })
    expect(ind).toEqual(base)
    expect(pol).toEqual({ trade_openness: 5 })
  })
})
