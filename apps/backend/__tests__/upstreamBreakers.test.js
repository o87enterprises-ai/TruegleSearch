/**
 * Quota circuit breakers + the keyless YouTube fallback.
 *
 * Regression for the 2026-10-27 runtime-log review: ~29k YouTube Data API 429s,
 * ~29k Google CSE 403s, ~28k Brave 429s and ~26k NewsAPI 429s in 7 days — each a
 * wasted round trip — with Up Next / Radio / Tube search falling back to history
 * when YouTube search came back empty.
 */
const axios = require('axios');
jest.mock('axios');

const { createBreakers, breakers, msUntilPacificMidnight } = require('../utils/breaker');
const YouTubeGateway = require('../services/YouTubeGateway');
const SearchService = require('../services/SearchService');

beforeEach(() => {
  breakers.reset();
  jest.restoreAllMocks();
  axios.get.mockReset();
});

describe('breaker', () => {
  test('opens on trip, lets a probe through after the cooldown, forgets on ok()', () => {
    let t = 1000;
    const b = createBreakers({ now: () => t });
    expect(b.isOpen('x')).toBe(false);
    b.trip('x', 5000, 'http 429');
    expect(b.isOpen('x')).toBe(true);
    expect(b.status().x.reason).toBe('http 429');
    t += 5001;
    expect(b.isOpen('x')).toBe(false); // cooled down → probe allowed
    b.trip('x', 5000);
    b.ok('x');
    expect(b.isOpen('x')).toBe(false);
  });

  test('pacific midnight is always within (0, 26h]', () => {
    for (const d of ['2026-01-15T00:00:00Z', '2026-07-01T07:00:00Z', '2026-10-27T18:30:00Z', '2026-03-08T10:00:00Z']) {
      const ms = msUntilPacificMidnight(Date.parse(d));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(26 * 3600 * 1000);
    }
  });
});

describe('Invidious → YouTube API shape', () => {
  const { toApiShape, isoDuration } = YouTubeGateway._internals;

  test('durations are ISO-8601 so parseYouTubeDuration can read them', () => {
    expect(isoDuration(3723)).toBe('PT1H2M3S');
    expect(isoDuration(59)).toBe('PT59S');
    expect(isoDuration(600)).toBe('PT10M');
    expect(isoDuration(0)).toBeUndefined();
    const svc = new SearchService();
    expect(svc.parseYouTubeDuration(isoDuration(3723))).toBe('1:02:03');
  });

  test('only well-formed videos survive, and format like the Data API', () => {
    const shaped = toApiShape([
      { type: 'video', videoId: 'dQw4w9WgXcQ', title: 'Song', author: 'Artist', published: 1700000000, lengthSeconds: 213, viewCount: 5 },
      { type: 'channel', authorId: 'UCxxxxxxxxxxxxxxxxxxxxxx' },
      { type: 'video', videoId: 'bad id' },
    ], 10);
    expect(shaped.kind).toBe('youtube#searchListResponse');
    expect(shaped.items).toHaveLength(1);
    const svc = new SearchService();
    const [r] = svc.formatYouTubeResults(shaped);
    expect(r.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(r.channel).toBe('Artist');
    expect(r.duration).toBe('3:33');
    expect(r.views).toBe(5);
  });
});

describe('performYoutubeSearch', () => {
  const quota = () => Object.assign(new Error('x'), {
    response: { status: 429, data: { error: { message: 'quota' } } },
  });

  test('on a quota error: falls back to the keyless search AND stops calling the keyed API', async () => {
    const svc = new SearchService();
    svc.youtubeApiKey = 'k';
    const free = { kind: 'youtube#searchListResponse', items: [{ id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 't', description: '', channelTitle: 'c' } }] };
    const spy = jest.spyOn(YouTubeGateway, 'searchVideos').mockResolvedValue(free);
    axios.get.mockRejectedValue(quota());

    const a = await svc.performYoutubeSearch('first query', { perPage: 5 });
    expect(a).toBe(free);
    expect(breakers.isOpen('youtube_api')).toBe(true);
    const callsAfterFirst = axios.get.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    await svc.performYoutubeSearch('a different query', { perPage: 5 });
    expect(axios.get.mock.calls.length).toBe(callsAfterFirst); // no new keyed call while cooling down
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('a repeated query is served from the cache (no upstream call at all)', async () => {
    const svc = new SearchService();
    svc.youtubeApiKey = 'k';
    const free = { kind: 'youtube#searchListResponse', items: [{ id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 't', description: '', channelTitle: 'c' } }] };
    const spy = jest.spyOn(YouTubeGateway, 'searchVideos').mockResolvedValue(free);
    breakers.trip('youtube_api', 60000);
    await svc.performYoutubeSearch('same query', { perPage: 5 });
    await svc.performYoutubeSearch('Same Query ', { perPage: 5 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  test('when the keyed API AND the fallback both fail, the error still surfaces', async () => {
    const svc = new SearchService();
    svc.youtubeApiKey = 'k';
    jest.spyOn(YouTubeGateway, 'searchVideos').mockResolvedValue(null);
    axios.get.mockRejectedValue(quota());
    await expect(svc.performYoutubeSearch('nothing works', { perPage: 5 })).rejects.toThrow(/rate limit|quota|unavailable/i);
  });
});

describe('other providers skip the network while cooling down', () => {
  test('Google CSE 403 pauses it; the next call does not hit axios', async () => {
    const svc = new SearchService();
    svc.googleApiKey = 'k';
    svc.googleSearchEngineId = 'cx';
    axios.get.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 403, data: {} } }));
    await expect(svc.performGoogleSearch('q', {})).rejects.toThrow();
    const n = axios.get.mock.calls.length;
    await expect(svc.performGoogleSearch('q2', {})).rejects.toThrow(/paused/);
    expect(axios.get.mock.calls.length).toBe(n);
  });

  test('NewsAPI 429 pauses it', async () => {
    const svc = new SearchService();
    svc.newsApiKey = 'k';
    axios.get.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 429, data: { code: 'rateLimited' } } }));
    await expect(svc.performNewsSearch('q', {})).rejects.toThrow();
    const n = axios.get.mock.calls.length;
    await expect(svc.performNewsSearch('q2', {})).rejects.toThrow(/paused/);
    expect(axios.get.mock.calls.length).toBe(n);
  });
});
