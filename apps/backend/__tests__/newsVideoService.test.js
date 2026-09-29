/**
 * The YouTube news/markets lanes: what the search is asked, and what a lane
 * hands the Feed. The search index and oEmbed are mocked.
 */
const mockPerform = jest.fn();
jest.mock('../services/SearchService', () => jest.fn().mockImplementation(() => ({ performSearch: mockPerform })));
jest.mock('../services/OembedService', () => ({
  lookupMany: jest.fn(async (urls) => Object.fromEntries(urls.map((u) => [u, { author: 'Some Channel' }]))),
}));

const { fetchVideoLane, youtubeVideos, __cache } = require('../services/NewsVideoService');

const rows = () => [
  { title: 'Markets close lower - YouTube', url: 'https://www.youtube.com/watch?v=abcdefghi01', date: new Date(Date.now() - 3600e3).toISOString() },
  { title: 'Older story - YouTube', url: 'https://www.youtube.com/watch?v=abcdefghi02', date: new Date(Date.now() - 5 * 86400e3).toISOString() },
];

beforeEach(() => { __cache.clear(); mockPerform.mockReset(); mockPerform.mockResolvedValue(rows()); });

describe('fetchVideoLane', () => {
  it('returns posts in the shape every other lane uses, labelled for the provider list', async () => {
    const { items, next } = await fetchVideoLane('newsvideo', '', 20);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      platform: 'News Video', title: 'Markets close lower',
      url: 'https://www.youtube.com/watch?v=abcdefghi01', permalink: 'https://www.youtube.com/watch?v=abcdefghi01',
      author: 'Some Channel', thumbnail: 'https://i.ytimg.com/vi/abcdefghi01/hqdefault.jpg',
      score: null, comments: null, snippet: null,
    });
    expect(new Date(items[0].date).toString()).not.toBe('Invalid Date');
    expect(next).toBe(2);
  });

  it('asks YouTube only, for news or for markets', async () => {
    await fetchVideoLane('newsvideo', '', 20);
    expect(mockPerform.mock.calls[0][0]).toBe('world news today site:youtube.com');
    await fetchVideoLane('marketsvideo', '', 20);
    expect(mockPerform.mock.calls[1][0]).toBe('stock market today analysis site:youtube.com');
    expect(mockPerform.mock.calls[1][1]).toMatchObject({ category: 'videos', dateRange: 'week' });
    expect((await fetchVideoLane('marketsvideo', '', 20)).items[0].platform).toBe('Market Analysis');
  });

  it('a typed topic narrows the kind, it never replaces it', async () => {
    await fetchVideoLane('marketsvideo', 'nvidia', 20);
    expect(mockPerform.mock.calls[0][0]).toBe('nvidia stock market today analysis site:youtube.com');
  });

  it('pages by cursor and stops after three', async () => {
    await fetchVideoLane('newsvideo', '', 20, 2);
    expect(mockPerform.mock.calls[0][1].page).toBe(2);
    expect((await fetchVideoLane('newsvideo', '', 20, 3)).next).toBeNull();
    expect((await fetchVideoLane('newsvideo', '', 20, 'junk')).next).toBe(2);
  });

  it('an empty answer finishes the lane; an unknown lane is empty', async () => {
    mockPerform.mockResolvedValue([]);
    expect(await fetchVideoLane('newsvideo', 'zzz', 20)).toEqual({ items: [], next: null });
    expect(await fetchVideoLane('nope', '', 20)).toEqual({ items: [], next: null });
  });

  it('serves the cache instead of asking the index twice', async () => {
    await fetchVideoLane('newsvideo', '', 20);
    await fetchVideoLane('newsvideo', '', 20);
    expect(mockPerform).toHaveBeenCalledTimes(1);
  });
});

describe('youtubeVideos failure', () => {
  it('throws when there is nothing cached', async () => {
    mockPerform.mockRejectedValue(new Error('index down'));
    await expect(youtubeVideos('news')).rejects.toThrow('index down');
  });

  it('serves a stale list rather than nothing when the index fails', async () => {
    await youtubeVideos('news');
    // age every entry past the TTL, then break the index
    for (const v of __cache.values()) v.at = Date.now() - 60 * 60 * 1000;
    mockPerform.mockRejectedValue(new Error('index down'));
    const out = await youtubeVideos('news');
    expect(out.stale).toBe(true);
    expect(out.items.length).toBeGreaterThan(0);
  });

  it('local scope asks by region name', async () => {
    await youtubeVideos('news', { scope: 'local', country: 'CA' });
    expect(mockPerform.mock.calls[0][0]).toBe('Canada news today site:youtube.com');
  });
});
