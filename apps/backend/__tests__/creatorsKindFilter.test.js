/**
 * The creators feed's Shorts / Videos / All filter, through the real
 * fetchCreatorsFeed: only the upstream (channel list + YouTube's /shorts/
 * probe) is stubbed.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';
delete process.env.YOUTUBE_API_KEY; // force the gateway path

const inv = (id, ago) => ({ videoId: id, title: `Title ${id}`, published: Math.floor(Date.now() / 1000) - ago, videoThumbnails: [{ url: `https://i.ytimg.com/vi/${id}/hq.jpg` }] });
const mockUploads = [inv('short0000001', 10), inv('video0000001', 20), inv('short0000002', 30), inv('video0000002', 40), inv('video0000003', 50)];

jest.mock('../services/YouTubeGateway', () => ({
  channelUploads: jest.fn(async () => ({ kind: 'invidious', data: mockUploads })),
  direct: jest.fn(), resolveHandle: jest.fn(),
}));

const realFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn(async (url) => {
    const m = /\/shorts\/([^/?]+)/.exec(String(url));
    if (!m) throw new Error(`unexpected fetch ${url}`);
    return { status: m[1].startsWith('short') ? 200 : 303 };
  });
});
afterAll(() => { global.fetch = realFetch; });

const { fetchCreatorsFeed } = require('../routes/creators');
const ids = (r) => r.items.map((i) => i.url.split('v=')[1]).sort();

test('kind=short returns only Shorts, kind=video only the rest, all returns everything', async () => {
  const shorts = await fetchCreatorsFeed('', 50, undefined, 'roland-martin', 'short');
  const videos = await fetchCreatorsFeed('', 50, undefined, 'roland-martin', 'video');
  const all = await fetchCreatorsFeed('', 50, undefined, 'roland-martin', 'all');
  expect(ids(shorts)).toEqual(['short0000001', 'short0000002']);
  expect(ids(videos)).toEqual(['video0000001', 'video0000002', 'video0000003']);
  expect(ids(all)).toHaveLength(5);
  expect(shorts.items.every((i) => i.isShort === true)).toBe(true);
  expect(videos.items.every((i) => i.isShort === false)).toBe(true);
});

test('the default (no kind) and a nonsense kind both mean everything', async () => {
  expect(ids(await fetchCreatorsFeed('', 50, undefined, 'roland-martin'))).toHaveLength(5);
  expect(ids(await fetchCreatorsFeed('', 50, undefined, 'roland-martin', 'banana'))).toHaveLength(5);
});

test('paging stays consistent under a filter: the filter applies before the offset', async () => {
  const p1 = await fetchCreatorsFeed('', 2, undefined, 'roland-martin', 'video');
  expect(p1.items).toHaveLength(2);
  expect(p1.next).toBe(2);
  const p2 = await fetchCreatorsFeed('', 2, p1.next, 'roland-martin', 'video');
  expect(p2.items).toHaveLength(1);
  expect(p2.next).toBeNull();
  expect([...ids(p1), ...ids(p2)].sort()).toEqual(['video0000001', 'video0000002', 'video0000003']);
});
