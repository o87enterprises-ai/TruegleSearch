/**
 * Adult titles are not STORED in the shared catalog.
 *
 * Owner, 2026-10-13: "let's not store any adult content if possible. If a user
 * searches it I want them to be allowed to see what they look up if safe search
 * is off, but I don't want the adult titles indexed."
 *
 * Search reads the engines, never these tables, so refusing to STORE changes
 * nothing about what anyone can find or play. Four doors into the catalog are
 * guarded — plays/votes, playlist import, link submissions, reel submissions —
 * and rows stored before this are cleaned by purgeExplicit (dry-run by default).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-for-adult';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
const mockQuery = jest.fn();
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a), pool: {} }));
const mockLookup = jest.fn();
jest.mock('../services/OembedService', () => ({ lookup: (...a) => mockLookup(...a) }));
jest.mock('../utils/logger', () => ({ info: () => {}, warn: () => {}, error: () => {} }));
const express = require('express');
const request = require('supertest');
const { MediaService } = require('../services/MediaService');
const { ReelsService } = require('../services/ReelsService');

beforeEach(() => {
  mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [{ ups: 0, downs: 0, broken: 0, hidden: false }] });
  mockLookup.mockReset(); mockLookup.mockResolvedValue({ title: 'A Perfectly Ordinary Video' });
});

const KEY = 'youtube:abcdefghijk';
const URL1 = 'https://www.youtube.com/watch?v=abcdefghijk';

describe('plays and votes (media_signals)', () => {
  it('an ordinary play is recorded', async () => {
    await MediaService.signal({ key: KEY, play: true, kind: 'youtube', title: 'A lovely acoustic session', pageUrl: URL1 });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
  it('an adult play is NOT recorded — nothing is written at all', async () => {
    const r = await MediaService.signal({ key: KEY, play: true, kind: 'youtube', title: 'Hot porn compilation', pageUrl: URL1 });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, skipped: 'adult' });
  });
  it('…nor an adult thumbs-up, nor one flagged by its channel', async () => {
    await MediaService.signal({ key: KEY, from: 0, to: 1, title: 'Hentai Breeding Simulator' });
    await MediaService.signal({ key: KEY, play: true, title: 'Ordinary title', channel: 'Free Porn Channel' });
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('a song with a swearing or a soft-word title is still recorded (music passes)', async () => {
    await MediaService.signal({ key: KEY, play: true, kind: 'youtube', title: 'N.W.A - Fuck tha Police (Official Video)' });
    await MediaService.signal({ key: KEY, play: true, kind: 'youtube', title: 'James Arthur - Naked (Official Audio)' });
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
  it('a "broken" report on an adult video is still recorded — but with NO title, link, poster or channel', async () => {
    await MediaService.signal({
      key: KEY, broken: true, kind: 'youtube', title: 'Hot porn compilation', pageUrl: URL1,
      poster: 'https://i.ytimg.com/x.jpg', channel: 'Some Channel',
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const args = mockQuery.mock.calls[0][1];
    expect(args[0]).toBe(KEY);
    expect(args.slice(2, 6)).toEqual([null, null, null, null]);   // title, page_url, poster, channel
    expect(args[9]).toBe(1);                                       // broken counter still moves
  });
});

describe('playlist import (MediaService.index)', () => {
  const vid = (i, title) => ({ videoId: `abcdefghi${String(i).padStart(2, '0')}`, title, channel: 'Chan' });
  it('skips the adult videos one by one and indexes the rest of the playlist', async () => {
    const n = await MediaService.index([vid(1, 'Cute puppies'), vid(2, 'Rule 34 compilation'), vid(3, 'Study music'), vid(4, 'Hentai AMV')]);
    expect(n).toBe(2);
    expect(mockQuery.mock.calls[0][1][0]).toEqual(['youtube:abcdefghi01', 'youtube:abcdefghi03']);
    expect(mockQuery.mock.calls[0][1][1]).toEqual(['Cute puppies', 'Study music']);
  });
  it('a playlist that is ALL adult stores nothing and does not even query', async () => {
    expect(await MediaService.index([vid(1, 'porn'), vid(2, 'xxx')])).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('link submissions (community_media)', () => {
  it('an ordinary link is stored', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 1, url: URL1, kind: 'youtube', platform: 'YouTube', title: 'A Perfectly Ordinary Video', thumbnail: null }] });
    await MediaService.submit({ url: URL1 });
    expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO community_media/i.test(sql))).toBe(true);
  });
  it('a link whose platform title is adult is REFUSED, with a message that says it can still be played', async () => {
    mockLookup.mockResolvedValue({ title: 'Hot Cam Girls live' });
    await expect(MediaService.submit({ url: URL1 })).rejects.toMatchObject({ code: 'NOT_INDEXED', message: expect.stringMatching(/still play it yourself/) });
    expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO community_media/i.test(sql))).toBe(false);
  });
  it('a signed-in submitter cannot type an adult title past it either', async () => {
    await expect(MediaService.submit({ url: URL1, title: 'Hentai Breeding Simulator', userId: 7 })).rejects.toMatchObject({ code: 'NOT_INDEXED' });
  });
  it('over HTTP that is a 422 with a code the client can read', async () => {
    mockLookup.mockResolvedValue({ title: 'Hot Cam Girls live' });
    const app = express(); app.use(express.json()); app.use('/api/media', require('../routes/media'));
    const res = await request(app).post('/api/media').send({ url: URL1 });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NOT_INDEXED');
  });
});

describe('reel submissions (community_reels)', () => {
  const REEL = 'https://www.tiktok.com/@someone/video/7234567890123456789';
  it('an adult title is refused', async () => {
    await expect(ReelsService.submit({ url: REEL, title: 'Nsfw rule 34 comic' })).rejects.toMatchObject({ code: 'NOT_INDEXED' });
    expect(mockQuery).not.toHaveBeenCalled();
  });
  it('an ordinary one — or one with no title — is stored as before', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
    await ReelsService.submit({ url: REEL, title: 'My cat doing a thing' });
    await ReelsService.submit({ url: REEL });
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});

describe('purgeExplicit — cleaning what was stored before', () => {
  const sig = [
    { media_key: 'youtube:aaaaaaaaaaa', kind: 'youtube', title: 'A lovely song (Official Audio)', page_url: '', channel: 'Artist - Topic', broken: 0 },
    { media_key: 'youtube:bbbbbbbbbbb', kind: 'youtube', title: 'Hentai Breeding Simulator', page_url: '', channel: null, broken: 0 },
    { media_key: 'youtube:ccccccccccc', kind: 'youtube', title: 'Rule 34 compilation', page_url: '', channel: null, broken: 3 },
  ];
  const media = [{ id: 11, kind: 'youtube', title: 'Hot Cam Girls', url: URL1 }, { id: 12, kind: 'youtube', title: 'Nice video', url: URL1 }];
  const reels = [{ id: 21, title: 'xxx', url: 'https://www.tiktok.com/x' }, { id: 22, title: null, url: 'https://www.tiktok.com/y' }];
  beforeEach(() => {
    mockQuery.mockImplementation(async (sql) => {
      if (/FROM media_signals/i.test(sql)) return { rows: sig };
      if (/FROM community_media/i.test(sql)) return { rows: media };
      if (/FROM community_reels/i.test(sql)) return { rows: reels };
      return { rows: [] };
    });
  });
  const writes = () => mockQuery.mock.calls.filter(([sql]) => /^\s*(DELETE|UPDATE)/i.test(sql));

  it('is a DRY RUN by default: it counts and samples, and writes nothing', async () => {
    const r = await MediaService.purgeExplicit();
    expect(r).toMatchObject({ apply: false, signals: 1, scrubbed: 1, media: 1, reels: 1 });
    expect(r.sample.length).toBeGreaterThan(0);
    expect(writes()).toHaveLength(0);
  });
  it('with apply it deletes — but SCRUBS a row that carries "broken" reports, keeping the dead-video list intact', async () => {
    await MediaService.purgeExplicit({ apply: true });
    const sqls = writes().map(([sql, args]) => [sql.replace(/\s+/g, ' ').trim(), args]);
    expect(sqls).toContainEqual(['DELETE FROM media_signals WHERE media_key = ANY($1::text[])', [['youtube:bbbbbbbbbbb']]]);
    expect(sqls.some(([sql, args]) => /^UPDATE media_signals SET title = NULL/.test(sql) && args[0][0] === 'youtube:ccccccccccc')).toBe(true);
    expect(sqls).toContainEqual(['DELETE FROM community_media WHERE id = ANY($1)', [[11]]]);
    expect(sqls).toContainEqual(['DELETE FROM community_reels WHERE id = ANY($1)', [[21]]]);
  });
  it('never touches the ordinary rows', async () => {
    await MediaService.purgeExplicit({ apply: true });
    const touched = JSON.stringify(writes().map(([, a]) => a));
    expect(touched).not.toContain('youtube:aaaaaaaaaaa');
    expect(touched).not.toContain('12');
  });
});
