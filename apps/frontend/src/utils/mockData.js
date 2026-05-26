export const mockSearchResults = (query, filters) => {
  const baseResults = [
    {
      title: `Understanding ${query}: A Comprehensive Overview`,
      snippet: `This article provides a balanced perspective on ${query}, examining multiple viewpoints and presenting factual information from credible sources.`,
      domain: 'example-news.com',
      publishedAt: '2 hours ago',
      views: '1.2M',
      bias: 'unbiased',
      category: 'news',
      verified: true,
    },
    {
      title: `${query}: What the Mainstream Media Says`,
      snippet: `Major news outlets have covered ${query} extensively. Here's a compilation of the most significant reporting from established media sources.`,
      domain: 'mainstream-source.com',
      publishedAt: '4 hours ago',
      views: '850K',
      bias: 'mainstream',
      category: 'news',
      verified: true,
    },
    {
      title: `Alternative Perspective on ${query}`,
      snippet: `This analysis presents an alternative viewpoint on ${query}, challenging conventional narratives and offering different interpretations of the available evidence.`,
      domain: 'alternative-view.org',
      publishedAt: '6 hours ago',
      views: '320K',
      bias: 'conspiracy',
      category: 'news',
      verified: false,
    },
    {
      title: `Democratic Leaders Discuss ${query}`,
      snippet: `Democratic politicians and thought leaders share their perspectives on ${query}, outlining policy positions and proposed solutions.`,
      domain: 'dem-politics.com',
      publishedAt: '1 day ago',
      views: '600K',
      bias: 'left',
      category: 'news',
      verified: true,
    },
    {
      title: `Republican Response to ${query}`,
      snippet: `Conservative voices weigh in on ${query}, presenting right-leaning analysis and policy recommendations from Republican leaders.`,
      domain: 'conservative-news.com',
      publishedAt: '1 day ago',
      views: '580K',
      bias: 'right',
      category: 'news',
      verified: true,
    },
    {
      title: `Nonpartisan Analysis: ${query} Facts`,
      snippet: `An objective, fact-based examination of ${query} without political bias, focusing on verified information and expert analysis.`,
      domain: 'factcheck-central.org',
      publishedAt: '3 days ago',
      views: '420K',
      bias: 'center',
      category: 'news',
      verified: true,
    },
    {
      title: `Video: ${query} Explained in 10 Minutes`,
      snippet: `A comprehensive video breakdown of ${query}, featuring expert interviews and visual explanations to help viewers understand the topic.`,
      domain: 'video-platform.com',
      publishedAt: '5 hours ago',
      views: '2.1M',
      bias: 'unbiased',
      category: 'video',
      verified: true,
    },
    {
      title: `Social Media Buzz: ${query} Trending`,
      snippet: `What people are saying about ${query} on social media platforms, including trending hashtags and viral discussions.`,
      domain: 'social-trends.com',
      publishedAt: '1 hour ago',
      views: '750K',
      bias: 'center',
      category: 'social',
      verified: false,
    },
  ];

  // Filter results based on filters
  let filteredResults = baseResults;

  if (filters.category !== 'all') {
    filteredResults = filteredResults.filter(
      (result) => result.category === filters.category
    );
  }

  if (filters.bias !== 'all') {
    filteredResults = filteredResults.filter(
      (result) => result.bias === filters.bias
    );
  }

  // Sort results
  if (filters.sortBy === 'date') {
    filteredResults.sort((a, b) => {
      const aTime = parseTimeAgo(a.publishedAt);
      const bTime = parseTimeAgo(b.publishedAt);
      return filters.order === 'desc' ? bTime - aTime : aTime - bTime;
    });
  } else if (filters.sortBy === 'views') {
    filteredResults.sort((a, b) => {
      const aViews = parseViews(a.views);
      const bViews = parseViews(b.views);
      return filters.order === 'desc' ? bViews - aViews : aViews - bViews;
    });
  }

  return filteredResults;
};

export const generateAISummary = (query) => {
  return `Based on analysis of multiple sources across the political spectrum, ${query} is a complex topic with varying interpretations. Mainstream sources generally focus on factual reporting and established viewpoints, while alternative sources may present different perspectives or challenge conventional narratives. 

Democratic-leaning sources tend to emphasize social and progressive aspects, while Republican-leaning sources focus on conservative values and traditional approaches. Nonpartisan analysis suggests that the truth likely incorporates elements from multiple perspectives.

Key considerations include examining the credibility of sources, understanding potential biases, and recognizing that complex issues rarely have simple solutions. It's recommended to review information from multiple perspectives to form a well-rounded understanding of ${query}.`;
};

// Helper functions
const parseTimeAgo = (timeString) => {
  const now = Date.now();
  const match = timeString.match(/(\d+)\s+(hour|day|week|month)s?\s+ago/);
  if (!match) return now;

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  return now - value * multipliers[unit];
};

const parseViews = (viewString) => {
  const match = viewString.match(/([\d.]+)([KM]?)/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (unit === 'K') return value * 1000;
  if (unit === 'M') return value * 1000000;
  return value;
};
