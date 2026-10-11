import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StrictMode, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'

const fetchCountryEnrichment = vi.fn()
vi.mock('../data/dataCommons', () => ({
  fetchCountryEnrichment: (iso3: string) => fetchCountryEnrichment(iso3),
}))

import { useCountryEnrichment, resetEnrichmentCache } from './useCountryEnrichment'

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  resetEnrichmentCache()
  fetchCountryEnrichment.mockReset()
})

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>

describe('useCountryEnrichment', () => {
  it('re-renders with data under StrictMode, where the first effect is cancelled mid-fetch', async () => {
    const d = deferred<Record<string, number>>()
    fetchCountryEnrichment.mockReturnValue(d.promise)

    const { result } = renderHook(() => useCountryEnrichment('IND'), { wrapper: strict })
    expect(result.current.loading).toBe(true)

    d.resolve({ life_expectancy: 70 })
    await waitFor(() => expect(result.current.data).toEqual({ life_expectancy: 70 }))
    expect(result.current.loading).toBe(false)
    expect(fetchCountryEnrichment).toHaveBeenCalledTimes(1)
  })

  it('switching A→B→A while A is in flight still delivers A', async () => {
    const a = deferred<Record<string, number>>()
    const b = deferred<Record<string, number>>()
    fetchCountryEnrichment.mockImplementation((iso3: string) => (iso3 === 'AAA' ? a.promise : b.promise))

    const { result, rerender } = renderHook(({ iso3 }) => useCountryEnrichment(iso3), { initialProps: { iso3: 'AAA' } })
    rerender({ iso3: 'BBB' })
    rerender({ iso3: 'AAA' })

    a.resolve({ gini: 35 })
    await waitFor(() => expect(result.current.data).toEqual({ gini: 35 }))
    // The shared in-flight request is reused, not refetched.
    expect(fetchCountryEnrichment.mock.calls.filter(c => c[0] === 'AAA')).toHaveLength(1)
    b.resolve({})
  })

  it('treats a rejected fetch as "no enrichment" instead of hanging', async () => {
    fetchCountryEnrichment.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useCountryEnrichment('ZZZ'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
  })
})
