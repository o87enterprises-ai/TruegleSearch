// MOVE YOUR LISTS TO ANOTHER DEVICE — no server involved.
//
// Everything a person has saved lives in this browser. To carry it to a new phone or
// laptop we pack their saved playlists (and the unlocked survival guide) into one short
// text code — JSON, deflated, base64url — that can be pasted, or shared as a link whose
// code sits after the # so it is never sent to any server, including ours.
//
//   code:  TG1.<base64url>
//   link:  https://truegle.info/#profile=TG1.<base64url>
//
// SHORT LINK (preferred for sharing): the code is encrypted in the browser (AES-GCM, a
// random key) and only the ciphertext is stored for 24 h; the key rides in the link's
// #fragment, which is never sent to any server. If the server is unreachable the long
// link above still works.
//   short: https://truegle.info/#move=<id>.<key>

import { playlists, upsertImportedPlaylist } from './playlists';
import { vaultTier, findVault } from './vault';
import api from '../services/api';

const PREFIX = 'TG1.';
export const PROFILE_HASH = '#profile=';
export const MOVE_HASH = '#move=';

const toB64 = (bytes) => {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (str) => {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** What would travel: the saved lists and the guide unlock. */
export function snapshot(onlyId) {
  return {
    v: 1,
    lists: playlists().filter((p) => !onlyId || p.id === onlyId).map((p) => ({
      id: p.id,
      n: p.name,
      // Files added from this device (tglocal:) live only here, so they do not travel.
      i: p.items.filter((s) => !s.src.startsWith('tglocal:')).map((s) => [s.src, s.kind || '', s.title || '', s.pageUrl || '', s.poster || '', s.channel || '', s.vertical ? 1 : 0]),
    })),
    guide: onlyId ? null : (vaultTier() || null),
  };
}

/** @returns {Promise<string>} the TG1. code for this device's lists. */
export async function exportProfile(onlyId) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot(onlyId)));
  return PREFIX + toB64(await pipe(bytes, new CompressionStream('deflate-raw')));
}

export const profileLink = (code) => `${window.location.origin}/${PROFILE_HASH}${code}`;

/** Parses a code (or a whole link) without applying it. Throws on anything unreadable. */
export async function readProfile(input) {
  let code = String(input || '').trim();
  const at = code.indexOf(PROFILE_HASH);
  if (at >= 0) code = code.slice(at + PROFILE_HASH.length);
  if (!code.startsWith(PREFIX)) throw new Error('not a Truegle code');
  const bytes = await pipe(fromB64(code.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || data.v !== 1 || !Array.isArray(data.lists)) throw new Error('unsupported code');
  return data;
}

/** Adds the lists (re-importing the same code refreshes them rather than duplicating). */
export function applyProfile(data) {
  let count = 0;
  data.lists.forEach((l) => {
    const items = (l.i || []).map(([src, kind, title, pageUrl, poster, channel, vertical]) => ({
      src, kind: kind || undefined, title, pageUrl, poster, channel, ...(vertical ? { vertical: true } : {}),
    }));
    if (upsertImportedPlaylist(`profile:${l.id}`, l.n, items)) count += 1;
  });
  if (data.guide) findVault(data.guide);
  return count;
}

const b64ToBytes = (str) => fromB64(str);

/** Encrypts the code, stores the ciphertext, returns a short link. Throws if the server can't. */
export async function shortProfileLink(code) {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(code)));
  const blob = new Uint8Array(iv.length + ct.length);
  blob.set(iv); blob.set(ct, iv.length);
  const { data } = await api.post('/move', { blob: toB64(blob) });
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  return `${window.location.origin}/${MOVE_HASH}${data.id}.${toB64(raw)}`;
}

/** The best link we can make: short if the server answers, otherwise the long self-contained one. */
export async function bestProfileLink(onlyId) {
  const code = await exportProfile(onlyId);
  try { return await shortProfileLink(code); } catch { return profileLink(code); }
}

/** Opens a #move= link: fetches + decrypts, then parses like any code. Returns { data, id }. */
export async function readMoveLink(input) {
  const at = String(input || '').indexOf(MOVE_HASH);
  const [id, k] = String(input).slice(at + MOVE_HASH.length).trim().split('.');
  if (at < 0 || !id || !k) throw new Error('not a move link');
  const { data } = await api.get(`/move/${encodeURIComponent(id)}`);
  const bytes = b64ToBytes(data.blob);
  const key = await crypto.subtle.importKey('raw', b64ToBytes(k), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return { data: await readProfile(new TextDecoder().decode(plain)), id };
}

/** Best effort: the receiving device is done, so the stored ciphertext can go. */
export const forgetMoveLink = (id) => api.delete(`/move/${encodeURIComponent(id)}`).catch(() => {});

// ── FINDING A SHARE LINK ANYWHERE ───────────────────────────────────────────
// A share link can arrive as the https link, a truegle:// app link, or a bare code,
// pasted into any box or opened from another app. This pulls the "#move=…" / "#profile=…"
// fragment out of whatever text it was wrapped in, or returns null.
const FRAG = /#(?:move=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|profile=TG1\.[A-Za-z0-9_-]+)/;
export function extractShare(text) {
  const t = String(text || '');
  const m = FRAG.exec(t);
  if (m) return m[0];
  const bare = /\bTG1\.[A-Za-z0-9_-]{8,}/.exec(t);
  return bare ? `${PROFILE_HASH}${bare[0]}` : null;
}

/** truegle://… form of a share fragment — opens the Android app directly. */
export const appLink = (fragment) => `truegle://import${fragment}`;

/** Android "open in app" link for a browser that doesn't hand https links to the app. */
export const intentLink = (fragment) =>
  `intent://truegle.info/${fragment}#Intent;scheme=https;package=info.truegle.app;S.browser_fallback_url=${encodeURIComponent(`https://truegle.info/${fragment}`)};end`;

/** Hands a share link/code to the import dialog (mounted once, see ProfileImport). */
export const openShare = (text) => window.dispatchEvent(new CustomEvent('truegle:share-link', { detail: String(text || '') }));

export const isNativeApp = () => { try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; } };
/** Share ONE list: the phone's share sheet if there is one, otherwise copy the link. */
export async function shareList(id, name) {
  const url = await bestProfileLink(id);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: name, text: `My Truegle list “${name}” — open this link:`, url });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
