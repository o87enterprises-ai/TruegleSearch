// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { generateIdentityKeys, publicJwk, seal, open, authHeader, generateHandle, cleanHandle, HANDLE_RE, b64u, unb64u } from './seal';

async function person(handle) {
  const k = await generateIdentityKeys();
  return { handle, k, ecdh: await publicJwk(k.ecdh.publicKey), sign: await publicJwk(k.sign.publicKey) };
}

describe('seal / open', () => {
  it('round-trips a message and proves the sender', async () => {
    const alice = await person('alice-a'); const bob = await person('bob-b');
    const { envelope } = await seal({ text: 'hello bob', from: 'alice-a', to: 'bob-b', signPrivate: alice.k.sign.privateKey, toEcdh: bob.ecdh });
    const got = await open(envelope, { ecdhPrivate: bob.k.ecdh.privateKey, me: 'bob-b', lookupSign: async (h) => (h === 'alice-a' ? alice.sign : null) });
    expect(got.text).toBe('hello bob');
    expect(got.from).toBe('alice-a');
  });

  it('the envelope does not contain the plaintext or the handles', async () => {
    const a = await person('alice-a'); const b = await person('bob-b');
    const { envelope } = await seal({ text: 'top secret words', from: 'alice-a', to: 'bob-b', signPrivate: a.k.sign.privateKey, toEcdh: b.ecdh });
    const raw = Buffer.from(unb64u(envelope)).toString('latin1');
    expect(raw).not.toContain('top secret');
    expect(raw).not.toContain('alice-a');
  });

  it('a relay or third party cannot open it', async () => {
    const a = await person('alice-a'); const b = await person('bob-b'); const eve = await person('eve-e');
    const { envelope } = await seal({ text: 'x', from: 'alice-a', to: 'bob-b', signPrivate: a.k.sign.privateKey, toEcdh: b.ecdh });
    await expect(open(envelope, { ecdhPrivate: eve.k.ecdh.privateKey, me: 'eve-e', lookupSign: async () => a.sign })).rejects.toThrow();
  });

  it('refuses a message addressed to someone else (re-targeting)', async () => {
    const a = await person('alice-a'); const b = await person('bob-b');
    const { envelope } = await seal({ text: 'x', from: 'alice-a', to: 'carol-c', signPrivate: a.k.sign.privateKey, toEcdh: b.ecdh });
    await expect(open(envelope, { ecdhPrivate: b.k.ecdh.privateKey, me: 'bob-b', lookupSign: async () => a.sign })).rejects.toThrow('not for me');
  });

  it('refuses a forged sender', async () => {
    const a = await person('alice-a'); const b = await person('bob-b'); const mallory = await person('mal-m');
    // mallory signs as "alice-a" with her own key
    const { envelope } = await seal({ text: 'send money', from: 'alice-a', to: 'bob-b', signPrivate: mallory.k.sign.privateKey, toEcdh: b.ecdh });
    await expect(open(envelope, { ecdhPrivate: b.k.ecdh.privateKey, me: 'bob-b', lookupSign: async () => a.sign })).rejects.toThrow('bad signature');
  });

  it('detects tampering', async () => {
    const a = await person('alice-a'); const b = await person('bob-b');
    const { envelope } = await seal({ text: 'x', from: 'alice-a', to: 'bob-b', signPrivate: a.k.sign.privateKey, toEcdh: b.ecdh });
    const raw = unb64u(envelope); raw[raw.length - 5] ^= 1;
    await expect(open(b64u(raw), { ecdhPrivate: b.k.ecdh.privateKey, me: 'bob-b', lookupSign: async () => a.sign })).rejects.toThrow();
  });

  it('is small enough to relay (a short message stays well under 400 base64 chars)', async () => {
    const a = await person('calm-otter-4821'); const b = await person('brave-fox-1234');
    const { envelope } = await seal({ text: 'meet at the north gate', from: 'calm-otter-4821', to: 'brave-fox-1234', signPrivate: a.k.sign.privateKey, toEcdh: b.ecdh });
    expect(envelope.length).toBeLessThan(500);
  });
});

describe('authHeader', () => {
  it('has the shape the server parses', async () => {
    const k = await generateIdentityKeys();
    const h = await authHeader({ handle: 'calm-otter-4821', signPrivate: k.sign.privateKey, method: 'delete', path: '/api/handles/calm-otter-4821', now: 1700000000000 });
    expect(h).toMatch(/^TG-Sig handle=calm-otter-4821,ts=1700000000000,sig=[A-Za-z0-9_-]{80,120}$/);
  });
});

describe('handles', () => {
  it('generated handles satisfy the server rule', () => {
    for (let i = 0; i < 200; i += 1) expect(generateHandle()).toMatch(HANDLE_RE);
  });
  it('cleanHandle normalises typed names', () => {
    expect(cleanHandle('  Cool Name_1! ')).toBe('cool-name-1');
    expect(cleanHandle('--a--b--')).toBe('a-b');
  });
});
