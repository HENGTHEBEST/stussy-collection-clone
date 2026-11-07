import { Component, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="page-shell error-page">
      <h1>Something went wrong</h1>
      <p>The page could not be displayed. Try a fresh start.</p>
      <div className="action-row">
        <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        <a href="/">Return home</a>
      </div>
    </main>;
  }
}
