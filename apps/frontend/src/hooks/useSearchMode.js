import { useState, useEffect } from 'react';

export const useSearchMode = (query) => {
  const [mode, setMode] = useState('blue');
  const [modeConfig, setModeConfig] = useState({});
  const [overrideMode, setOverrideMode] = useState(null);

  // Determine search mode based on query content
  useEffect(() => {
    if (!query) {
      setMode('blue'); // Default mode
      return;
    }

    const lowerQuery = query.toLowerCase();
    
    // Detect if query suggests a specific mode
    const politicalIndicators = [
      'politic', 'election', 'vote', 'government', 'democrat', 'republican', 
      'liberal', 'conservative', 'party', 'senate', 'house', 'congress', 'president'
    ];
    
    const scientificIndicators = [
      'science', 'research', 'study', 'data', 'evidence', 'experiment', 
      'theory', 'analysis', 'research paper', 'peer reviewed'
    ];
    
    const entertainmentIndicators = [
      'movie', 'film', 'music', 'celebrity', 'actor', 'actress', 'show', 
      'tv', 'series', 'game', 'sports', 'entertainment'
    ];

    // Check for political content
    if (politicalIndicators.some(indicator => lowerQuery.includes(indicator))) {
      setMode('purple'); // Biased/perspective mode
    } 
    // Check for scientific content
    else if (scientificIndicators.some(indicator => lowerQuery.includes(indicator))) {
      setMode('ocean'); // OSINT/deep dive mode
    }
    // Check for entertainment content
    else if (entertainmentIndicators.some(indicator => lowerQuery.includes(indicator))) {
      setMode('red'); // Alternative/controversy mode
    }
    // Default to standard search
    else {
      setMode('blue'); // Standard mode
    }
  }, [query]);

  // Define mode configurations
  useEffect(() => {
    const config = {
      blue: {
        name: 'Standard',
        description: 'Balanced search results',
        color: '#3b82f6', // blue-500
      },
      red: {
        name: 'Alternative',
        description: 'Alternative viewpoints and conspiracy theories',
        color: '#ef4444', // red-500
      },
      purple: {
        name: 'Multi-Perspective',
        description: 'Results from different political perspectives',
        color: '#a855f7', // purple-500
      },
      ocean: {
        name: 'OSINT',
        description: 'Open source intelligence gathering',
        color: '#14b8a6', // teal-500
      },
    };

    setModeConfig(config[mode] || config.blue);
  }, [mode]);

  return {
    mode,
    modeConfig,
    overrideMode,
    setOverrideMode,
    setMode
  };
};