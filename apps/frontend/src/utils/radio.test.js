import { describe, it, expect } from 'vitest';
import { artistOf, nameKey } from './radio';

// Radio only follows an artist it can actually name; anything else falls back
// to the ordinary up-next, so a wrong guess is worse than no guess.
describe('artistOf', () => {
  const cases = [
    [{ title: 'Paranoid Android', channel: 'Radiohead - Topic' }, 'Radiohead'],
    [{ title: 'Radiohead - Creep (Official Music Video)', channel: 'Radiohead' }, 'Radiohead'],
    [{ title: 'Kendrick Lamar – Not Like Us', channel: 'KendrickLamarVEVO' }, 'Kendrick Lamar'],
    [{ title: 'Bad Bunny ft. Drake - MIA', channel: 'Bad Bunny' }, 'Bad Bunny'],
    [{ title: 'Daft Punk x Pharrell — Get Lucky', channel: '' }, 'Daft Punk'],
    [{ title: 'Shake It Off', channel: 'TaylorSwiftVEVO' }, 'TaylorSwift'],
  ];
  it.each(cases)('%j → %s', (src, want) => expect(artistOf(src)).toBe(want));

  it('returns null for things that are not songs', () => {
    expect(artistOf({ title: 'How do tides work?', channel: 'SciShow' })).toBeNull();
    expect(artistOf({ title: 'Official Trailer - Dune Part Two', channel: 'Warner Bros.' })).toBeNull();
    expect(artistOf({ title: 'Lofi Mix - beats to study to', channel: 'Lofi Girl' })).toBeNull();
    expect(artistOf(null)).toBeNull();
  });
});

describe('nameKey', () => {
  it('ignores case, accents and punctuation', () => {
    expect(nameKey('ROSALÍA')).toBe(nameKey('rosalia'));
    expect(nameKey('AC/DC')).toBe('acdc');
  });
});
