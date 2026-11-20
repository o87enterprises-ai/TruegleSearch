// LAPTOPS AND TABLETS (no app): hand a sealed message to a nearby Truegle phone over Web Bluetooth.
//
// A browser can talk to a Bluetooth device but cannot BE one, so a laptop can't carry or receive
// relayed messages. What it CAN do is connect to a phone running the Truegle app (which already
// advertises the Truegle Nearby service) and write the message packets to it; the phone then
// relays them onward. Needs Chrome or Edge on a secure (https) page, and the user must pick the
// phone from the browser's own Bluetooth chooser — browsers never allow silent Bluetooth access.
// Safari and Firefox do not support Web Bluetooth.

import { packetize, buildPayload, MAX_TTL } from './relay';
import { unb64u } from './seal';

export const SERVICE_UUID = '7a3f0001-5e8c-4b1a-9d3e-7472756c6531';
export const RX_UUID = '7a3f0002-5e8c-4b1a-9d3e-7472756c6531';

export const webBleAvailable = () => typeof navigator !== 'undefined' && !!navigator.bluetooth && typeof window !== 'undefined' && window.isSecureContext === true;

let link = null; // { name, ch }
const listeners = new Set();
const emit = () => listeners.forEach((f) => { try { f(); } catch { /* ignore */ } });
export const onWebBleChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const phoneLink = () => (link ? { name: link.name } : null);

/** Opens the browser's Bluetooth chooser, connects to the chosen phone. Returns its name. */
export async function connectPhone() {
  if (!webBleAvailable()) throw new Error('This browser cannot use Bluetooth. Try Chrome or Edge.');
  const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
  const server = await dev.gatt.connect();
  const svc = await server.getPrimaryService(SERVICE_UUID);
  const ch = await svc.getCharacteristic(RX_UUID);
  link = { name: dev.name || 'Truegle phone', ch, dev };
  dev.addEventListener?.('gattserverdisconnected', () => { link = null; emit(); });
  emit();
  return link.name;
}

export function disconnectPhone() {
  try { link?.dev?.gatt?.disconnect(); } catch { /* ignore */ }
  link = null; emit();
}

/** Writes packets to the characteristic in order, waiting for each to be acknowledged. */
export async function writePackets(ch, packets) {
  for (const p of packets) {
    if (ch.writeValueWithResponse) await ch.writeValueWithResponse(p); else await ch.writeValue(p);
  }
}

/** Hands a sealed envelope to the connected phone for relaying. Throws if no phone is connected. */
export async function sendViaPhone(toHandle, envelope) {
  if (!link) throw new Error('No phone connected.');
  const { rid, payload } = await buildPayload(toHandle, envelope);
  await writePackets(link.ch, packetize(unb64u(rid), MAX_TTL, payload));
}
