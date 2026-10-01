import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Receives the error and a reset handler. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in the tree below it so a single failure
 * (a bad data shape, a Cesium/WebGL fault) degrades to a recoverable screen
 * instead of a blank white page. Wrap the whole app, and any high-risk subtree.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept to console for now; wire a real reporter (Sentry, etc.) here.
    console.error('Uncaught error in React tree:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <main
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--rs-space-5) var(--rs-space-4)',
          background: 'var(--rs-space)',
          fontFamily: 'var(--rs-font-body)',
        }}
      >
        <div className="rs-paper" style={{ maxWidth: 480, padding: 'var(--rs-space-6)', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 var(--rs-space-3)', fontFamily: 'var(--rs-font-display)', fontSize: 'var(--rs-text-xl)', lineHeight: 1.05 }}>
            Something knocked the world off its axis
          </h1>
          <p style={{ margin: 0, color: 'var(--rs-muted-on-paper)', fontSize: 'var(--rs-text-md)', lineHeight: 1.45 }}>
            An unexpected error stopped the simulation mid-turn. Your worlds are safe on our side.
            Try again, or reload the page if it keeps happening.
          </p>
          <div style={{ display: 'flex', gap: 'var(--rs-space-3)', marginTop: 'var(--rs-space-5)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={this.reset} className="game-button">
              Try again
            </button>
            <button type="button" onClick={() => window.location.reload()} className="game-button game-button-dark">
              Reload the page
            </button>
          </div>
          {import.meta.env.DEV && (
            <pre
              style={{
                marginTop: 'var(--rs-space-4)',
                maxWidth: '100%',
                overflow: 'auto',
                fontFamily: 'var(--rs-font-mono)',
                fontSize: 'var(--rs-text-xs)',
                color: 'var(--rs-muted-on-paper)',
                textAlign: 'left',
              }}
            >
              {error.message}
            </pre>
          )}
        </div>
      </main>
    );
  }
}
