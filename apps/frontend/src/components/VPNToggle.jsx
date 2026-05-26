import React from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiShield, FiGlobe } = FiIcons;

const VPNToggle = ({ enabled, onToggle }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="bg-white border border-gray-200 rounded-lg shadow-lg p-4"
      >
        <div className="flex items-center space-x-3">
          <SafeIcon
            icon={enabled ? FiShield : FiGlobe}
            className={enabled ? 'text-green-600' : 'text-gray-400'}
            size={20}
          />
          <div>
            <p className="text-sm font-medium">VPN Protection</p>
            <p className="text-xs text-gray-500">
              {enabled ? 'Connected & Secure' : 'Disconnected'}
            </p>
          </div>
          <button
            onClick={() => onToggle(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? 'bg-green-600' : 'bg-gray-300'
            }`}
          >
            <motion.span
              animate={{ x: enabled ? 20 : 2 }}
              className="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform"
            />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VPNToggle;
