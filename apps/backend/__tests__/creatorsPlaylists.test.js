/**
 * Playlists found by the Tube "Lists" chip must actually play:
 *  - GET /playlists/search finds playlists (Invidious → Data API → SearXNG),
 *  - GET /playlist imports the FULL list when the Data API is down
 *    (Invidious sits between the Data API and the 15-video RSS feed).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';
delete process.env.YOUTUBE_API_KEY;

jest.mock('axios');
jest.mock('../services/YouTubeGateway', () => ({ fromPool: jest.fn() }));
jest.mock('../services/MediaService', () => ({ MediaService: { index: jest.fn().mockResolvedValue() } }));

const axios = require('axios');
const gateway = require('../services/YouTubeGateway');
const express = require('express');
const request = require('supertest');

const app = () => { const a = express(); a.use(express.json()); a.use('/api/creators', require('../routes/creators')); return a; };
const PL = 'PLabcdefghijkl';

beforeEach(() => { gateway.fromPool.mockReset(); axios.get.mockReset(); delete process.env.YOUTUBE_API_KEY; global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }); });

describe('GET /playlists/search', () => {
  test('uses Invidious first and returns playable playlist urls', async () => {
    gateway.fromPool.mockResolvedValueOnce({ base: 'x', data: [
      { type: 'video', videoId: 'v' },
      { type: 'playlist', playlistId: PL, title: 'Lo-fi mix', author: 'Chill', videoCount: 42, playlistThumbnail: 'https://i.ytimg.com/a.jpg' },
    ] });
    const res = await request(app()).get('/api/creators/playlists/search').query({ q: 'lofi one' });
    expect(res.body.playlists).toEqual([{
      playlistId: PL, title: 'Lo-fi mix', channel: 'Chill', count: 42,
      thumbnail: 'https://i.ytimg.com/a.jpg', url: `https://www.youtube.com/playlist?list=${PL}`,
    }]);
    expect(gateway.fromPool.mock.calls[0][0]).toContain('type=playlist');
  });

  test('falls back to the Data API, then SearXNG, then an empty list', async () => {
    gateway.fromPool.mockResolvedValue(null);
    process.env.YOUTUBE_API_KEY = 'k';
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: { playlistId: 'PLdataapi123456' }, snippet: { title: 'From API', channelTitle: 'C' } }] }) });
    let res = await request(app()).get('/api/creators/playlists/search').query({ q: 'data api case' });
    expect(res.body.playlists[0].playlistId).toBe('PLdataapi123456');

    delete process.env.YOUTUBE_API_KEY;
    process.env.SEARXNG_URL = 'http://searx.test';
    axios.get.mockResolvedValueOnce({ data: { results: [
      { url: 'https://www.youtube.com/watch?v=abc123abc12', title: 'a video' },
      { url: 'https://www.youtube.com/playlist?list=PLsearxng123456', title: 'Searx list - YouTube' },
    ] } });
    res = await request(app()).get('/api/creators/playlists/search').query({ q: 'searx case' });
    expect(res.body.playlists.map((p) => p.playlistId)).toEqual(['PLsearxng123456']);
    expect(res.body.playlists[0].title).toBe('Searx list');

    axios.get.mockRejectedValueOnce(new Error('down'));
    res = await request(app()).get('/api/creators/playlists/search').query({ q: 'nothing works' });
    expect(res.body.playlists).toEqual([]);
  });

  test('says "unavailable" only when every source failed, not when a search ran and found nothing', async () => {
    // Every source refused: the page must be able to say search is down.
    gateway.fromPool.mockResolvedValueOnce(null);
    process.env.YOUTUBE_API_KEY = 'k';
    global.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    let res = await request(app()).get('/api/creators/playlists/search').query({ q: 'refused case' });
    expect(res.body.playlists).toEqual([]);
    expect(res.body.unavailable).toBe(true);

    // The Data API answered OK with zero playlists: a real "no matches", not down.
    gateway.fromPool.mockResolvedValueOnce(null);
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
    res = await request(app()).get('/api/creators/playlists/search').query({ q: 'no matches here' });
    expect(res.body.playlists).toEqual([]);
    expect(res.body.unavailable).toBe(false);
    delete process.env.YOUTUBE_API_KEY;
  });

  test('rejects a one-letter query', async () => {
    const res = await request(app()).get('/api/creators/playlists/search').query({ q: 'a' });
    expect(res.status).toBe(400);
  });
});

describe('GET /playlist import', () => {
  test('without a Data API key it takes the full list from Invidious, not the 15-video RSS', async () => {
    const page = (n, start) => ({ base: 'x', data: { videoCount: 130, videos: Array.from({ length: n }, (_, i) => ({ videoId: `vid${String(start + i).padStart(8, '0')}`, title: `t${start + i}`, author: 'A' })) } });
    gateway.fromPool.mockResolvedValueOnce(page(100, 0)).mockResolvedValueOnce(page(30, 100));
    const res = await request(app()).get('/api/creators/playlist').query({ url: `https://www.youtube.com/playlist?list=${PL}` });
    expect(res.body.source).toBe('invidious');
    expect(res.body.videos).toHaveLength(130);
    expect(res.body.complete).toBe(true);
    expect(res.body.videos[0].url).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=vid/);
    expect(global.fetch).not.toHaveBeenCalled();   // RSS never needed
  });

  test('falls back to RSS when Invidious has nothing', async () => {
    gateway.fromPool.mockResolvedValue(null);
    global.fetch.mockResolvedValueOnce({ ok: true, text: async () => '<feed><entry><yt:videoId>rssvideo001</yt:videoId><title>R</title></entry></feed>' });
    const res = await request(app()).get('/api/creators/playlist').query({ url: 'https://www.youtube.com/playlist?list=PLrssfallback12' });
    expect(res.body.source).toBe('rss');
  });
});
