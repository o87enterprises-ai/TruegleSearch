// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { writePackets, SERVICE_UUID, RX_UUID, webBleAvailable } from './webBle';
import { packetize, buildPayload, MAX_PACKET, MAX_TTL, makeAssembler } from './relay';
import { generateIdentityKeys, publicJwk, seal, unb64u } from './seal';

describe('web Bluetooth uplink', () => {
  it('uses the same service/characteristic UUIDs as the Android plugin', () => {
    expect(SERVICE_UUID).toBe('7a3f0001-5e8c-4b1a-9d3e-7472756c6531');
    expect(RX_UUID).toBe('7a3f0002-5e8c-4b1a-9d3e-7472756c6531');
  });

  it('reports unavailable outside a Web-Bluetooth browser', () => expect(webBleAvailable()).toBe(false));

  it('writes every packet in order, each within the native 180-byte limit, and the phone can reassemble them', async () => {
    const a = await generateIdentityKeys(); const b = await generateIdentityKeys();
    const { envelope } = await seal({ text: 'sent from my laptop', from: 'laptop-a', to: 'phone-b', signPrivate: a.sign.privateKey, toEcdh: await publicJwk(b.ecdh.publicKey) });
    const { rid, payload } = await buildPayload('phone-b', envelope);
    const packets = packetize(unb64u(rid), MAX_TTL, payload);

    const written = [];
    await writePackets({ writeValueWithResponse: async (p) => { written.push(p); } }, packets);

    expect(written).toHaveLength(packets.length);
    for (const p of written) expect(p.length).toBeLessThanOrEqual(MAX_PACKET);
    const asm = makeAssembler(); let out = null;
    for (const p of written) out = asm.feed(p) || out;
    expect(Buffer.from(out.payload)).toEqual(Buffer.from(payload));
  });

  it('falls back to writeValue on browsers without writeValueWithResponse', async () => {
    const seen = [];
    await writePackets({ writeValue: async (p) => { seen.push(p); } }, [Uint8Array.of(1), Uint8Array.of(2)]);
    expect(seen).toHaveLength(2);
  });
});
