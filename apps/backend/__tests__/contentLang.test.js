// The Feed/Tube language filter: detection, spoken-language lookup, Local/Global.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';

const mockSpoken = {}; // youtube id -> language its auto captions are in
jest.mock('../services/YouTubeGateway', () => ({
  captionList: jest.fn(async (id) => (mockSpoken[id]
    ? { data: { captions: [{ label: 'English', languageCode: 'en' }, { label: `${mockSpoken[id]} (auto-generated)`, languageCode: mockSpoken[id] }] } }
    : { data: { captions: [] } })),
}));

const { detectLang } = require('../services/langDetect');
const AudioLang = require('../services/AudioLang');
const ContentLang = require('../services/ContentLang');

const yt = (id) => `https://www.youtube.com/watch?v=${id}`;
const post = (title, extra = {}) => ({ id: title, title, url: 'https://example.com/p', ...extra });

beforeEach(() => { AudioLang.__known.clear(); for (const k of Object.keys(mockSpoken)) delete mockSpoken[k]; delete process.env.YOUTUBE_API_KEY; });

describe('detectLang', () => {
  test.each([
    ['The best viral clips of the week you have to watch', 'en'],
    ['Los mejores momentos de la semana que no te puedes perder', 'es'],
    ['Os melhores momentos da semana que você não pode perder', 'pt'],
    ['Les meilleurs moments de la semaine pour vous', 'fr'],
    ['Die besten Momente der Woche, die du nicht verpassen darfst', 'de'],
    ['Привет как дела у тебя', 'ru'],
    ['これは日本語のタイトルです', 'ja'],
    ['这是中文标题', 'zh'],
    ['मेरा नाम राम है', 'hi'],
    ['Video lucu banget yang tidak bisa kamu lewatkan', 'id'],
  ])('%s -> %s', (t, lang) => expect(detectLang(t).lang).toBe(lang));
  test('too little to tell is "und", never a guess', () => {
    for (const t of ['PART 2 viral clip highlights', '#fyp #foryou', 'Mind Unveiled', 'ok', '', null]) expect(detectLang(t).lang).toBe('und');
  });
});

describe('AudioLang (YouTube spoken language)', () => {
  test('reads the AUTO-GENERATED caption track, not a manual one', async () => {
    mockSpoken.aaaaaaaaaaa = 'es';
    const m = await AudioLang.lookup(['aaaaaaaaaaa']);
    expect(m.get('aaaaaaaaaaa')).toBe('es');
  });
  test('no auto track = unknown; answers are remembered (asked once)', async () => {
    const gateway = require('../services/YouTubeGateway');
    gateway.captionList.mockClear();
    expect((await AudioLang.lookup(['bbbbbbbbbbb'])).has('bbbbbbbbbbb')).toBe(false);
    mockSpoken.ccccccccccc = 'en';
    await AudioLang.lookup(['ccccccccccc']); await AudioLang.lookup(['ccccccccccc', 'bbbbbbbbbbb']);
    expect(gateway.captionList).toHaveBeenCalledTimes(2); // b once, c once
  });
  test('uses the Data API defaultAudioLanguage first when a key is set', async () => {
    process.env.YOUTUBE_API_KEY = 'k';
    const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ items: [{ id: 'ddddddddddd', snippet: { defaultAudioLanguage: 'pt-BR' } }] }) }));
    const m = await AudioLang.lookup(['ddddddddddd'], { fetchImpl });
    expect(m.get('ddddddddddd')).toBe('pt');
  });
});

describe('Local / Global', () => {
  const payloadOf = (items) => ({ results: items, platforms: { tiktok: items }, nextCursor: {}, errors: {} });

  test('LOCAL keeps only the visitor\'s language (and undetermined text in their script)', async () => {
    const items = [post('The best clips of the week you have to watch'), post('Los mejores momentos de la semana que no te puedes perder'),
      post('PART 2 viral clip highlights'), post('Привет как дела у тебя')];
    const p = await ContentLang.annotate(payloadOf(items));
    const out = ContentLang.filterByLang(p, { lang: 'en-US', mode: 'local' });
    expect(out.results.map((r) => r.title)).toEqual(['The best clips of the week you have to watch', 'PART 2 viral clip highlights']);
    expect(out.platforms.tiktok).toHaveLength(2);
  });

  test('GLOBAL keeps everything, the visitor\'s language first, original order otherwise', async () => {
    const items = [post('Los mejores momentos de la semana que no te puedes perder'), post('PART 2 viral clip highlights'), post('The best clips of the week you have to watch')];
    const p = await ContentLang.annotate(payloadOf(items));
    const out = ContentLang.filterByLang(p, { lang: 'en', mode: 'global' });
    expect(out.results.map((r) => r.title)).toEqual(['The best clips of the week you have to watch', 'PART 2 viral clip highlights', 'Los mejores momentos de la semana que no te puedes perder']);
  });

  test('SPOKEN language wins: an English title over Spanish audio is NOT English', async () => {
    mockSpoken.eeeeeeeeeee = 'es';
    mockSpoken.fffffffffff = 'en';
    const items = [post('The best clips of the week you have to watch', { url: yt('eeeeeeeeeee') }),
      post('Los mejores momentos de la semana', { url: yt('fffffffffff') })];
    const p = await ContentLang.annotate(payloadOf(items));
    expect(ContentLang.filterByLang(p, { lang: 'en', mode: 'local' }).results.map((r) => r.url)).toEqual([yt('fffffffffff')]);
    expect(ContentLang.filterByLang(p, { lang: 'es', mode: 'local' }).results.map((r) => r.url)).toEqual([yt('eeeeeeeeeee')]);
  });

  test('a network\'s own language label is trusted (Mastodon/Bluesky)', async () => {
    const p = await ContentLang.annotate(payloadOf([post('Bonjour', { lang: 'fr' }), post('Hello', { lang: 'en-GB' })]));
    expect(ContentLang.filterByLang(p, { lang: 'fr', mode: 'local' }).results.map((r) => r.title)).toEqual(['Bonjour']);
  });

  test('never mutates the (cached) payload; no or bad language = unchanged', async () => {
    const items = [post('Los mejores momentos de la semana que no te puedes perder'), post('The best clips of the week you have to watch')];
    const p = await ContentLang.annotate(payloadOf(items));
    const snapshot = JSON.stringify(p);
    ContentLang.filterByLang(p, { lang: 'en', mode: 'local' });
    ContentLang.filterByLang(p, { lang: 'en', mode: 'global' });
    expect(JSON.stringify(p)).toBe(snapshot);
    expect(ContentLang.filterByLang(p, { lang: '' })).toBe(p);
    expect(ContentLang.filterByLang(p, { lang: '<script>' })).toBe(p);
  });
});
