import { describe, it, expect } from 'vitest'
import {
  GOVERNMENTS,
  GOV_COUNTRIES,
  BRANCH_META,
  RELATION_LABELS,
  hasGovernment,
  getGovernment,
} from './government'
import { COUNTRY_NAMES } from './countries'

describe('government lookup helpers', () => {
  it('reports membership for known and unknown codes', () => {
    expect(hasGovernment('USA')).toBe(true)
    expect(hasGovernment('ZZZ')).toBe(false)
    expect(hasGovernment(null)).toBe(false)
    expect(hasGovernment(undefined)).toBe(false)
  })

  it('returns the government for a known code and undefined otherwise', () => {
    expect(getGovernment('USA')?.countryCode).toBe('USA')
    expect(getGovernment('ZZZ')).toBeUndefined()
    expect(getGovernment(null)).toBeUndefined()
  })

  it('covers the five demo countries', () => {
    expect(GOV_COUNTRIES.sort()).toEqual(['CHN', 'GBR', 'IND', 'RUS', 'USA'])
  })
})

describe('government data integrity', () => {
  for (const [code, gov] of Object.entries(GOVERNMENTS)) {
    describe(code, () => {
      it('keys match the embedded countryCode and a known country name', () => {
        expect(gov.countryCode).toBe(code)
        expect(COUNTRY_NAMES[code]).toBeTruthy()
      })

      it('has unique node ids', () => {
        const ids = gov.nodes.map(n => n.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('uses only defined branches on every node', () => {
        for (const n of gov.nodes) {
          expect(BRANCH_META[n.branch]).toBeDefined()
          expect(n.label).toBeTruthy()
          expect(n.rank).toBeGreaterThanOrEqual(0)
        }
      })

      it('only connects edges between existing nodes with known relations', () => {
        const ids = new Set(gov.nodes.map(n => n.id))
        for (const e of gov.edges) {
          expect(ids.has(e.source)).toBe(true)
          expect(ids.has(e.target)).toBe(true)
          expect(e.source).not.toBe(e.target)
          expect(RELATION_LABELS[e.relation]).toBeDefined()
        }
      })

      it('has no fully disconnected nodes', () => {
        const connected = new Set<string>()
        for (const e of gov.edges) {
          connected.add(e.source)
          connected.add(e.target)
        }
        for (const n of gov.nodes) {
          expect(connected.has(n.id)).toBe(true)
        }
      })
    })
  }
})
