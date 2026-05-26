import React from 'react';
import { useSettings } from '../context/SettingsContext';

const AdSlot = ({ position, size = 'medium', className = '' }) => {
  const { settings } = useSettings();

  // Don't show ads if ad personalization is off and user chose necessary cookies only
  if (
    !settings.adPersonalization &&
    settings.cookiePreference === 'necessary'
  ) {
    return null;
  }

  const adSizes = {
    small: 'w-250 h-100',
    medium: 'w-300 h-250',
    large: 'w-728 h-90',
    leaderboard: 'w-970 h-90',
    sidebar: 'w-300 h-600',
  };

  const adContent = {
    small: 'Small Ad - Privacy Focused',
    medium: 'Medium Ad - Supporting Truegle',
    large: 'Large Ad - Unbiased Search',
    leaderboard: 'Leaderboard Ad - Transparent Results',
    sidebar: 'Sidebar Ad - Secure Browsing',
  };

  const adStyles = {
    small: 'bg-blue-50 border border-blue-200 text-xs',
    medium: 'bg-green-50 border border-green-200 text-sm',
    large: 'bg-purple-50 border border-purple-200 text-base',
    leaderboard: 'bg-orange-50 border border-orange-200 text-base font-medium',
    sidebar: 'bg-pink-50 border border-pink-200 text-sm',
  };

  return (
    <div
      className={`${className} ${adSizes[size]} ${adStyles[size]} rounded-lg flex items-center justify-center text-center p-4`}
    >
      <div>
        <p className="font-medium text-gray-700 mb-1">{adContent[size]}</p>
        <p className="text-gray-500 text-xs">
          {settings.adPersonalization
            ? 'Personalized ads based on your preferences'
            : 'Contextual ads only - No personal data used'}
        </p>
        <p className="text-gray-400 text-xxs mt-1">Ad Position: {position}</p>
      </div>
    </div>
  );
};

export default AdSlot;
