import React from 'react';

/**
 * Email signup form — UI ONLY.
 *
 * TODO: connect to email provider (Mailchimp / ConvertKit / Beehiiv). The form
 * action is a placeholder `#` and submitting is prevented; no address is sent
 * or stored anywhere yet. Two visual variants:
 *   - variant="footer"  compact single-line row for the site footer
 *   - variant="sidebar" boxed card for in-content sidebars (e.g. the pillar page)
 */
const EmailSignup = ({ variant = 'sidebar', className = '' }) => {
  // UI only — do not submit anywhere until wired to a provider.
  const handleSubmit = (e) => e.preventDefault();

  if (variant === 'footer') {
    return (
      <form
        action="#"
        onSubmit={handleSubmit}
        className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
        aria-label="Newsletter signup"
      >
        <label htmlFor="email-signup-footer" className="sr-only">Email address</label>
        <input
          id="email-signup-footer"
          type="email"
          name="email"
          placeholder="Your email for the weekly digest"
          className="min-w-0 flex-1 max-w-xs px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/40"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
        >
          Subscribe
        </button>
        {/* TODO: connect to email provider (Mailchimp/ConvertKit/Beehiiv). */}
      </form>
    );
  }

  return (
    <aside
      className={`rounded-2xl border border-white/10 bg-white/5 p-5 ${className}`}
      aria-label="Newsletter signup"
    >
      <h3 className="text-white font-semibold mb-1">Get the weekly Truegle digest</h3>
      <p className="text-sm text-white/60 mb-4">
        Private-search tips, OSINT tools, and new guides — one email a week, no tracking.
      </p>
      <form action="#" onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="email-signup-sidebar" className="sr-only">Email address</label>
        <input
          id="email-signup-sidebar"
          type="email"
          name="email"
          placeholder="you@example.com"
          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/40"
        />
        <button
          type="submit"
          className="w-full px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white transition-opacity"
        >
          Subscribe — free
        </button>
      </form>
      <p className="mt-2 text-[11px] text-white/30">
        {/* TODO: connect to email provider (Mailchimp/ConvertKit/Beehiiv). */}
        No spam. Unsubscribe anytime.
      </p>
    </aside>
  );
};

export default EmailSignup;
