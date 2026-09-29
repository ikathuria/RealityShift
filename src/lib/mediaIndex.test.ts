import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEMO_2026_MEDIA_ENTRIES } from '../data/demoSamples'

// The module reads VITE_* env at load time, so each configuration is tested by
// stubbing env, resetting the module registry, and re-importing. This keeps the
// tests independent of whatever is in the developer's local .env.

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllEnvs())

async function loadModule() {
  return import('./mediaIndex')
}

describe('mediaIndexUrl', () => {
  it('builds a same-origin index path when no B2 base and no presigned URL are set', async () => {
    vi.stubEnv('VITE_MEDIA_INDEX_URL', '')
    vi.stubEnv('VITE_B2_PUBLIC_BASE', '')
    const { mediaIndexUrl } = await loadModule()
    expect(mediaIndexUrl('live')).toBe('/index/live/media.json')
    expect(mediaIndexUrl('fork-123')).toBe('/index/fork-123/media.json')
  })

  it('constructs a public-bucket URL from VITE_B2_PUBLIC_BASE, trimming a trailing slash', async () => {
    vi.stubEnv('VITE_MEDIA_INDEX_URL', '')
    vi.stubEnv('VITE_B2_PUBLIC_BASE', 'https://cdn.example.com/bucket/')
    const { mediaIndexUrl } = await loadModule()
    expect(mediaIndexUrl('fork-9')).toBe('https://cdn.example.com/bucket/index/fork-9/media.json')
  })

  it('returns the presigned index URL for the live world when one is set', async () => {
    vi.stubEnv('VITE_MEDIA_INDEX_URL', 'https://signed.example.com/media.json?sig=abc')
    vi.stubEnv('VITE_B2_PUBLIC_BASE', '')
    const { mediaIndexUrl } = await loadModule()
    expect(mediaIndexUrl('live')).toBe('https://signed.example.com/media.json?sig=abc')
  })
})

describe('fetchMediaIndex', () => {
  it('returns the bundled demo samples for the live world with no presigned URL', async () => {
    vi.stubEnv('VITE_MEDIA_INDEX_URL', '')
    const { fetchMediaIndex } = await loadModule()
    const idx = await fetchMediaIndex('live')
    expect(idx).not.toBeNull()
    expect(idx!.world_id).toBe('live')
    expect(idx!.count).toBe(DEMO_2026_MEDIA_ENTRIES.length)
    expect(idx!.media.length).toBeGreaterThan(0)
  })

  it('falls back to demo samples when a remote fetch fails', async () => {
    vi.stubEnv('VITE_MEDIA_INDEX_URL', 'https://signed.example.com/media.json?sig=abc')
    vi.stubEnv('VITE_B2_PUBLIC_BASE', '')
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchMediaIndex } = await loadModule()
    const idx = await fetchMediaIndex('some-fork')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(idx!.media).toEqual(DEMO_2026_MEDIA_ENTRIES)

    vi.unstubAllGlobals()
  })

  it('uses a valid remote index when the fetch succeeds', async () => {
    vi.stubEnv('VITE_MEDIA_INDEX_URL', 'https://signed.example.com/media.json?sig=abc')
    vi.stubEnv('VITE_B2_PUBLIC_BASE', '')
    const remote = {
      world_id: 'some-fork',
      count: 1,
      media: [{ sim_date: '2026-03-01', nation_iso: 'USA', kind: 'front_page', b2_url: 'x', manifest_uri: 'm', canonical_hash: 'h' }],
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => remote })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchMediaIndex } = await loadModule()
    const idx = await fetchMediaIndex('some-fork')
    expect(idx!.media).toHaveLength(1)
    expect(idx!.media[0].kind).toBe('front_page')

    vi.unstubAllGlobals()
  })
})
