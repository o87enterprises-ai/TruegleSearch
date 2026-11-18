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
const D = 86400;
const mockUploads = [inv('short0000001', 10), inv('video0000001', 20), inv('short0000002', 3 * D), inv('video0000002', 20 * D), inv('video0000003', 200 * D)];

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

test('since keeps only posts inside the range, newest first; junk means any time', async () => {
  const f = (since) => fetchCreatorsFeed('', 50, undefined, 'roland-martin', 'all', since);
  expect(ids(await f('day'))).toEqual(['short0000001', 'video0000001']);
  expect(ids(await f('week'))).toHaveLength(3);
  expect(ids(await f('month'))).toHaveLength(4);
  expect(ids(await f('year'))).toHaveLength(5);
  expect(ids(await f('banana'))).toHaveLength(5);
  const month = await f('month');
  expect(month.items.map((i) => i.url.split('v=')[1])).toEqual(['short0000001', 'video0000001', 'short0000002', 'video0000002']);
});

test('order=newest / oldest sorts by date; a range alone stays newest first; junk is the mix', async () => {
  const f = (since, order) => fetchCreatorsFeed('', 50, undefined, 'roland-martin', 'all', since, order);
  const seq = (r) => r.items.map((i) => i.url.split('v=')[1]);
  const asc = ['video0000003', 'video0000002', 'short0000002', 'video0000001', 'short0000001'];
  expect(seq(await f('any', 'newest'))).toEqual([...asc].reverse());
  expect(seq(await f('any', 'oldest'))).toEqual(asc);
  expect(seq(await f('month', 'oldest'))).toEqual(asc.slice(1));
  expect(seq(await f('month'))).toEqual([...asc].reverse().slice(0, 4));
  expect(ids(await f('any', 'banana'))).toHaveLength(5);
});
