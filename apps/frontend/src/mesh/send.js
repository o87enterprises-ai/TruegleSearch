// One entry point for "send this message to that name", choosing every route that can work:
//   • the internet mailbox (queued on this device if we are offline, sent when we are back),
//   • the Bluetooth relay, when this is the Android app with relaying on, and
//   • a nearby Truegle phone reached over Web Bluetooth, when this is a laptop/tablet browser that
//     has been connected to one.
// The message is sealed ONCE and every route carries the same envelope; the recipient keeps
// whichever copy arrives first and ignores the others (they share one message id).

import { sealFor } from './identity';
import { sendText } from './mailbox';
import { sendViaRelay, relayEnabled } from './relay';
import { meshAvailable } from './native';
import { phoneLink, sendViaPhone } from './webBle';

export async function sendMessage(to, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const sealed = await sealFor(to, t); // throws "No one with that name." for an unknown handle
  const id = await sendText(to, t, sealed);
  if (meshAvailable() && relayEnabled()) sendViaRelay(to, t, sealed).catch(() => {}); // best effort
  if (phoneLink()) sendViaPhone(to, sealed.envelope).catch(() => {});
  return id;
}
