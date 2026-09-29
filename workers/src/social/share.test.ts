import { describe, it, expect } from 'vitest'
import { buildSharePage, shareTitle } from './share.js'

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

describe('shareTitle', () => {
  it('prefers the world title when the owner named it', () => {
    expect(shareTitle('USA', 2026, 'My Cold War')).toBe('My Cold War — a RealityShift world')
  })
  it('builds a country/year headline otherwise', () => {
    expect(shareTitle('USA', 2026, null)).toBe('USA (forked 2026) — a world that never happened')
    expect(shareTitle('USA', null, null)).toBe('USA — a world that never happened')
  })
})
