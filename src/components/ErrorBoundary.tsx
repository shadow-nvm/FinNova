import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence: a render error anywhere in the app shows a recoverable
 * screen instead of a blank white page. Data itself lives in Firestore, so a
 * reload never loses anything.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[FinNova] Unhandled UI error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash-wrap">
        <div className="card crash-card">
          <div className="crash-emoji" aria-hidden="true">
            💠
          </div>
          <h1 className="crash-title">Something went wrong</h1>
          <p className="muted crash-text">
            Your data is safe in your account. Reload FinNova to continue where you left off.
          </p>
          <div className="crash-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload FinNova
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
