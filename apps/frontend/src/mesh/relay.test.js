// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { packetize, makeAssembler, route, handleHash, isRelayPacket, pruneCarry, CARRY_TTL_MS, DATA_PER_PACKET, HEADER, MAX_PACKET, MAX_TTL } from './relay';
import { generateIdentityKeys, publicJwk, seal, open, b64u, unb64u } from './seal';

const rnd = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

describe('packetize / assembler', () => {
  it('every packet fits one BLE write', () => {
    const packets = packetize(rnd(6), 6, rnd(700));
    for (const p of packets) { expect(p.length).toBeLessThanOrEqual(MAX_PACKET); expect(isRelayPacket(p)).toBe(true); }
    expect(packets.length).toBe(Math.ceil(700 / DATA_PER_PACKET));
  });

  it('reassembles in any order and returns the exact payload', () => {
    const payload = rnd(500);
    const id = rnd(6);
    const packets = packetize(id, 4, payload).reverse();
    const asm = makeAssembler();
    let out = null;
    for (const p of packets) out = asm.feed(p) || out;
    expect(out.ttl).toBe(4);
    expect(Buffer.from(out.payload)).toEqual(Buffer.from(payload));
    expect(asm.size()).toBe(0);
  });

  it('a duplicate packet does not complete a message early', () => {
    const packets = packetize(rnd(6), 4, rnd(400));
    const asm = makeAssembler();
    expect(asm.feed(packets[0])).toBeNull();
    expect(asm.feed(packets[0])).toBeNull();
  });

  it('drops incomplete messages after a minute', () => {
    let t = 0;
    const asm = makeAssembler(() => t);
    const a = packetize(rnd(6), 4, rnd(400));
    asm.feed(a[0]);
    t = 61000;
    asm.feed(packetize(rnd(6), 4, rnd(10))[0]); // a later packet sweeps the stale entry
    expect(asm.size()).toBe(0);
  });

  it('ignores voice frames and junk', () => {
    const asm = makeAssembler();
    expect(asm.feed(Uint8Array.from([0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(asm.feed(new Uint8Array(3))).toBeNull();
  });
});

describe('route', () => {
  const myHash = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
  it('delivers what is addressed to me', () => expect(route({ ttl: 3, destHash: myHash, myHash, seen: new Set(), id: 'a' })).toBe('deliver'));
  it('forwards others while hops remain, drops at the last hop', () => {
    const other = Uint8Array.from([9, 9, 9, 9, 9, 9, 9, 9]);
    expect(route({ ttl: 2, destHash: other, myHash, seen: new Set(), id: 'a' })).toBe('forward');
    expect(route({ ttl: 1, destHash: other, myHash, seen: new Set(), id: 'a' })).toBe('drop');
  });
  it('never handles the same message twice (loop prevention)', () => {
    expect(route({ ttl: 5, destHash: myHash, myHash, seen: new Set(['a']), id: 'a' })).toBe('drop');
  });
});

describe('handleHash', () => {
  it('is stable, 8 bytes, and differs per handle', async () => {
    const a = await handleHash('calm-otter-4821');
    expect(a.length).toBe(8);
    expect(Buffer.from(await handleHash('calm-otter-4821'))).toEqual(Buffer.from(a));
    expect(Buffer.from(await handleHash('brave-fox-1234'))).not.toEqual(Buffer.from(a));
  });
});

describe('pruneCarry', () => {
  it('forgets messages after 24 hours and caps the pile', () => {
    const now = 10 * CARRY_TTL_MS;
    const list = [{ id: 'old', at: now - CARRY_TTL_MS - 1 }, ...Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, at: now - 10 }))];
    const kept = pruneCarry(list, now);
    expect(kept.find((m) => m.id === 'old')).toBeUndefined();
    expect(kept).toHaveLength(50);
  });
});

// A -- B -- C in a line: A cannot reach C directly. B carries a sealed message it cannot read.
describe('three phones in a line (A → B → C)', () => {
  it('delivers to C through B; B cannot read it; the hop limit and loop guard hold', async () => {
    const mk = async (handle) => { const k = await generateIdentityKeys(); return { handle, k, ecdh: await publicJwk(k.ecdh.publicKey), sign: await publicJwk(k.sign.publicKey), hash: await handleHash(handle), seen: new Set(), asm: makeAssembler() }; };
    const A = await mk('alice-a'); const B = await mk('bob-b'); const C = await mk('carol-c');

    // A seals for C and floods to B (the only phone in range)
    const { envelope } = await seal({ text: 'meet at the north gate', from: 'alice-a', to: 'carol-c', signPrivate: A.k.sign.privateKey, toEcdh: C.ecdh });
    const env = unb64u(envelope);
    const payload = new Uint8Array(8 + env.length); payload.set(C.hash, 0); payload.set(env, 8);
    const id = b64u(rnd(6));
    A.seen.add(id);
    const toB = packetize(unb64u(id), MAX_TTL, payload);

    // B receives, reassembles, routes: not for B → forward with ttl-1
    let atB = null; for (const p of toB) atB = B.asm.feed(p) || atB;
    const verdictB = route({ ttl: atB.ttl, destHash: atB.payload.slice(0, 8), myHash: B.hash, seen: B.seen, id: atB.id });
    expect(verdictB).toBe('forward');
    B.seen.add(atB.id);
    // B cannot open it (it is addressed to C's key)
    await expect(open(b64u(atB.payload.slice(8)), { ecdhPrivate: B.k.ecdh.privateKey, me: 'bob-b', lookupSign: async () => A.sign })).rejects.toThrow();

    // B forwards to C (ttl-1); C also gets an echo back from A's side that must be ignored
    const toC = packetize(unb64u(id), atB.ttl - 1, atB.payload);
    let atC = null; for (const p of toC) atC = C.asm.feed(p) || atC;
    expect(atC.ttl).toBe(MAX_TTL - 1);
    expect(route({ ttl: atC.ttl, destHash: atC.payload.slice(0, 8), myHash: C.hash, seen: C.seen, id: atC.id })).toBe('deliver');
    const got = await open(b64u(atC.payload.slice(8)), { ecdhPrivate: C.k.ecdh.privateKey, me: 'carol-c', lookupSign: async (h) => (h === 'alice-a' ? A.sign : null) });
    expect(got).toMatchObject({ from: 'alice-a', text: 'meet at the north gate' });

    // an echo of the same message back at A or B is dropped
    expect(route({ ttl: 4, destHash: C.hash, myHash: A.hash, seen: A.seen, id })).toBe('drop');
    expect(route({ ttl: 4, destHash: C.hash, myHash: B.hash, seen: B.seen, id })).toBe('drop');
  });

  it('keeps header overhead small enough that a short chat message is 2-3 packets', async () => {
    expect(HEADER).toBe(10);
    const k = await generateIdentityKeys();
    const peer = await publicJwk((await generateIdentityKeys()).ecdh.publicKey);
    const { envelope } = await seal({ text: 'hello there friend', from: 'calm-otter-4821', to: 'brave-fox-1234', signPrivate: k.sign.privateKey, toEcdh: peer });
    const packets = packetize(rnd(6), 6, new Uint8Array(8 + unb64u(envelope).length));
    expect(packets.length).toBeLessThanOrEqual(3);
  });
});
