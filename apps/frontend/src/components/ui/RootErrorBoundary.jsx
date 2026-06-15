import React from 'react';
import { FEEDBACK_EMAIL } from '../../config/access';

/**
 * RootErrorBoundary — the last line of defense for React render crashes.
 *
 * Wraps the entire app so that if ANY component throws during render, the user
 * sees a friendly, on-brand "early access" screen with reload + bug-report
 * actions instead of a blank white page. Pairs with the framework-agnostic
 * watchdog in utils/globalErrorHandler.js (which covers pre-mount crashes).
 */
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RootErrorBoundary caught:', error, errorInfo?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || 'Unknown error';
    const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      'TruegleSearch bug report'
    )}&body=${encodeURIComponent(
      `What I was doing:\n\n\n---\nPage: ${typeof location !== 'undefined' ? location.href : ''}\nError: ${message}\nBrowser: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`
    )}`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b14] text-white p-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-3">🛠️</div>
          <h1 className="text-xl font-bold mb-2">We hit a snag</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-2">
            TruegleSearch is in early access and still under active development —
            you caught a bug before the rest of the world did. Thanks for being here.
          </p>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            A quick reload usually fixes it. If it keeps happening, tell us what
            you were doing and we'll jump on it.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-[#0b0b14] bg-gradient-to-r from-cyan-400 to-purple-500 hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm border border-white/15 hover:bg-white/5 transition-colors"
            >
              Go home
            </a>
            <a
              href={mailto}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm border border-white/15 hover:bg-white/5 transition-colors"
            >
              Report bug
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default RootErrorBoundary;
