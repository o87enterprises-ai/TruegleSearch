import { describe, it, expect, beforeEach } from 'vitest';
import { trace, getTrace, clearTrace, traceForBeacon, traceText, deviceBucket, browserBucket } from './playerTrace';

beforeEach(() => clearTrace());

describe('playerTrace', () => {
  it('keeps only numbers, booleans and short tokens (never text)', () => {
    trace('src', { kind: 'youtube', n: 3, ok: true, title: 'Some Song Title With Spaces', url: 'https://x.test/?a=b', obj: { a: 1 } });
    const [ev] = getTrace();
    expect(ev.d).toEqual({ kind: 'youtube', n: 3, ok: true });
  });

  it('ring buffer holds the last 80 events', () => {
    for (let i = 0; i < 120; i++) trace('tap', { i });
    const all = getTrace();
    expect(all).toHaveLength(80);
    expect(all[0].d.i).toBe(40);
    expect(all[79].d.i).toBe(119);
  });

  it('beacon form is capped at 2 KB and keeps the newest events', () => {
    for (let i = 0; i < 80; i++) trace('embed', { a: i, b: i, c: i, d: i, e: i, f: i, g: i, h: i });
    const wire = traceForBeacon(30);
    expect(JSON.stringify(wire).length).toBeLessThanOrEqual(2048);
    expect(wire[wire.length - 1].d.a).toBe(79);
  });

  it('traceText keeps the newest lines within budget', () => {
    for (let i = 0; i < 30; i++) trace('sound', { v: i });
    const text = traceText(30, 120);
    expect(text.length).toBeLessThanOrEqual(120);
    expect(text.split('\n').pop()).toContain('v=29');
  });

  it('never throws on garbage input', () => {
    expect(() => trace('x', null)).not.toThrow();
    expect(() => trace('x', 'str')).not.toThrow();
  });

  it('buckets are coarse labels', () => {
    expect(['touch', 'desktop']).toContain(deviceBucket());
    expect(['chrome', 'firefox', 'safari', 'samsung', 'other']).toContain(browserBucket());
  });
});
