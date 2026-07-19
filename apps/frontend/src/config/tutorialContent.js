/**
 * Tutorial Content Configuration
 * Defines all tutorial content organized by page/feature
 */

export const TUTORIALS = {
  // Landing Page Tutorials
  landing: {
    welcome: {
      id: 'landing-welcome',
      title: 'Welcome to Truegle',
      description: 'Truegle is a search engine designed to help you find information with awareness of bias. We show you multiple perspectives so you can form your own opinions.',
      position: 'bottom',
    },
    bluePillRedPill: {
      id: 'landing-pills',
      title: 'Blue Pill vs Red Pill',
      description: 'Blue Pill mode shows balanced, mainstream search results. Red Pill mode reveals alternative perspectives and helps you see past potential biases in search results.',
      position: 'bottom',
    },
    searchBasics: {
      id: 'landing-search',
      title: 'Search Basics',
      description: 'Type your query in the search bar and press Enter. Use categories to filter results by type: Web, Images, News, Videos, and more.',
      position: 'bottom',
    },
  },

  // Search Portal Tutorials
  searchPortal: {
    categories: {
      id: 'portal-categories',
      title: 'Search Categories',
      description: 'Filter your search by category. Choose from Web, Local, Maps, Images, Videos, News, Shopping, and more to find exactly what you need.',
      position: 'bottom',
    },
    filters: {
      id: 'portal-filters',
      title: 'Advanced Filters',
      description: 'Use filters to refine your search results by date, region, language, and more. Click the filter icon to access advanced options.',
      position: 'left',
    },
    osintMode: {
      id: 'portal-osint',
      title: 'OSINT Mode',
      description: 'Open Source Intelligence mode provides access to specialized tools for research and investigation. Perfect for journalists, researchers, and security professionals.',
      position: 'bottom',
    },
    voiceInput: {
      id: 'portal-voice',
      title: 'Voice Search',
      description: 'Click the microphone icon to search using your voice. Speak clearly and wait for the transcription to appear.',
      position: 'right',
    },
  },

  // Search Results Tutorials
  searchResults: {
    resultCards: {
      id: 'results-cards',
      title: 'Understanding Results',
      description: 'Each result card shows the title, URL, and a snippet of content. Look for bias indicators to understand the perspective of each source.',
      position: 'left',
    },
    biasIndicators: {
      id: 'results-bias',
      title: 'Bias Indicators',
      description: 'Color-coded indicators show the political or ideological lean of sources. Blue indicates left-leaning, red indicates right-leaning, and gray is neutral.',
      position: 'right',
    },
    aiSummary: {
      id: 'results-ai',
      title: 'AI Summary',
      description: 'Expand the AI panel to see an AI-generated summary of your search results. This helps you quickly understand the key points across multiple sources.',
      position: 'top',
    },
  },

  // Biased Results Page Tutorials
  biasedResults: {
    redPillConcept: {
      id: 'biased-redpill',
      title: 'Red Pill Mode Active',
      description: 'You\'re now seeing alternative perspectives that mainstream search engines might not prioritize. Always verify information from multiple sources.',
      position: 'top',
    },
    sourceVerification: {
      id: 'biased-verify',
      title: 'Verify Your Sources',
      description: 'In Red Pill mode, you\'ll encounter diverse viewpoints. Cross-reference information and check source credibility before drawing conclusions.',
      position: 'bottom',
    },
  },

  // OSINT Tools Tutorials
  osintTools: {
    toolCategories: {
      id: 'osint-categories',
      title: 'Tool Categories',
      description: 'OSINT tools are organized by category: People Search, Domain Analysis, Social Media, and more. Each category contains specialized investigation tools.',
      position: 'bottom',
    },
    usageLimits: {
      id: 'osint-limits',
      title: 'Usage Limits',
      description: 'Some tools require tokens to use. You start with 3 free tokens and can earn more by playing the 404 page game.',
      position: 'right',
    },
    premiumFeatures: {
      id: 'osint-premium',
      title: 'Premium Features',
      description: 'Premium subscribers get unlimited access to all OSINT tools without ads or token limits. Consider upgrading for intensive research.',
      position: 'bottom',
    },
  },

  // Auth Pages Tutorials
  auth: {
    accountBenefits: {
      id: 'auth-benefits',
      title: 'Why Create an Account?',
      description: 'Registered users get 3 free tokens, search history, saved preferences, and access to premium features like Red Pill mode.',
      position: 'right',
    },
    premiumFeatures: {
      id: 'auth-premium',
      title: 'Premium Benefits',
      description: 'Premium members enjoy unlimited searches, no ads, priority AI summaries, and full access to OSINT tools.',
      position: 'bottom',
    },
  },
};

/**
 * Get tutorials for a specific page
 */
export const getTutorialsForPage = (pageId) => {
  return TUTORIALS[pageId] || {};
};

/**
 * Get a specific tutorial by ID
 */
export const getTutorialById = (tutorialId) => {
  for (const page of Object.values(TUTORIALS)) {
    for (const tutorial of Object.values(page)) {
      if (tutorial.id === tutorialId) {
        return tutorial;
      }
    }
  }
  return null;
};

/**
 * Get all tutorial IDs for a page
 */
export const getTutorialIdsForPage = (pageId) => {
  const pageTutorials = TUTORIALS[pageId];
  if (!pageTutorials) return [];
  return Object.values(pageTutorials).map(t => t.id);
};

/**
 * Get the first tutorial for a page (for auto-show)
 */
export const getFirstTutorialForPage = (pageId) => {
  const pageTutorials = TUTORIALS[pageId];
  if (!pageTutorials) return null;
  const tutorials = Object.values(pageTutorials);
  return tutorials.length > 0 ? tutorials[0] : null;
};

export default TUTORIALS;
