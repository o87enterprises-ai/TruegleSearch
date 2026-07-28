import React from 'react';
import { Link } from 'react-router-dom';
import { useTutorials } from '../context/TutorialContext';
import EmailSignup from './EmailSignup';

const Footer = () => {
  const { openTutorial } = useTutorials();
  return (
    <footer className="bg-black border-t border-white/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          {/* Newsletter signup (UI only — TODO: wire to email provider) */}
          <div className="mb-5 pb-5 border-b border-white/5">
            <EmailSignup variant="footer" />
          </div>

          {/* Slogan */}
          <p className="text-sm text-white/50 mb-2">
            Truegle. Like G****e but, you know... Better.
          </p>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/40 mb-3">
            <Link to="/about" className="hover:text-white/70">About</Link>
            <Link to="/blog" className="hover:text-white/70">Blog</Link>
            <Link to="/advertise" className="hover:text-white/70">Advertise</Link>
            <Link to="/privacy" className="hover:text-white/70">Privacy</Link>
            <Link to="/terms" className="hover:text-white/70">Terms</Link>
            <button type="button" onClick={openTutorial} className="hover:text-white/70">
              Tutorial
            </button>
          </nav>

          {/* Parody Disclaimer */}
          <p className="text-xs text-white/30">
            Truegle is not affiliated with Google LLC. This is a parody site
            demonstrating unbiased search functionality. All site features work
            as described.
          </p>

          {/* Copyright */}
          <p className="text-xs text-white/20 mt-2">
            © {new Date().getFullYear()} Truegle. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
