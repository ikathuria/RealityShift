import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import TimelineScrubber from './TimelineScrubber'
import type { Divergence } from '../store/worldStore'

function div(partial: Partial<Divergence>): Divergence {
  return {
    id: 1,
    country_code: 'USA',
    sim_year: 2026,
    real_date: '2026-01-01',
    sim_state: {},
    delta: {},
    narrative: 'Something diverged.',
    published_at: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

const sample: Divergence[] = [
  div({ id: 1, sim_year: 2026, country_code: 'USA', delta: { gdp: 3 }, narrative: 'US economy shifts.' }),
  div({ id: 2, sim_year: 2027, country_code: 'CHN', delta: { gdp: 8 }, narrative: 'China pivots hard.' }),
  div({ id: 3, sim_year: 2028, country_code: 'RUS', delta: { gdp: 2 }, narrative: 'Russia realigns.' }),
]

describe('TimelineScrubber', () => {
  it('shows a graceful empty state with no divergences', () => {
    render(<TimelineScrubber divs={[]} />)
    expect(screen.getByText(/this timeline fills in as the world drifts/i)).toBeInTheDocument()
  })

  it('renders the first step and total step count from the data', () => {
    render(<TimelineScrubber divs={sample} />)
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/DRIFT FROM REALITY/)).toBeInTheDocument()
  })

  it('scrubs to a different year via the range slider', () => {
    render(<TimelineScrubber divs={sample} />)
    const slider = screen.getByRole('slider', { name: /scrub timeline/i })
    fireEvent.change(slider, { target: { value: '2' } })
    expect(screen.getByText('2028')).toBeInTheDocument()
    expect(screen.getByText(/Step 3 of 3/)).toBeInTheDocument()
  })

  it('exposes a play/pause control that toggles state', () => {
    render(<TimelineScrubber divs={sample} />)
    const play = screen.getByRole('button', { name: /play timeline/i })
    fireEvent.click(play)
    expect(screen.getByRole('button', { name: /pause timeline/i })).toBeInTheDocument()
  })

  it('surfaces the highest-magnitude divergence for the active year', () => {
    // Year 2027 has China's Δ8 — the narrative should be visible on that step.
    render(<TimelineScrubber divs={sample} />)
    const slider = screen.getByRole('slider', { name: /scrub timeline/i })
    fireEvent.change(slider, { target: { value: '1' } })
    expect(screen.getByText(/China pivots hard/)).toBeInTheDocument()
    expect(within(screen.getByText(/China pivots hard/).closest('div')!.parentElement!)
      .getByText(/Δ 8/)).toBeInTheDocument()
  })
})
