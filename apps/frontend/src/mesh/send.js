// One entry point for "send this message to that name", choosing every route that can work:
//   • the internet mailbox (queued on this device if we are offline, sent when we are back), and
//   • the Bluetooth relay, when this is the Android app with relaying on.
// The message is sealed ONCE and both routes carry the same envelope; the recipient keeps whichever
// copy arrives first and ignores the other (they share one message id).

import { sealFor } from './identity';
import { sendText } from './mailbox';
import { sendViaRelay, relayEnabled } from './relay';
import { meshAvailable } from './native';

export async function sendMessage(to, text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const sealed = await sealFor(to, t); // throws "No one with that name." for an unknown handle
  const id = await sendText(to, t, sealed);
  if (meshAvailable() && relayEnabled()) sendViaRelay(to, t, sealed).catch(() => {}); // best effort
  return id;
}
