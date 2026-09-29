import { describe, it, expect } from 'vitest'
import {
  countryName,
  NUMERIC_TO_ISO3,
  COUNTRY_NAMES,
  COUNTRY_CENTROIDS,
  GLOBE_COUNTRIES,
} from './countries'

describe('countryName', () => {
  it('returns "World" for null/undefined/empty', () => {
    expect(countryName(null)).toBe('World')
    expect(countryName(undefined)).toBe('World')
    expect(countryName('')).toBe('World')
  })

  it('resolves a known ISO3 to its display name', () => {
    expect(countryName('USA')).toBe(COUNTRY_NAMES['USA'])
    expect(countryName('USA')).toBeTruthy()
  })

  it('falls back to the raw code for an unknown ISO3', () => {
    expect(countryName('ZZZ')).toBe('ZZZ')
  })
})

describe('country data integrity', () => {
  it('maps every numeric code to a non-empty ISO3', () => {
    for (const [num, iso3] of Object.entries(NUMERIC_TO_ISO3)) {
      expect(num).toMatch(/^\d+$/)
      expect(iso3).toMatch(/^[A-Z]{3}$/)
    }
  })

  it('has valid [lon, lat] centroids in range for every entry', () => {
    for (const [iso3, [lon, lat]] of Object.entries(COUNTRY_CENTROIDS)) {
      expect(iso3).toMatch(/^[A-Z]{3}$/)
      expect(lon).toBeGreaterThanOrEqual(-180)
      expect(lon).toBeLessThanOrEqual(180)
      expect(lat).toBeGreaterThanOrEqual(-90)
      expect(lat).toBeLessThanOrEqual(90)
    }
  })

  it('builds a name-sorted, de-duplicated globe country list', () => {
    expect(GLOBE_COUNTRIES.length).toBeGreaterThan(100)
    const names = GLOBE_COUNTRIES.map(c => c.name)
    expect([...names]).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    for (const c of GLOBE_COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{3}$/)
      expect(c.name).toBeTruthy()
    }
  })
})
