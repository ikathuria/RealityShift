import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DEMO_2026_MEDIA_ENTRIES } from '../data/demoSamples'
import { makeSupabaseMock } from '../test/supabaseMock'

// The module reads VITE_* env at load time, so each configuration is tested by
// stubbing env, resetting the module registry, and re-importing. This keeps the
// tests independent of whatever is in the developer's local .env.

const remote = {
  world_id: 'some-fork',
  count: 1,
  media: [{ sim_date: '2026-03-01', nation_iso: 'USA', kind: 'front_page', b2_url: 'x', manifest_uri: 'm', canonical_hash: 'h' }],
}

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_AI_PROXY_URL', '')
  vi.stubEnv('VITE_B2_PUBLIC_BASE', '')
  vi.stubEnv('VITE_MEDIA_INDEX_URL', '')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.doUnmock('./supabase')
})

/** Load the module with Supabase configured (a real world) or not (demo). */
async function loadModule({ supabase = true } = {}) {
  const client = supabase ? makeSupabaseMock(() => ({})).client : null
  vi.doMock('./supabase', () => ({ supabase: client }))
  return import('./mediaIndex')
}

describe('mediaIndexSources', () => {
  it('prefers the Worker endpoint, then the public bucket, then the expiring presigned URL', async () => {
    vi.stubEnv('VITE_AI_PROXY_URL', 'https://api.example.com/')
    vi.stubEnv('VITE_B2_PUBLIC_BASE', 'https://cdn.example.com/bucket/')
    vi.stubEnv('VITE_MEDIA_INDEX_URL', 'https://signed.example.com/media.json?sig=abc')
    const { mediaIndexSources } = await loadModule()
    expect(mediaIndexSources('live').map(s => s.url)).toEqual([
      'https://api.example.com/api/media/index/live',
      'https://cdn.example.com/bucket/index/live/media.json',
      'https://signed.example.com/media.json?sig=abc',
    ])
  })

  it('never uses the live-only presigned URL for a fork, and sends auth to the Worker for forks', async () => {
    vi.stubEnv('VITE_AI_PROXY_URL', 'https://api.example.com')
    vi.stubEnv('VITE_MEDIA_INDEX_URL', 'https://signed.example.com/media.json?sig=abc')
    const { mediaIndexSources } = await loadModule()
    expect(mediaIndexSources('fork-9')).toEqual([
      { url: 'https://api.example.com/api/media/index/fork-9', auth: true },
    ])
    expect(mediaIndexSources('live')[0].auth).toBe(false)
  })
})

describe('fetchMediaIndex', () => {
  it('returns no index (not demo media) for a real world when nothing is reachable', async () => {
    vi.stubEnv('VITE_AI_PROXY_URL', 'https://api.example.com')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: 'no index' }) }))
    const { fetchMediaIndex } = await loadModule()
    expect(await fetchMediaIndex('live')).toBeNull()
    expect(await fetchMediaIndex('some-fork')).toBeNull()
  })

  it('returns the flagged sample set only in the demo context', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const demoWorld = await (await loadModule()).fetchMediaIndex('2026-demo')
    expect(demoWorld?.sample).toBe(true)
    expect(demoWorld?.media).toEqual(DEMO_2026_MEDIA_ENTRIES)

    vi.resetModules()
    const noDb = await (await loadModule({ supabase: false })).fetchMediaIndex('live')
    expect(noDb?.sample).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the Worker index, sending the session Bearer for a private fork', async () => {
    vi.stubEnv('VITE_AI_PROXY_URL', 'https://api.example.com')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => remote })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchMediaIndex } = await loadModule()
    const idx = await fetchMediaIndex('some-fork')
    expect(idx?.media).toHaveLength(1)
    expect(idx?.sample).toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/api/media/index/some-fork')
    expect(init.headers.Authorization).toBe('Bearer test-token')
  })

  it('falls back to the public bucket when the Worker fails', async () => {
    vi.stubEnv('VITE_AI_PROXY_URL', 'https://api.example.com')
    vi.stubEnv('VITE_B2_PUBLIC_BASE', 'https://cdn.example.com')
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, json: async () => remote })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchMediaIndex } = await loadModule()
    const idx = await fetchMediaIndex('live')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('https://cdn.example.com/index/live/media.json')
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined()
    expect(idx?.media[0].kind).toBe('front_page')
  })
})
