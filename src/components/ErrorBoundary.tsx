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
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          background: '#0b1020',
          color: '#e6ebff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: 48, lineHeight: 1 }}>🌍</div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Something knocked the world off its axis.</h1>
        <p style={{ margin: 0, maxWidth: 460, opacity: 0.75, fontSize: 14 }}>
          An unexpected error interrupted the simulation. Your data is safe — reloading usually
          fixes it.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={this.reset}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid #3a4a7a',
              background: '#1a2140',
              color: '#e6ebff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#4f7cff',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
        {import.meta.env.DEV && (
          <pre
            style={{
              marginTop: 16,
              maxWidth: '90vw',
              overflow: 'auto',
              fontSize: 12,
              opacity: 0.6,
              textAlign: 'left',
            }}
          >
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}
