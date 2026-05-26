import React, { useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiX } = FiIcons;

const AdBanner = () => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-200 p-4 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Truegle</span> - Free, unbiased search
            powered by minimal, privacy-respecting ads
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <p className="text-xs text-blue-700">
              Sample Ad Space - Privacy First
            </p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <SafeIcon icon={FiX} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdBanner;
