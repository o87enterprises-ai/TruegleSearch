// Mock search results for testing
export const mockSearchResults = {
  web: [
    {
      title: 'Climate Change: Facts and Evidence - NASA',
      url: 'https://nasa.gov/climate',
      snippet:
        'Scientific evidence for warming of the climate system is unequivocal. Multiple studies show rising temperatures...',
      source: 'nasa.gov',
      biasRating: { bias_rating: 'center', credibility_score: 0.95 },
    },
    {
      title: 'Understanding Climate Science - NOAA',
      url: 'https://noaa.gov/climate',
      snippet:
        'Climate change refers to long-term shifts in temperatures and weather patterns. These shifts may be natural...',
      source: 'noaa.gov',
      biasRating: { bias_rating: 'center', credibility_score: 0.93 },
    },
    {
      title: 'Climate Change News - BBC',
      url: 'https://bbc.com/climate',
      snippet:
        'Latest news and analysis on climate change and global warming from the BBC...',
      source: 'bbc.com',
      biasRating: { bias_rating: 'center', credibility_score: 0.88 },
    },
  ],
  images: [
    {
      title: 'Earth from Space',
      url: 'https://example.com/image1.jpg',
      thumbnail: 'https://via.placeholder.com/300x200?text=Earth',
      contextLink: 'https://example.com',
    },
  ],
  videos: [
    {
      title: 'Climate Change Explained',
      url: 'https://youtube.com/watch?v=mock',
      thumbnail: 'https://via.placeholder.com/320x180?text=Video',
      description: 'A comprehensive explanation of climate change...',
      channelTitle: 'Science Channel',
    },
  ],
};

export const mockPerspectiveResults = {
  mainstream: {
    results: [
      {
        title: 'Major News: Climate Report Released',
        url: 'https://cnn.com/climate',
        snippet: 'Latest IPCC report shows accelerating warming trends...',
        source: 'cnn.com',
      },
      {
        title: 'World Leaders Meet on Climate',
        url: 'https://reuters.com/climate',
        snippet: 'G20 summit addresses global climate initiatives...',
        source: 'reuters.com',
      },
    ],
  },
  alternative: {
    results: [
      {
        title: 'Independent Climate Analysis',
        url: 'https://alternative.news/climate',
        snippet: 'Alternative perspective on climate data...',
        source: 'alternative.news',
      },
    ],
  },
  conspiracy: {
    results: [
      {
        title: "Climate Change: What They're Not Telling You",
        url: 'https://conspiracy.site/climate',
        snippet: 'Uncovering hidden agendas in climate policy...',
        source: 'conspiracy.site',
      },
    ],
  },
  'left-leaning': {
    results: [
      {
        title: 'Climate Justice and Social Equity',
        url: 'https://progressive.org/climate',
        snippet: 'How climate change affects marginalized communities...',
        source: 'progressive.org',
      },
    ],
  },
  centrist: {
    results: [
      {
        title: 'Balanced View: Climate Science and Economics',
        url: 'https://moderate.com/climate',
        snippet: 'Finding middle ground between environment and economy...',
        source: 'moderate.com',
      },
    ],
  },
  'right-leaning': {
    results: [
      {
        title: 'Free Market Solutions to Climate',
        url: 'https://conservative.com/climate',
        snippet: 'How innovation and capitalism can address challenges...',
        source: 'conservative.com',
      },
    ],
  },
  religious: {
    results: [
      {
        title: 'Faith and Environmental Stewardship',
        url: 'https://religious.org/climate',
        snippet: 'Religious perspectives on caring for creation...',
        source: 'religious.org',
      },
    ],
  },
  atheist: {
    results: [
      {
        title: 'Secular Humanism and Climate Action',
        url: 'https://secular.org/climate',
        snippet: 'Evidence-based approaches to environmental policy...',
        source: 'secular.org',
      },
    ],
  },
  spiritual: {
    results: [
      {
        title: 'Holistic Connection with Nature',
        url: 'https://spiritual.com/climate',
        snippet: 'Mindful awareness of our relationship with Earth...',
        source: 'spiritual.com',
      },
    ],
  },
  universal: {
    results: [
      {
        title: 'Global Unity for Climate Solutions',
        url: 'https://universal.org/climate',
        snippet: 'Transcending divisions for planetary healing...',
        source: 'universal.org',
      },
    ],
  },
  scientific: {
    results: [
      {
        title: 'Peer-Reviewed Climate Research',
        url: 'https://nature.com/climate',
        snippet: 'Latest scientific studies on climate mechanisms...',
        source: 'nature.com',
      },
    ],
  },
};

export const mockAds = [
  {
    id: 'ad-1',
    type: 'display',
    size: '728x90',
    position: 'top',
    content: '[Mock Ad: Relevant to Perspective]',
  },
  {
    id: 'ad-2',
    type: 'display',
    size: '300x250',
    position: 'sidebar',
    content: '[Mock Ad: News Subscription]',
  },
];
