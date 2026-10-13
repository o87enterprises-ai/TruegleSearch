// Owner, 2026-10-13: "yes, hide explicit titles." The cold-start pool is what a
// new visitor's Up next is drawn from, and it was served unfiltered to everyone
// — Safe Search on or not. Pins: explicit titles are out of the pool unless the
// visitor is SIGNED IN and asked for Safe Search "off" (the same rule as the
// social feed); rows that are not a single video are out for everyone; and
// ordinary titles — including the classic false-positive traps — are untouched.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-for-pool';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
const mockQuery = jest.fn();
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { isExplicitTitle, isJunkRow } = require('../utils/explicitTitle');

describe('isExplicitTitle', () => {
  it.each([
    'Hentai Breeding Simulator from Cute Pen Games',
    'Top Heavy Busty Zoe | Plus Size Model Curvy | Modè',
    'Homosexual-Fellatio-Erect-Penis-Licking',
    'NSFW compilation', 'Free PORN site', 'xxx', 'amateur nudes 2024', 'Hot Cam Girls live',
    'milf next door', 'strip tease night', 'adult film behind the scenes', 'Sex Tape leaked',
    // glued tokens and variants seen in the live pool
    'lara-with-horse-episode-2-animopron_720p', 'try not to Cum', 'Nut Buster Jackoff Videos',
    'Valentina (Fellatrix)', '#nsfw edit', 'Rule 34 compilation',
    'Erome: Videos, Fotos y Más', 'JUICY JACKIE // SSBBW', 'Pawg 🍑', 'MISSDOLL SEX ROBOT ORAL-V2', 'Rompiendo la REGLA 34 / HELP ME!',
  ])('hides %s', (t) => expect(isExplicitTitle(t)).toBe(true));

  it.each([
    'Help Me I\'m Gonna Die', 'Do You Feel It?', 'Angine de Poitrine - Full Performance (Live on KEXP)',
    'Tree Between Realms: Upanishads Quick Rundown #eastern',
    // The Scunthorpe problem: a bare substring match would catch every one of these.
    'Essex documentary', 'Sussex Police appeal', 'Middlesex Hospital tour', 'Data Analysis tutorial',
    'Assessment guide for teachers', 'Sextant navigation basics', 'Grape Escape', 'Analyst interview',
    'Cockpit view: landing at Heathrow', 'Classic rock playlist', 'Scunthorpe United highlights',
    'XXXTentacion - SAD!', 'How to sew an apron', 'Unicorn cake tutorial', 'Cumbria walking holiday',
    'Cucumber salad', 'Documentary: the Corn Belt', 'Nissan Skyline R34 GT-R review', 'FUTA expels six students',
  ])('leaves %s alone', (t) => expect(isExplicitTitle(t)).toBe(false));

  it('is safe on non-strings', () => {
    expect(isExplicitTitle(null)).toBe(false);
    expect(isExplicitTitle(undefined)).toBe(false);
    expect(isExplicitTitle(42)).toBe(false);
  });
});

describe('isJunkRow', () => {
  it('catches rows that are not one watchable video', () => {
    expect(isJunkRow({ mediaKey: 'youtube:videoseries', title: 'youtube.com/playlist' })).toBe(true);
    expect(isJunkRow({ title: 'x', pageUrl: 'https://www.youtube.com/playlist?list=PL123' })).toBe(true);
    expect(isJunkRow({ title: 'x', pageUrl: 'https://www.youtube.com/embed/videoseries?list=PL1' })).toBe(true);
  });
  it('does NOT hide a real video just because its title lookup failed and left a link', () => {
    // Live pool, 2026-10-13: these were hidden by a first, broader rule.
    expect(isJunkRow({ mediaKey: 'youtube:dQw4w9WgXcQ', title: 'youtube.com/watch', pageUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })).toBe(false);
    expect(isJunkRow({ mediaKey: 'youtube:9bZkp7q19f0', title: 'youtu.be/9bZkp7q19f0' })).toBe(false);
    expect(isJunkRow({ mediaKey: 'youtube:abcdefghijk', title: 'My YouTube channel tour' })).toBe(false);
  });
});

const row = (i, title, extra = {}) => ({
  media_key: `youtube:abcdefghi${String(i).padStart(2, '0')}`, kind: 'youtube', title,
  page_url: `https://www.youtube.com/watch?v=abcdefghi${String(i).padStart(2, '0')}`,
  poster: '', channel: 'Chan', ups: 1, downs: 0, plays: 1, score: 0.5, ...extra,
});
const ROWS = [
  row(1, 'A lovely acoustic session'),
  row(2, 'Hentai Breeding Simulator'),
  row(3, 'Documentary about bees'),
  row(4, 'youtube.com/playlist', { media_key: 'youtube:videoseries', page_url: 'https://www.youtube.com/playlist?list=PL1' }),
  row(5, 'Ordinary title', { channel: 'Free Porn Channel' }),
  row(6, 'Another ordinary video'),
];

const app = express();
app.use(express.json());
app.use('/api/media', require('../routes/media'));
const token = () => jwt.sign({ userId: 7 }, config.jwtSecret, { expiresIn: '1h' });
const ask = (qs, tok) => {
  const r = request(app).get(`/api/media/trending?${qs}`);
  return tok ? r.set('Authorization', `Bearer ${tok}`) : r;
};
const titles = (res) => res.body.results.map((r) => r.title);

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: ROWS }); });

describe('GET /api/media/trending', () => {
  it('hides explicit titles — and bad rows — by default', async () => {
    expect(titles(await ask('limit=10'))).toEqual(['A lovely acoustic session', 'Documentary about bees', 'Another ordinary video']);
  });
  it('also hides a row whose CHANNEL is explicit', async () => {
    expect(titles(await ask('limit=10'))).not.toContain('Ordinary title');
  });
  it('cannot be unlocked by an anonymous ?safe=off', async () => {
    expect(titles(await ask('limit=10&safe=off'))).not.toContain('Hentai Breeding Simulator');
  });
  it('"blur" (moderate) gets the filtered pool too', async () => {
    expect(titles(await ask('limit=10&safe=blur'))).not.toContain('Hentai Breeding Simulator');
  });
  it('a signed-in visitor with Safe Search off gets explicit titles back', async () => {
    const t = titles(await ask('limit=10&safe=off', token()));
    expect(t).toContain('Hentai Breeding Simulator');
    expect(t).toContain('Ordinary title');
  });
  it('…but a signed-in visitor who did NOT ask for off is still filtered', async () => {
    expect(titles(await ask('limit=10', token()))).not.toContain('Hentai Breeding Simulator');
  });
  it('not-a-video rows are hidden even for a signed-in visitor with Safe Search off', async () => {
    expect(titles(await ask('limit=10&safe=off', token()))).not.toContain('youtube.com/playlist');
  });
  it('still fills the page: it asks the database for more than the page needs', async () => {
    const res = await ask('limit=3');
    expect(res.body.results).toHaveLength(3);
    expect(mockQuery.mock.calls[0][1][0]).toBe(9);
  });
});
