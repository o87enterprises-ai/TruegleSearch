/**
 * Anonymous community submissions.
 *
 * Migration 018 required a signed-in submitter and wrote down why: an open
 * write to a store every visitor can play is a spam door. 023 opens it for a
 * frictionless paste-a-link flow and moves the protection into constraints
 * rather than removing it.
 *
 * So these tests are the protection. If they pass and the feature still gets
 * abused, the design was wrong; if they fail, the door is open.
 */

const rows = [];
const mockQuery = jest.fn((sql, params) => {
  if (/INSERT INTO community_media/i.test(sql)) {
    const [url, canonical, kind, platform, title, thumbnail, submitted_by] = params;
    const existing = rows.find((r) => r.canonical === canonical);
    if (existing) {
      // ON CONFLICT DO UPDATE SET title = COALESCE(existing, new)
      existing.title = existing.title ?? title;
      return Promise.resolve({ rows: [{ ...existing }] });
    }
    const row = {
      id: rows.length + 1, url, canonical, kind, platform, title, thumbnail, submitted_by,
      created_at: new Date().toISOString(),
    };
    rows.push(row);
    return Promise.resolve({ rows: [{ ...row }] });
  }
  return Promise.resolve({ rows: [] });
});

const mockLookup = jest.fn().mockResolvedValue({ title: 'A Real Platform Title' });

jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a), pool: {} }));
jest.mock('../services/OembedService', () => ({ lookup: (...a) => mockLookup(...a) }));
jest.mock('../utils/logger', () => ({ info: () => {}, warn: () => {}, error: () => {} }));

const { MediaService } = require('../services/MediaService');

const YT = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const FILE = 'https://someones-server.example/clip.mp4';

beforeEach(() => { rows.length = 0; jest.clearAllMocks(); });

describe('a stranger pasting a platform link', () => {
  it('gets a post, with no account', async () => {
    const media = await MediaService.submit({ url: YT, userId: null });
    expect(media.kind).toBe('youtube');
    expect(rows).toHaveLength(1);
  });

  it('is recorded as unclaimed rather than attributed to nobody in particular', async () => {
    const media = await MediaService.submit({ url: YT, userId: null });
    expect(rows[0].submitted_by).toBeNull();
    expect(media.anonymous).toBe(true);
  });

  it('gets the PLATFORM\'s title, never text from the request', async () => {
    // The link points at something a platform already moderates. A submitted
    // title is an unmoderated message in a feed everyone sees, which is the
    // actual spam surface.
    const media = await MediaService.submit({
      url: YT, userId: null, title: 'BUY CHEAP PILLS http://spam.example',
    });
    expect(media.title).toBe('A Real Platform Title');
    expect(rows[0].title).not.toMatch(/PILLS|spam/i);
  });

  it('still posts when the platform has no title to give', async () => {
    // A missing title is cosmetic. Failing the submission over it would be
    // rejecting a perfectly good link because a third party was slow.
    mockLookup.mockResolvedValueOnce(null);
    await expect(MediaService.submit({ url: YT, userId: null })).resolves.toBeTruthy();
  });

  it('still posts when the oEmbed lookup throws outright', async () => {
    mockLookup.mockRejectedValueOnce(new Error('provider down'));
    await expect(MediaService.submit({ url: YT, userId: null })).resolves.toBeTruthy();
  });
});

describe('the hole this must not have', () => {
  it('REFUSES a direct file link from a stranger', async () => {
    // classifyMedia accepts any https URL ending in a media extension. From an
    // attributable submitter that is a feature. From a stranger it is
    // arbitrary media on someone else's server, with no platform moderating it
    // and nobody to hold responsible, promoted into a feed everyone sees.
    await expect(MediaService.submit({ url: FILE, userId: null }))
      .rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' });
    expect(rows).toHaveLength(0);
  });

  it('names the way forward instead of just saying no', async () => {
    await expect(MediaService.submit({ url: FILE, userId: null }))
      .rejects.toThrow(/YouTube|Vimeo|TikTok|SoundCloud|Reddit/);
  });

  it('still refuses a link no platform rule recognises', async () => {
    await expect(MediaService.submit({ url: 'https://example.com/not-media', userId: null }))
      .rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('cannot be flooded with one link — the same URL is one row', async () => {
    await MediaService.submit({ url: YT, userId: null });
    await MediaService.submit({ url: `${YT}&utm_source=spam`, userId: null });
    await MediaService.submit({ url: 'https://youtu.be/dQw4w9WgXcQ', userId: null });
    expect(rows).toHaveLength(1);
  });
});

describe('signing in still buys something', () => {
  it('a signed-in submitter may post a direct file link', async () => {
    const media = await MediaService.submit({ url: FILE, userId: 42 });
    expect(media.kind).toBe('video');
    expect(rows[0].submitted_by).toBe(42);
  });

  it('…and may set their own title, without an oEmbed round trip', async () => {
    const media = await MediaService.submit({ url: YT, userId: 42, title: 'My own words' });
    expect(media.title).toBe('My own words');
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('…and their post is not badged anonymous', async () => {
    const media = await MediaService.submit({ url: YT, userId: 42 });
    expect(media.anonymous).toBe(false);
  });
});
