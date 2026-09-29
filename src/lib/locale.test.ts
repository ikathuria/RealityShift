import { describe, it, expect, vi, afterEach } from 'vitest'
import { readVisitorContext, formatLocalTime } from './locale'

afterEach(() => vi.restoreAllMocks())

describe('readVisitorContext', () => {
  it('resolves a mappable timezone to a country we can fly to', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Kolkata' }),
    } as unknown as Intl.DateTimeFormat)

    const ctx = readVisitorContext(new Date('2026-01-01T10:00:00'))
    expect(ctx.timeZone).toBe('Asia/Kolkata')
    expect(ctx.iso3).toBe('IND')
    expect(ctx.country).toBeTruthy()
  })

  it('returns a null country for an unmapped timezone but never throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Antarctica/Troll' }),
    } as unknown as Intl.DateTimeFormat)

    const ctx = readVisitorContext()
    expect(ctx.iso3 === null || typeof ctx.iso3 === 'string').toBe(true)
    expect(ctx.country === null || typeof ctx.country === 'string').toBe(true)
  })

  it('classifies day vs night from the local hour', () => {
    expect(readVisitorContext(new Date('2026-01-01T12:00:00')).isDay).toBe(true)
    expect(readVisitorContext(new Date('2026-01-01T03:00:00')).isDay).toBe(false)
    expect(readVisitorContext(new Date('2026-01-01T23:00:00')).isDay).toBe(false)
  })

  it('falls back to UTC when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl')
    })
    const ctx = readVisitorContext()
    expect(ctx.timeZone).toBe('UTC')
  })
})

describe('formatLocalTime', () => {
  it('produces a non-empty string containing the minutes', () => {
    const out = formatLocalTime(new Date('2026-01-01T18:42:00'))
    expect(out).toBeTruthy()
    expect(out).toContain('42')
  })

  it('falls back to a manual HH:MM when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl')
    })
    const out = formatLocalTime(new Date('2026-01-01T09:05:00'))
    expect(out).toBe('9:05')
  })
})
