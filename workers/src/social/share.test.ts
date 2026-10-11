import { describe, it, expect } from 'vitest'
import { buildSharePage, inlineJson, parseShareWorldId, shareTitle } from './share.js'

describe('buildSharePage', () => {
  const page = buildSharePage({
    title: 'USA — a world that never happened',
    description: 'An AI wargame.',
    imageUrl: 'https://cdn.example.com/fp.png',
    canonicalUrl: 'https://site.example.com/wall/w1',
  })

  it('emits the core Open Graph and Twitter tags', () => {
    expect(page).toContain('<meta property="og:title" content="USA — a world that never happened" />')
    expect(page).toContain('<meta property="og:image" content="https://cdn.example.com/fp.png" />')
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(page).toContain('<link rel="canonical" href="https://site.example.com/wall/w1" />')
  })

  it('redirects a human visitor to the canonical SPA url', () => {
    expect(page).toContain('http-equiv="refresh"')
    expect(page).toContain('location.replace("https://site.example.com/wall/w1")')
  })

  it('escapes HTML-significant characters in text to prevent injection', () => {
    const p = buildSharePage({
      title: 'Bad <script>alert(1)</script> & "quotes"',
      description: 'x',
      imageUrl: 'https://x/y.png',
      canonicalUrl: 'https://x/wall/1',
    })
    expect(p).not.toContain('<script>alert(1)</script>')
    expect(p).toContain('&lt;script&gt;')
    expect(p).toContain('&amp;')
  })
})

describe('inline script JSON (reflected XSS)', () => {
  it('cannot break out of the <script> block', () => {
    const evil = 'https://x/wall/</script><script>alert(1)</script>'
    const p = buildSharePage({ title: 't', description: 'd', imageUrl: 'https://x/y.png', canonicalUrl: evil })
    const script = p.slice(p.indexOf('<script>location.replace('))
    expect(script).not.toContain('</script><script>')
    expect(p.match(/<script>/g)).toHaveLength(1)
    expect(p).toContain('\\u003c/script\\u003e')
  })

  it('escapes <, >, & and the U+2028/U+2029 line terminators, and stays valid JSON', () => {
    const value = 'a<b>c&d\u2028e\u2029f'
    const out = inlineJson(value)
    expect(out).not.toMatch(/[<>&\u2028\u2029]/)
    expect(JSON.parse(out)).toBe(value)
  })
})

describe('parseShareWorldId', () => {
  it('accepts live and UUIDs (normalised to lower case)', () => {
    expect(parseShareWorldId('/share/live')).toBe('live')
    expect(parseShareWorldId('/share/live/')).toBe('live')
    expect(parseShareWorldId('/share/3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
  })

  it('rejects anything else, including encoded script and bad escapes', () => {
    expect(parseShareWorldId('/share/%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E')).toBeNull()
    expect(parseShareWorldId('/share/not-a-world')).toBeNull()
    expect(parseShareWorldId('/share/%E0%A4%A')).toBeNull()
    expect(parseShareWorldId('/share/')).toBeNull()
    expect(parseShareWorldId('/share/live/extra')).toBeNull()
  })
})

describe('shareTitle', () => {
  it('prefers the world title when the owner named it', () => {
    expect(shareTitle('USA', 2026, 'My Cold War')).toBe('My Cold War — a RealityShift world')
  })
  it('builds a country/year headline otherwise', () => {
    expect(shareTitle('USA', 2026, null)).toBe('USA (forked 2026) — a world that never happened')
    expect(shareTitle('USA', null, null)).toBe('USA — a world that never happened')
  })
})
