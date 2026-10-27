jest.mock('axios');
const axios = require('axios');
process.env.TRANSCRIPT_INVIDIOUS_INSTANCES = 'https://a.test,https://b.test,https://c.test,https://d.test';
const YT = require('../services/YouTubeGateway');

const vid = (id) => [{ type: 'video', videoId: id.padEnd(11, 'x'), title: 't', author: 'a', lengthSeconds: 60 }];
beforeEach(() => { axios.get.mockReset(); });

test('asks at most 3 instances at once and the first good answer wins, even if another is slow', async () => {
  axios.get.mockImplementation((url) => {
    if (url.startsWith('https://a.test') || url.startsWith('https://b.test') || url.startsWith('https://c.test') || url.startsWith('https://d.test')) {
      if (axios.get.mock.calls.length === 1) return new Promise(() => {}); // first one hangs forever
      return Promise.resolve({ status: 200, data: vid('good') });
    }
    return Promise.reject(new Error('unexpected'));
  });
  const out = await YT.searchVideos('anything');
  expect(out.items[0].id.videoId).toMatch(/^good/);
  expect(axios.get.mock.calls.length).toBeLessThanOrEqual(3);
});

test('instances that are cooling down are skipped, and an all-cold pool answers null at once', async () => {
  axios.get.mockRejectedValue(Object.assign(new Error('boom'), { code: 'ENOTFOUND' }));
  await YT.searchVideos('one');           // fails every probed instance -> they cool down
  await YT.searchVideos('two');           // probes the remaining ready one(s)
  axios.get.mockClear();
  const t = Date.now();
  const out = await YT.searchVideos('three'); // everything cold now
  expect(out).toBeNull();
  expect(axios.get).not.toHaveBeenCalled();
  expect(Date.now() - t).toBeLessThan(200);
});
