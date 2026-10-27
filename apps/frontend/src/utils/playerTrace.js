// THE PLAYER'S FLIGHT RECORDER.
//
// Real playback cannot be reproduced where this code is written (YouTube
// refuses embeds there, and there is no second device), so when a phone
// reports "it went quiet" the only honest question is "what did the player
// do in the minute before?" This answers it: the last 80 things the player
// decided, kept in memory and mirrored to sessionStorage so a reload doesn't
// erase the evidence.
//
// PRIVACY (same rule as migrations/025_player_health.sql): events carry codes
// and small numbers only — never a video id, title, URL, query or anything
// that identifies a person. trace() drops any value that isn't a number, a
// boolean or a short [a-z0-9_.:-] token, so a careless call site cannot leak
// text into a trace.
//
// Event codes: mode, src, embed, sound, next, tap, upstream, boot.

const MAX = 80;
const KEY = 'truegle_ptrace_v1';
const DEBUG_KEY = 'truegle_pdebug_v1';
const T0 = typeof performance !== 'undefined' ? performance.now() : 0;

let buf = [];
let loaded = false;
const listeners = new Set();
let saveQueued = false;

const TOKEN = /^[a-z0-9_.:-]{1,24}$/i;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null;
    const prev = raw ? JSON.parse(raw) : null;
    if (Array.isArray(prev)) buf = prev.slice(-MAX);
  } catch { /* storage blocked or corrupt — start empty */ }
}

function save() {
  if (saveQueued) return;
  saveQueued = true;
  Promise.resolve().then(() => {
    saveQueued = false;
    try { sessionStorage.setItem(KEY, JSON.stringify(buf)); } catch { /* private mode / quota */ }
  });
}

function scrub(d) {
  if (!d || typeof d !== 'object') return undefined;
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && TOKEN.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Record one event. Never throws, never blocks. */
export function trace(e, d) {
  try {
    load();
    const ev = { t: Math.round(((typeof performance !== 'undefined' ? performance.now() : 0) - T0) / 10) / 100, e };
    const data = scrub(d);
    if (data) ev.d = data;
    buf.push(ev);
    if (buf.length > MAX) buf = buf.slice(-MAX);
    save();
    listeners.forEach((fn) => { try { fn(); } catch { /* a listener must not break playback */ } });
  } catch { /* the recorder must never cost anyone a working player */ }
}

export function getTrace(n = MAX) {
  load();
  return buf.slice(-n);
}

export function subscribeTrace(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearTrace() {
  buf = [];
  save();
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}

// One line per event: "12.4 sound IS_IOS=true muted=false". Compact enough
// to paste into a message or a mailto body.
export function eventLine(ev) {
  const d = ev.d ? Object.entries(ev.d).map(([k, v]) => `${k}=${v}`).join(' ') : '';
  return `${ev.t} ${ev.e}${d ? ` ${d}` : ''}`;
}

export function traceText(n = 30, maxChars = 1200) {
  const lines = getTrace(n).map(eventLine);
  let text = lines.join('\n');
  // Keep the NEWEST events when over budget: what just happened matters most.
  while (text.length > maxChars && lines.length > 1) { lines.shift(); text = lines.join('\n'); }
  return text;
}

// The wire form for the beacon: the last `n` events, hard-capped at 2 KB.
export function traceForBeacon(n = 30, maxBytes = 2048) {
  let evs = getTrace(n);
  while (evs.length > 1 && JSON.stringify(evs).length > maxBytes) evs = evs.slice(1);
  return evs;
}

// Coarse buckets only — never the raw User-Agent (it can help re-identify a
// visitor, which is exactly what the health log is built not to do).
export function deviceBucket() {
  if (typeof navigator === 'undefined') return 'desktop';
  return (navigator.maxTouchPoints || 0) > 0 && /Mobi|Android|iP(hone|ad|od)/.test(navigator.userAgent || '') ? 'touch' : 'desktop';
}

export function browserBucket() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/Edg\//i.test(ua) || /OPR\//i.test(ua) || /Chrome|CriOS|Chromium/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua)) return 'safari';
  return 'other';
}

// ?pdebug=1 turns the overlay on and remembers it for the session; ?pdebug=0 turns it off.
export function pdebugOn() {
  try {
    const q = new URLSearchParams(location.search).get('pdebug');
    if (q === '1') sessionStorage.setItem(DEBUG_KEY, '1');
    if (q === '0') sessionStorage.removeItem(DEBUG_KEY);
    return sessionStorage.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

// Which transport control was tapped, by its own data- attribute name — never
// its text — so an "extra expand button" report can be matched to a real
// control. Installed once; returns an uninstaller.
let tapInstalled = false;
export function installTapRecorder() {
  if (tapInstalled || typeof document === 'undefined') return () => {};
  tapInstalled = true;
  const onClick = (ev) => {
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-player-root] button, [data-player-root] [role="button"], [data-player-root] a') : null;
    if (!el) return;
    const attr = [...el.attributes].map((a) => a.name).find((n) => /^data-(player|embed|up-next|queue)/.test(n));
    trace('tap', { c: attr ? attr.replace(/^data-/, '') : 'other' });
  };
  document.addEventListener('click', onClick, true);
  return () => { document.removeEventListener('click', onClick, true); tapInstalled = false; };
}
