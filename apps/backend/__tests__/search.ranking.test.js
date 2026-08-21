/**
 * NOT THE RANKING /api/search USES. Despite the filename, this covers
 * PrivateSearchService, which serves routes/news.js. The ranking behind
 * /api/search lives in SearchService and is covered by searchRanking.test.js.
 *
 * That gap is worth naming rather than leaving to be rediscovered: the search
 * ranking bug where a fresh off-topic story beat an on-topic one went unnoticed
 * partly because this file existed and looked like it covered ranking. The two
 * services genuinely are different — this one already scored recency only for
 * time-sensitive queries, which is the fix the other one needed.
 */
/**
 * Search Ranking Algorithm Tests
 * Tests for bias-resistant ranking
 */
const PrivateSearchService = require('../services/PrivateSearchService');

describe('PrivateSearchService', () => {
  let searchService;

  beforeEach(() => {
    searchService = new PrivateSearchService();
  });

  describe('calculateRelevance', () => {
    it('should score exact phrase matches higher', () => {
      const query = 'machine learning';
      const doc1 = {
        title: 'Introduction to Machine Learning',
        snippet: 'Learn about machine learning algorithms',
      };
      const doc2 = {
        title: 'Computer Science Basics',
        snippet: 'Overview of computing topics',
      };

      const score1 = searchService.calculateRelevance(query, doc1);
      const score2 = searchService.calculateRelevance(query, doc2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should boost title matches', () => {
      const query = 'python';
      const doc1 = {
        title: 'Python Programming Guide',
        snippet: 'A comprehensive guide',
      };
      const doc2 = {
        title: 'Programming Guide',
        snippet: 'Learn python and other languages',
      };

      const score1 = searchService.calculateRelevance(query, doc1);
      const score2 = searchService.calculateRelevance(query, doc2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle empty documents', () => {
      const query = 'test';
      const doc = { title: '', snippet: '' };

      const score = searchService.calculateRelevance(query, doc);
      expect(score).toBe(0);
    });
  });

  describe('calculateDiversity', () => {
    it('should give full score to first result from domain', () => {
      const domainCounts = new Map();
      const score = searchService.calculateDiversity('example.com', domainCounts);
      expect(score).toBe(1);
    });

    it('should penalize subsequent results from same domain', () => {
      const domainCounts = new Map([['example.com', 1]]);
      const score = searchService.calculateDiversity('example.com', domainCounts);
      expect(score).toBeLessThan(1);
    });

    it('should have minimum score of 0.1', () => {
      const domainCounts = new Map([['example.com', 10]]);
      const score = searchService.calculateDiversity('example.com', domainCounts);
      expect(score).toBeGreaterThanOrEqual(0.1);
    });
  });

  describe('isTimeSensitiveQuery', () => {
    it('should detect time-sensitive queries', () => {
      expect(searchService.isTimeSensitiveQuery('latest news')).toBe(true);
      expect(searchService.isTimeSensitiveQuery('breaking news today')).toBe(true);
      expect(searchService.isTimeSensitiveQuery('2025 election results')).toBe(true);
    });

    it('should not flag regular queries as time-sensitive', () => {
      expect(searchService.isTimeSensitiveQuery('how to cook pasta')).toBe(false);
      expect(searchService.isTimeSensitiveQuery('python programming')).toBe(false);
    });
  });

  describe('rankResults', () => {
    it('should rank results by combined score', () => {
      const query = 'javascript tutorial';
      const results = [
        {
          title: 'Python Basics',
          url: 'https://python.org/basics',
          snippet: 'Learn Python programming',
        },
        {
          title: 'JavaScript Tutorial',
          url: 'https://javascript.info/tutorial',
          snippet: 'Complete JavaScript tutorial for beginners',
        },
        {
          title: 'Web Development',
          url: 'https://webdev.com/intro',
          snippet: 'Introduction to web development with javascript',
        },
      ];

      const ranked = searchService.rankResults(query, results);

      // JavaScript tutorial should rank higher due to exact match
      expect(ranked[0].url).toBe('https://javascript.info/tutorial');
    });

    it('should limit results from same domain', () => {
      const query = 'test';
      const results = [
        { title: 'Page 1', url: 'https://example.com/1', snippet: 'test content' },
        { title: 'Page 2', url: 'https://example.com/2', snippet: 'test content' },
        { title: 'Page 3', url: 'https://example.com/3', snippet: 'test content' },
        { title: 'Page 4', url: 'https://example.com/4', snippet: 'test content' },
        { title: 'Page 5', url: 'https://example.com/5', snippet: 'test content' },
      ];

      const ranked = searchService.rankResults(query, results);

      // Should limit to MAX_SAME_DOMAIN (3)
      expect(ranked.length).toBeLessThanOrEqual(3);
    });

    it('should include ranking metadata in results', () => {
      const query = 'test';
      const results = [
        { title: 'Test Page', url: 'https://example.com/test', snippet: 'test content' },
      ];

      const ranked = searchService.rankResults(query, results);

      expect(ranked[0].relevanceScore).toBeDefined();
      expect(ranked[0].diversityScore).toBeDefined();
      expect(ranked[0].recencyScore).toBeDefined();
      expect(ranked[0].finalScore).toBeDefined();
      expect(ranked[0].domain).toBe('example.com');
    });

    it('should handle empty results', () => {
      const ranked = searchService.rankResults('test', []);
      expect(ranked).toEqual([]);
    });

    it('should not personalize results', () => {
      const query = 'privacy search';
      const results = [
        { title: 'Privacy Guide', url: 'https://privacy.org', snippet: 'Privacy tips' },
      ];

      // Results should be the same regardless of who searches
      const ranked1 = searchService.rankResults(query, results);
      const ranked2 = searchService.rankResults(query, results);

      expect(ranked1[0].finalScore).toBe(ranked2[0].finalScore);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from URL', () => {
      expect(searchService.extractDomain('https://www.example.com/page')).toBe('example.com');
      expect(searchService.extractDomain('https://subdomain.example.org')).toBe('subdomain.example.org');
    });

    it('should handle invalid URLs', () => {
      expect(searchService.extractDomain('not-a-url')).toBe('unknown');
    });
  });
});
