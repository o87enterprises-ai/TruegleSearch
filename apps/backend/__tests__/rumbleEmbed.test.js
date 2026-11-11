// Rumble's page id is not its embed id (owner, 2026-11-10: "Video not found").
const { resolveRumble, isRumblePage, __cache } = require('../routes/embed');

const PAGE = 'https://rumble.com/v7hhvy2-russia-and-ukraine-agree-to-rare-ceasefire.html';

describe('Rumble embed resolver', () => {
  beforeEach(() => __cache.clear());

  test('takes the embed id from oEmbed, not from the page link', async () => {
    const get = jest.fn().mockResolvedValue({ data: { html: '<iframe src="https://rumble.com/embed/v7fbj0k/" width="1920"></iframe>' } });
    expect(await resolveRumble(PAGE, { get })).toBe('https://rumble.com/embed/v7fbj0k/');
    expect(get.mock.calls[0][1].params.url).toBe(PAGE);
  });

  test('remembers answers, including failures', async () => {
    const get = jest.fn().mockRejectedValue(new Error('timeout'));
    expect(await resolveRumble(PAGE, { get })).toBeNull();
    expect(await resolveRumble(PAGE, { get })).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });

  test('only rumble.com video pages are looked up', () => {
    expect(isRumblePage(PAGE)).toBe(true);
    expect(isRumblePage('https://rumble.com.evil.example/v1abc')).toBe(false);
    expect(isRumblePage('http://rumble.com/v1abc')).toBe(false);
    expect(isRumblePage('https://rumble.com/user/someone')).toBe(false);
  });
});
