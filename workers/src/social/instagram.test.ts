import { describe, it, expect, vi, afterEach } from 'vitest'
import { instagramConfigured, buildCaption, postToInstagram } from './instagram.js'

afterEach(() => vi.restoreAllMocks())

describe('instagramConfigured', () => {
  it('is true only when both id and token are present', () => {
    expect(instagramConfigured({ IG_USER_ID: '1', IG_ACCESS_TOKEN: 't' })).toBe(true)
    expect(instagramConfigured({ IG_USER_ID: '1' })).toBe(false)
    expect(instagramConfigured({ IG_ACCESS_TOKEN: 't' })).toBe(false)
    expect(instagramConfigured({})).toBe(false)
  })
})

describe('buildCaption', () => {
  it('includes country, provenance cutoff, and hashtags within IG limits', () => {
    const cap = buildCaption({ country: 'USA', simDate: '2026-06-01', cutoff: '2026-01-01', worldTitle: null })
    expect(cap).toContain('USA')
    expect(cap).toContain('2026-01-01')
    expect(cap).toContain('#RealityShift')
    expect(cap.length).toBeLessThanOrEqual(2200)
  })

  it('leads with the world title when provided', () => {
    expect(buildCaption({ country: 'USA', worldTitle: 'My Cold War' })).toContain('My Cold War')
  })
})

describe('postToInstagram', () => {
  it('skips (does not post) when credentials are absent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const res = await postToInstagram({}, { imageUrl: 'https://x/y.png', caption: 'hi' })
    expect(res).toEqual({ ok: false, skipped: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('creates a container then publishes it when configured', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-9' }) })
    vi.stubGlobal('fetch', fetchMock)

    const res = await postToInstagram(
      { IG_USER_ID: '123', IG_ACCESS_TOKEN: 'tok' },
      { imageUrl: 'https://x/y.png', caption: 'hi' },
    )
    expect(res.ok).toBe(true)
    expect(res.mediaId).toBe('media-9')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('/123/media')
    expect(fetchMock.mock.calls[1][0]).toContain('/123/media_publish')

    vi.unstubAllGlobals()
  })

  it('returns an error when the Graph API rejects', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid token' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await postToInstagram(
      { IG_USER_ID: '123', IG_ACCESS_TOKEN: 'bad' },
      { imageUrl: 'https://x/y.png', caption: 'hi' },
    )
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Invalid token')

    vi.unstubAllGlobals()
  })
})
