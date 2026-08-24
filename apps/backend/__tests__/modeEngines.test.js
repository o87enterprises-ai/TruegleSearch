const modeEngines = require('../data/modeEngines');

/**
 * These lock in the property that makes Truegle's modes mean anything: they
 * must RETRIEVE from different places, not just re-sort one shared list.
 *
 * The bug this guards against is silent. If every mode resolves to the same
 * engine string, search still works perfectly — it just quietly returns the
 * same page under every mode, which is exactly the state this replaced.
 */
describe('per-mode SearXNG engine sets', () => {
  const ENV_BACKUP = { ...process.env };
  afterEach(() => {
    for (const key of Object.values(modeEngines.ENV_KEYS)) delete process.env[key];
    Object.assign(process.env, ENV_BACKUP);
  });

  test('blue-pill and red-pill retrieve from different engines', () => {
    const blue = modeEngines.enginesFor('blue-pill');
    const red = modeEngines.enginesFor('red-pill');
    expect(blue).toBeTruthy();
    expect(red).toBeTruthy();
    expect(red).not.toEqual(blue);
  });

  test('red-pill excludes Google and Bing entirely', () => {
    // The rabbit hole returning the same ten links as everyone else is the
    // failure case. It queries independent indexes instead.
    const red = modeEngines.enginesFor('red-pill');
    expect(red).not.toMatch(/google/);
    expect(red).not.toMatch(/bing/);
  });

  test('red-pill includes at least one independently-indexed engine', () => {
    // Mojeek, Marginalia and Mwmbl crawl the web themselves rather than
    // reselling Google's index; without at least one of them the mode is just
    // a differently-sorted Google.
    const red = modeEngines.enginesFor('red-pill');
    expect(red).toMatch(/mojeek|marginalia|mwmbl|brave/);
  });

  test('purple keeps the widest pool, because it filters down afterwards', () => {
    // Purple narrows to chosen perspectives, so a narrow retrieval set would
    // leave the perspective filter with nothing to match.
    const purple = modeEngines.enginesFor('purple').split(',');
    const red = modeEngines.enginesFor('red-pill').split(',');
    expect(purple.length).toBeGreaterThanOrEqual(red.length);
  });

  test('an env var overrides the preset and is normalised', () => {
    process.env[modeEngines.ENV_KEYS['red-pill']] = ' Mojeek , BRAVE ,mojeek ';
    // lower-cased, trimmed, de-duplicated, comma-joined
    expect(modeEngines.enginesFor('red-pill')).toBe('mojeek,brave');
  });

  test('an empty env var means "use the instance default"', () => {
    // null tells SearchService to send no engines parameter at all, which is
    // the pre-existing behaviour and the safe escape hatch.
    process.env[modeEngines.ENV_KEYS['red-pill']] = '';
    expect(modeEngines.enginesFor('red-pill')).toBeNull();
  });

  test('an unknown mode falls back to no engines parameter', () => {
    expect(modeEngines.enginesFor('not-a-real-mode')).toBeNull();
  });

  test('a missing mode defaults to blue-pill rather than throwing', () => {
    expect(modeEngines.enginesFor()).toBe(modeEngines.enginesFor('blue-pill'));
  });

  test('no set contains a duplicate or an empty entry', () => {
    for (const mode of Object.keys(modeEngines.DEFAULTS)) {
      const list = modeEngines.enginesFor(mode).split(',');
      expect(list.every(Boolean)).toBe(true);
      expect(new Set(list).size).toBe(list.length);
    }
  });
});
