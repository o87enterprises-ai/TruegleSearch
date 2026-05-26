import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center">
          {/* Slogan */}
          <p className="text-sm text-gray-600 mb-2">
            Truegle. Like G****e but, you know... Better.
          </p>

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
