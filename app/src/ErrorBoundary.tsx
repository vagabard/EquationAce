import React from 'react';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; message?: string };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: (error as any)?.message || String(error) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    // Log for debugging in dev tools
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '1rem', color: '#eee', background: '#1e1e1e' }}>
          <h2>Something went wrong.</h2>
          {this.state.message && <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.message}</pre>}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
