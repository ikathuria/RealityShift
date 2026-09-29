import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import ErrorBoundary from './ErrorBoundary'

function Boom({ explode }: { explode: boolean }): React.ReactElement {
  if (explode) throw new Error('kaboom')
  return <div>all good</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error; silence it so test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>hello world</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('renders the fallback alert when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom explode />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('uses a custom fallback render prop when provided', () => {
    render(
      <ErrorBoundary fallback={(err) => <div>caught: {err.message}</div>}>
        <Boom explode />
      </ErrorBoundary>,
    )
    expect(screen.getByText('caught: kaboom')).toBeInTheDocument()
  })

  it('recovers via "Try again" once the child stops throwing', () => {
    function Harness() {
      const [explode, setExplode] = useState(true)
      return (
        <ErrorBoundary
          fallback={(_err, reset) => (
            <button
              onClick={() => {
                setExplode(false)
                reset()
              }}
            >
              retry
            </button>
          )}
        >
          <Boom explode={explode} />
        </ErrorBoundary>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
