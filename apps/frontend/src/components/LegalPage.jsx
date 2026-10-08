import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NuclearStrip } from './ui/SessionWipe';

/**
 * Shared layout for static legal/info pages (Privacy, Terms, About).
 * Dark theme, readable prose width, back-to-home link.
 */
const LegalPage = ({ title, lastUpdated, children }) => {
  useEffect(() => {
    document.title = `${title} — Truegle`;
    window.scrollTo(0, 0);
  }, [title]);

  const protonUrl = 'https://protonvpn.com/';

  return (
    <div className="min-h-screen bg-black text-gray-200">
      <div className="max-w-3xl mx-auto px-5 py-12">
        <header className="mb-10 border-b border-gray-800 pb-6">
          <Link
            to="/"
            className="inline-block mb-6 text-sm text-blue-400 hover:text-blue-300 font-mono"
          >
            ← Back to Truegle
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white">{title}</h1>
          {lastUpdated && (
            <p className="mt-2 text-sm text-gray-500 font-mono">
              Last updated: {lastUpdated}
            </p>
          )}
        </header>
 
        <article className="legal-prose space-y-6 leading-relaxed text-gray-300">
          {children}
        </article>

        <footer className="mt-14 pt-6 border-t border-gray-800 text-sm text-gray-500">
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/privacy" className="hover:text-gray-300">Privacy</Link>
            <Link to="/terms" className="hover:text-gray-300">Terms</Link>
            <Link to="/about" className="hover:text-gray-300">About</Link>
            <a href="mailto:truegleai@proton.me" className="hover:text-gray-300">
              Contact
            </a>
            <span className="text-gray-700">|</span>
            <a
              href={protonUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="hover:text-gray-300 text-blue-400/90 font-mono text-xs flex items-center gap-1"
            >
              Proton VPN
            </a>
          </div>
          <NuclearStrip className="mt-8" />
          <p className="mt-6">© {new Date().getFullYear()} Truegle Search. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

/** Section heading helper for consistent styling. */
export const LegalSection = ({ heading, children }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold text-white">{heading}</h2>
    {children}
  </section>
);

export default LegalPage;
