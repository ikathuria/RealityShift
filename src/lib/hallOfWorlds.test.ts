import { describe, it, expect } from 'vitest'
import { mapPublicWorld, defaultTitle } from './hallOfWorlds'

describe('defaultTitle', () => {
  it('uses the country and fork year when available', () => {
    expect(defaultTitle('USA', 2026)).toBe('USA — forked 2026')
  })
  it('degrades gracefully with missing pieces', () => {
    expect(defaultTitle(null, 2026)).toBe('a nation — forked 2026')
    expect(defaultTitle('IND', null)).toBe('IND — a forked world')
    expect(defaultTitle(null, null)).toBe('a nation — a forked world')
  })
})

describe('mapPublicWorld', () => {
  const base = {
    id: 'w1',
    player_country_code: 'USA',
    title: '  My Cold War  ',
    forked_at_year: 2026,
    published_at: '2026-06-01T00:00:00Z',
    created_at: '2026-05-01T00:00:00Z',
  }

  it('maps fields and trims a provided title', () => {
    const w = mapPublicWorld(base)
    expect(w).toEqual({
      worldId: 'w1',
      countryCode: 'USA',
      title: 'My Cold War',
      forkedAtYear: 2026,
      publishedAt: '2026-06-01T00:00:00Z',
      createdAt: '2026-05-01T00:00:00Z',
    })
  })

  it('falls back to a default title when none/blank is given', () => {
    expect(mapPublicWorld({ ...base, title: null }).title).toBe('USA — forked 2026')
    expect(mapPublicWorld({ ...base, title: '   ' }).title).toBe('USA — forked 2026')
  })
})
