import { describe, it, expect } from 'vitest';
import { computeBudget, fits, isDirectMedia, partitionList, formatBytes, MIN_HEADROOM_BYTES } from './offlineBudget';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe('computeBudget', () => {
  it('holds back 10% of a large quota', () => {
    const b = computeBudget({ quota: 10 * GB, usage: 1 * GB });
    expect(b.free).toBe(9 * GB);
    expect(b.usable).toBe(9 * GB - 1 * GB); // 10% of 10 GB reserved
    expect(b.known).toBe(true);
  });
  it('never reserves less than the minimum on a small quota', () => {
    const b = computeBudget({ quota: 200 * MB, usage: 0 });
    expect(b.usable).toBe(200 * MB - MIN_HEADROOM_BYTES);
  });
  it('is zero, not negative, when nearly full', () => {
    expect(computeBudget({ quota: 100 * MB, usage: 99 * MB }).usable).toBe(0);
  });
  it('treats a missing estimate as unknown and unlimited (the browser quota error is the backstop)', () => {
    const b = computeBudget(undefined);
    expect(b.known).toBe(false);
    expect(b.usable).toBe(Infinity);
  });
});

describe('fits', () => {
  it('compares against the usable bytes', () => {
    expect(fits(5 * MB, 10 * MB)).toBe(true);
    expect(fits(11 * MB, 10 * MB)).toBe(false);
  });
  it('lets an unknown size through to be re-checked after download', () => {
    expect(fits(NaN, 1)).toBe(true);
    expect(fits(0, 1)).toBe(true);
  });
  it('always fits when the budget is unknown', () => expect(fits(99 * GB, Infinity)).toBe(true));
});

describe('isDirectMedia', () => {
  it('accepts http(s) audio/video', () => {
    expect(isDirectMedia({ kind: 'audio', src: 'https://archive.org/a.mp3' })).toBe(true);
    expect(isDirectMedia({ kind: 'video', src: 'http://x.test/v.mp4' })).toBe(true);
  });
  it('rejects embeds, local and blob sources', () => {
    expect(isDirectMedia({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/abc' })).toBe(false);
    expect(isDirectMedia({ kind: 'audio', src: 'tglocal:abc' })).toBe(false);
    expect(isDirectMedia({ kind: 'audio', src: 'blob:https://x/1' })).toBe(false);
    expect(isDirectMedia(null)).toBe(false);
  });
});

describe('partitionList', () => {
  it('separates saveable, already-saved and online-only items', () => {
    const items = [
      { kind: 'audio', src: 'https://a.test/1.mp3' },
      { kind: 'audio', src: 'https://a.test/2.mp3' },
      { kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/x' },
      { kind: 'audio', src: 'tglocal:q' },
    ];
    const r = partitionList(items, new Set(['https://a.test/2.mp3']));
    expect(r.todo.map((i) => i.src)).toEqual(['https://a.test/1.mp3']);
    expect(r.already).toHaveLength(2);
    expect(r.online).toHaveLength(1);
  });
});

describe('formatBytes', () => {
  it('scales units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(5 * MB)).toBe('5 MB');
    expect(formatBytes(1.5 * GB)).toBe('1.5 GB');
    expect(formatBytes(Infinity)).toBe('—');
  });
});
