import { Component, type ReactNode } from 'react';
import { DemoBadge } from '../components/shared/DemoBadge';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="page-shell error-page">
      <DemoBadge />
      <h1>Something went wrong</h1>
      <p>The demo could not display this page. Try a fresh start.</p>
      <div className="action-row">
        <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        <a href="/">Return home</a>
      </div>
    </main>;
  }
}
