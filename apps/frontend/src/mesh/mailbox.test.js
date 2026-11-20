import { describe, it, expect } from 'vitest';
import { parseSse, pruneOutbox, OUTBOX_TTL_MS } from './mailbox';

describe('parseSse', () => {
  it('parses complete events and keeps the partial rest', () => {
    const p = parseSse('event: ready\ndata: {}\n\nevent: msg\ndata: {"id":"a"}\n\nevent: ms');
    expect(p.events).toEqual([{ event: 'ready', data: '{}' }, { event: 'msg', data: '{"id":"a"}' }]);
    expect(p.rest).toBe('event: ms');
  });
  it('ignores heartbeat comments', () => {
    expect(parseSse(': hb\n\n').events).toEqual([]);
  });
  it('resumes across chunk boundaries', () => {
    const a = parseSse('event: msg\nda');
    expect(a.events).toEqual([]);
    const b = parseSse(`${a.rest}ta: {"id":"b"}\n\n`);
    expect(b.events).toEqual([{ event: 'msg', data: '{"id":"b"}' }]);
  });
});

describe('pruneOutbox', () => {
  it('drops queued messages older than 7 days', () => {
    const now = 10 * OUTBOX_TTL_MS;
    const items = [{ id: 'old', at: now - OUTBOX_TTL_MS - 1 }, { id: 'new', at: now - 1000 }];
    expect(pruneOutbox(items, now).map((m) => m.id)).toEqual(['new']);
  });
});
