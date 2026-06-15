import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { FEEDBACK_EMAIL } from '../../config/access';

/**
 * RouteBoundary — wraps a single route's element so a crash on one page renders
 * a friendly card (with reload + go-home + report) instead of taking down the
 * whole app. The Router stays mounted above this, so navigation still works.
 *
 * Usage: <Route path="/x" element={<RouteBoundary><X /></RouteBoundary>} />
 */
const RouteErrorCard = ({ error }) => {
  const message = error?.message || 'Unknown error';
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    'TruegleSearch bug report'
  )}&body=${encodeURIComponent(
    `What I was doing:\n\n\n---\nPage: ${location.href}\nError: ${message}`
  )}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0b14] text-white p-6">
      <div className="max-w-md text-center">
        <div className="text-4xl mb-3">🛠️</div>
        <h2 className="text-lg font-bold mb-2">This page hit a snag</h2>
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          You're using TruegleSearch in early access, so a few rough edges are
          expected. The rest of the site still works — try reloading or head home.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl font-semibold text-sm text-[#0b0b14] bg-gradient-to-r from-cyan-400 to-purple-500"
          >
            Reload
          </button>
          <a href="/" className="px-4 py-2 rounded-xl font-semibold text-sm border border-white/15 hover:bg-white/5">
            Go home
          </a>
          <a href={mailto} className="px-4 py-2 rounded-xl font-semibold text-sm border border-white/15 hover:bg-white/5">
            Report bug
          </a>
        </div>
      </div>
    </div>
  );
};

const RouteBoundary = ({ children }) => (
  <ErrorBoundary fallback={({ error }) => <RouteErrorCard error={error} />}>
    {children}
  </ErrorBoundary>
);

export default RouteBoundary;
