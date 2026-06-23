import React from 'react';
import { Link } from 'react-router-dom';
import { useTutorials } from '../context/TutorialContext';

const Footer = () => {
  const { openTutorial } = useTutorials();
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          {/* Slogan */}
          <p className="text-sm text-gray-600 mb-2">
            Truegle. Like G****e but, you know... Better.
          </p>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
            <Link to="/about" className="hover:text-gray-800">About</Link>
            <Link to="/advertise" className="hover:text-gray-800">Advertise</Link>
            <Link to="/privacy" className="hover:text-gray-800">Privacy</Link>
            <Link to="/terms" className="hover:text-gray-800">Terms</Link>
            <button type="button" onClick={openTutorial} className="hover:text-gray-800">
              Tutorial
            </button>
          </nav>

          {/* Parody Disclaimer */}
          <p className="text-xs text-gray-500">
            Truegle is not affiliated with Google LLC. This is a parody site
            demonstrating unbiased search functionality. All site features work
            as described.
          </p>

          {/* Copyright */}
          <p className="text-xs text-gray-400 mt-2">
            © {new Date().getFullYear()} Truegle. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
