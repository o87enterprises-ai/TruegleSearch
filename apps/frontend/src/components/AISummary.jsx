import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiCpu, FiChevronDown, FiChevronUp } = FiIcons;

const AISummary = ({ query, summary, loading }) => {
  const [expanded, setExpanded] = React.useState(true);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-center mb-4">
          <SafeIcon icon={FiCpu} className="mr-2 text-blue-600" />
          <h3 className="font-semibold text-blue-800">AI Summary</h3>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-blue-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-blue-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-blue-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <SafeIcon icon={FiCpu} className="mr-2 text-blue-600" />
          <h3 className="font-semibold text-blue-800">Unbiased AI Summary</h3>
          <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
            Multiple Sources
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-blue-600 hover:text-blue-800"
        >
          <SafeIcon icon={expanded ? FiChevronUp : FiChevronDown} />
        </button>
      </div>

      {expanded && (
        <div className="text-gray-700 leading-relaxed">
          <p className="mb-4">{summary}</p>

          <div className="border-t border-blue-200 pt-4">
            <p className="text-sm text-blue-700 font-medium mb-2">
              This summary presents multiple perspectives on "{query}" from
              various sources:
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Mainstream Media
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Academic Sources
              </span>
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                Independent Media
              </span>
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                Alternative Views
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISummary;
