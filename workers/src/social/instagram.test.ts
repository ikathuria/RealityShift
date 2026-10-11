import { describe, it, expect, vi, afterEach } from 'vitest'
import { instagramConfigured, buildCaption, postToInstagram, sanitizeCaptionText } from './instagram.js'

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

describe('caption sanitisation', () => {
  it('strips control characters, folds newlines and caps the title at 80 chars', () => {
    const t = sanitizeCaptionText('Hello\u0000\u202e world\n\nline two ' + 'x'.repeat(200))
    // eslint-disable-next-line no-control-regex
    expect(t).not.toMatch(/[\u0000-\u001f\u202e\n]/)
    expect(t.length).toBeLessThanOrEqual(80)
    expect(t.startsWith('Hello world line two')).toBe(true)
  })

  it('neutralises @mentions, #hashtags and links', () => {
    const t = sanitizeCaptionText('Follow @evil #spam at https://evil.example/x and evil.com')
    expect(t).not.toContain('@')
    expect(t).not.toContain('#')
    expect(t).not.toContain('https://')
    expect(t).not.toContain('evil.com')
    expect(t).toContain('[link]')
  })

  it('a hostile title cannot inject extra caption lines or hashtags', () => {
    const cap = buildCaption({ country: 'USA', worldTitle: 'Mine\n#ad @brand' })
    const first = cap.split('\n')[0]
    expect(first).toContain('Mine')
    expect(first).not.toContain('#')
    expect(first).not.toContain('@')
  })

  it('says "live world" instead of a cutoff for the live world', () => {
    const cap = buildCaption({ country: 'USA', cutoff: null, liveWorld: true })
    expect(cap).toContain('Live world')
    expect(cap).not.toContain('No real-world data after')
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
