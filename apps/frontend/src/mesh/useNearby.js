import { useCallback, useEffect, useRef, useState } from 'react';
import { meshAvailable, meshStatus, meshStart, meshStop, meshSendText, meshSendChunks, meshOn, b64ToBytes } from './native';
import { frameVoice, isVoiceFrame, makeAssembler, newVoiceId, bytesToB64, KEEP_VOICE } from './voice';
import {
  CHAT_MAX, OUTBOX_TTL_MS, GROUP_MAX, cleanName, getName, saveName, getContacts, saveContacts,
  getThreads, saveThreads, getChats, saveChats, getOutbox, saveOutbox, newId, dmId, membersKey,
} from './store';

const IN_RANGE_MS = 20000;   // a phone counts as "nearby" if we heard it in the last 20 s
const SEND_TIMEOUT_MS = 15000;
const VOICE_TIMEOUT_MS = 60000;
const TYPING_TTL_MS = 5000;
const TYPING_EVERY_MS = 3000;
const FP_RE = /^[0-9a-f]{16}$/;

const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('Timed out')), ms))]);

// The Nearby engine: Bluetooth on/off, who is around, conversations, the offline outbox and
// typing indicators. UI-free so the page can lay it out however it likes.
// Wire format (JSON, <= 180 bytes per write):
//   hi  {t,f,n}              "I'm here, this is my name"
//   m   {t,f,n,i,x,g?}       a message (g = group id, absent for 1:1)
//   g   {t,f,n,g,m:[fp..]}   who is in a group conversation
//   ty  {t,f,g?}             "is typing"
export default function useNearby() {
  const available = meshAvailable();
  const [st, setSt] = useState(null);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const [name, setNameState] = useState(getName);
  const [live, setLive] = useState({});            // fp -> { rssi, t }
  const [contacts, setContacts] = useState(getContacts);
  const [threads, setThreads] = useState(getThreads);
  const [chats, setChats] = useState(getChats);
  const [outbox, setOutbox] = useState(getOutbox);
  const [selected, setSelected] = useState([]);    // fps you're writing to
  const [typing, setTyping] = useState({});        // fp -> { tid, until }
  const [now, setNow] = useState(Date.now());
  const [sendErr, setSendErr] = useState({});      // fp -> last send error (shown while a message waits)

  const R = useRef({});
  R.current = { st, on, name, live, contacts, threads, chats, outbox, selected };
  const helloed = useRef(new Set());
  const flushing = useRef(new Set());
  const chain = useRef(Promise.resolve());
  const pendingTx = useRef(0);
  const lastTyping = useRef(0);

  const mk = (key, set, save) => (fn) => set((p) => { const n = fn(p); save(n); R.current[key] = n; return n; });
  const upContacts = mk('contacts', setContacts, saveContacts);
  const upThreads = mk('threads', setThreads, saveThreads);
  const upChats = mk('chats', setChats, saveChats);
  const upOutbox = mk('outbox', setOutbox, saveOutbox);

  const refresh = useCallback(() => meshStatus().then((s) => {
    setSt(s); setOn(!!s.running);
    setNameState((cur) => {
      if (cur) return cur;
      const d = cleanName(s.model || '');
      if (d) saveName(d);
      return d;
    });
  }).catch((e) => setErr(String(e?.message || e))), []);
  useEffect(() => { if (available) refresh(); }, [available, refresh]);

  const isNear = (fp) => { const p = R.current.live[fp]; return !!p && Date.now() - p.t < IN_RANGE_MS; };
  const labelOf = (fp) => { const c = R.current.contacts[fp]; return c?.alias || c?.name || fp.slice(0, 8); };

  // One Bluetooth send at a time (Android limits parallel connections).
  const tx = (fp, body) => {
    pendingTx.current += 1;
    const run = () => withTimeout(meshSendText(fp, JSON.stringify(body)), SEND_TIMEOUT_MS);
    const next = chain.current.then(run, run);
    chain.current = next.catch(() => {});
    return next.finally(() => { pendingTx.current -= 1; });
  };
  const base = () => ({ f: R.current.st?.fingerprint, n: R.current.name });

  // A voice note is many small frames written back-to-back over one connection.
  const txVoice = (fp, frames) => {
    pendingTx.current += 1;
    const run = () => withTimeout(meshSendChunks(fp, frames), VOICE_TIMEOUT_MS);
    const next = chain.current.then(run, run);
    chain.current = next.catch(() => {});
    return next.finally(() => { pendingTx.current -= 1; });
  };

  // Keep audio only for the most recent voice notes so storage never fills up.
  const pruneAudio = (all) => {
    const voice = Object.entries(all).flatMap(([tid, l]) => l.filter((m) => m.kind === 'v' && m.audio).map((m) => ({ tid, id: m.id, at: m.at })))
      .sort((a, b) => b.at - a.at).slice(KEEP_VOICE);
    if (voice.length === 0) return all;
    const drop = new Set(voice.map((v) => `${v.tid}:${v.id}`));
    return Object.fromEntries(Object.entries(all).map(([tid, l]) => [tid, l.map((m) => (drop.has(`${tid}:${m.id}`) ? { ...m, audio: null } : m))]));
  };
  const assemble = useRef(makeAssembler());

  const hello = (fp) => {
    if (helloed.current.has(fp)) return;
    helloed.current.add(fp);
    tx(fp, { t: 'hi', ...base() }).catch(() => helloed.current.delete(fp));
  };

  const setStatus = (tid, id, fp, s) => upChats((p) => ({
    ...p,
    [tid]: (p[tid] || []).map((m) => (m.id === id ? { ...m, s: { ...m.s, [fp]: s } } : m)),
  }));

  const flush = async (fp) => {
    if (!R.current.on || flushing.current.has(fp) || !isNear(fp)) return;
    flushing.current.add(fp);
    try {
      const mine = R.current.outbox.filter((m) => m.to === fp).sort((a, b) => a.at - b.at);
      for (const m of mine) {
        if (Date.now() - m.at > OUTBOX_TTL_MS) {
          upOutbox((o) => o.filter((x) => x.id !== m.id)); setStatus(m.tid, m.id, fp, 'expired'); continue;
        }
        const th = R.current.threads[m.tid];
        const group = !!th && !m.tid.startsWith('dm:');
        try {
          if (m.kind === 'v') {
            await txVoice(fp, frameVoice(R.current.st.fingerprint, m.id, m.mime, b64ToBytes(m.audio)));
          } else if (group && !th.intro?.[fp]) {
            await tx(fp, { t: 'g', ...base(), g: m.tid, m: [R.current.st.fingerprint, ...th.members] });
            upThreads((p) => ({ ...p, [m.tid]: { ...p[m.tid], intro: { ...(p[m.tid].intro || {}), [fp]: true } } }));
          }
          if (m.kind !== 'v') await tx(fp, { t: 'm', ...base(), i: m.id, x: m.x, ...(group ? { g: m.tid } : {}) });
        } catch (e) { // not reachable right now: keep it queued, retry every few seconds
          setSendErr((p) => ({ ...p, [fp]: String(e?.message || e) }));
          break;
        }
        setSendErr((p) => { if (!p[fp]) return p; const n = { ...p }; delete n[fp]; return n; });
        upOutbox((o) => o.filter((x) => x.id !== m.id));
        setStatus(m.tid, m.id, fp, 'delivered');
      }
    } finally { flushing.current.delete(fp); }
  };

  const ensureThread = (tid, members) => upThreads((p) => {
    if (p[tid]) return p;
    return { ...p, [tid]: { id: tid, members, intro: {}, updated: Date.now(), unread: false } };
  });

  // Live events while Nearby is on.
  useEffect(() => {
    if (!on) return undefined;
    const offs = [];
    let dead = false;
    (async () => {
      const a = await meshOn('peer', (p) => {
        if (!FP_RE.test(p.peer)) return;
        const rec = { rssi: p.rssi, t: Date.now() };
        R.current.live = { ...R.current.live, [p.peer]: rec };
        setLive((prev) => ({ ...prev, [p.peer]: rec }));
        upContacts((c) => ({ ...c, [p.peer]: { ...(c[p.peer] || {}), last: Date.now() } }));
        hello(p.peer);
        flush(p.peer);
      });
      const b = await meshOn('data', (d) => {
        if (isVoiceFrame(d.bytes)) { // a piece of a voice note
          const v = assemble.current(d.bytes);
          if (!v || !FP_RE.test(v.fp)) return;
          const tid = dmId(v.fp);
          ensureThread(tid, [v.fp]);
          setTyping((p) => { const n = { ...p }; delete n[v.fp]; return n; });
          if ((R.current.chats[tid] || []).some((x) => x.id === v.id)) return;
          upContacts((c) => ({ ...c, [v.fp]: { ...(c[v.fp] || {}), last: Date.now() } }));
          upChats((p) => {
            const list = p[tid] || [];
            if (list.some((x) => x.id === v.id)) return p;
            return pruneAudio({ ...p, [tid]: [...list, { id: v.id, from: v.fp, kind: 'v', audio: bytesToB64(v.audio), mime: v.mime, at: Date.now() }].slice(-CHAT_MAX) });
          });
          upThreads((p) => {
            const th = p[tid];
            if (!th) return p;
            const viewing = membersKey(R.current.selected) === membersKey(th.members);
            return { ...p, [tid]: { ...th, updated: Date.now(), unread: viewing ? th.unread : true } };
          });
          return;
        }
        let m;
        try { m = JSON.parse(d.text); } catch { return; }
        if (!m || !['hi', 'm', 'g', 'ty'].includes(m.t) || !FP_RE.test(m.f || '')) return;
        const fp = m.f;
        const me = R.current.st?.fingerprint;
        const nm = cleanName(m.n);
        if (m.t !== 'ty') {
          upContacts((c) => ({ ...c, [fp]: { ...(c[fp] || {}), name: nm || c[fp]?.name, last: Date.now() } }));
        }
        if (m.t === 'hi') { hello(fp); return; } // answer once per session (no-op if already sent)

        const gid = typeof m.g === 'string' && m.g.length <= 16 ? m.g : null;
        const tid = gid || dmId(fp);

        if (m.t === 'ty') {
          setTyping((p) => ({ ...p, [fp]: { tid, until: Date.now() + TYPING_TTL_MS } }));
          return;
        }
        if (m.t === 'g') {
          if (!gid || !Array.isArray(m.m)) return;
          const members = m.m.filter((x) => FP_RE.test(x) && x !== me).slice(0, GROUP_MAX);
          if (!members.includes(fp)) members.push(fp);
          upThreads((p) => ({ ...p, [gid]: { ...(p[gid] || { id: gid, intro: {}, updated: Date.now(), unread: false }), members } }));
          return;
        }
        // a message
        if (typeof m.x !== 'string' || typeof m.i !== 'string' || m.i.length > 16) return;
        ensureThread(tid, [fp]);
        setTyping((p) => { const n = { ...p }; delete n[fp]; return n; });
        if ((R.current.chats[tid] || []).some((x) => x.id === m.i)) return; // a resend we already have
        upChats((p) => {
          const list = p[tid] || [];
          if (list.some((x) => x.id === m.i)) return p;
          return { ...p, [tid]: [...list, { id: m.i, from: fp, x: m.x.slice(0, 200), at: Date.now() }].slice(-CHAT_MAX) };
        });
        upThreads((p) => {
          const th = p[tid];
          if (!th) return p;
          const viewing = membersKey(R.current.selected) === membersKey(th.members);
          return { ...p, [tid]: { ...th, updated: Date.now(), unread: viewing ? th.unread : true } };
        });
      });
      const c = await meshOn('error', (e) => setErr(e.error));
      if (dead) { a(); b(); c(); } else offs.push(a, b, c);
    })();
    return () => { dead = true; offs.forEach((f) => f()); };
     
  }, [on]);

  // Every 5 s: refresh "nearby / out of range", expire typing, retry the queue for anyone in range.
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => {
      setNow(Date.now());
      Object.keys(R.current.live).forEach((fp) => flush(fp));
    }, 5000);
    return () => clearInterval(id);
     
  }, [on]);
  // Typing dots clear themselves quickly.
  useEffect(() => {
    const id = setInterval(() => setTyping((p) => {
      const t = Date.now();
      const n = Object.fromEntries(Object.entries(p).filter(([, v]) => v.until > t));
      return Object.keys(n).length === Object.keys(p).length ? p : n;
    }), 1000);
    return () => clearInterval(id);
  }, []);

  const toggle = async () => {
    setErr('');
    try {
      if (R.current.on) {
        await meshStop(); setLive({}); R.current.live = {}; helloed.current.clear(); setTyping({});
      } else await meshStart();
      await refresh();
    } catch (e) { setErr(String(e?.message || e)); }
  };

  const rename = (v) => { setNameState(v.slice(0, 16)); saveName(v); };

  // ---- conversations ----
  const threadFor = (sel) => {
    if (sel.length === 0) return null;
    if (sel.length === 1) return dmId(sel[0]);
    const k = membersKey(sel);
    return Object.values(R.current.threads).find((t) => !t.id.startsWith('dm:') && membersKey(t.members) === k)?.id || null;
  };
  const activeTid = threadFor(selected);

  const toggleSelect = (fp) => setSelected((s) => {
    if (s.includes(fp)) return s.filter((x) => x !== fp);
    return s.length >= GROUP_MAX ? s : [...s, fp];
  });

  const openThread = (tid) => {
    const th = R.current.threads[tid];
    if (!th) return;
    setSelected(th.members);
    upThreads((p) => (p[tid]?.unread ? { ...p, [tid]: { ...p[tid], unread: false } } : p));
  };

  const markRead = (tid) => upThreads((p) => (p[tid]?.unread ? { ...p, [tid]: { ...p[tid], unread: false } } : p));

  const send = (text) => {
    const x = text.trim();
    const members = R.current.selected;
    if (!x || members.length === 0) return false;
    const tid = threadFor(members) || `g${newId()}`;
    ensureThread(tid, members);
    const id = newId();
    const at = Date.now();
    const s = Object.fromEntries(members.map((fp) => [fp, 'queued']));
    upChats((p) => ({ ...p, [tid]: [...(p[tid] || []), { id, from: 'me', x, at, s }].slice(-CHAT_MAX) }));
    upThreads((p) => ({ ...p, [tid]: { ...p[tid], updated: at } }));
    upOutbox((o) => [...o, ...members.map((to) => ({ id, tid, to, x, at }))]);
    setTimeout(() => members.forEach((fp) => flush(fp)), 0);
    return true;
  };

  // Voice notes go to exactly one device (the frames carry no group information).
  const sendVoice = ({ audio, mime, ms }) => {
    const members = R.current.selected;
    if (members.length !== 1) return false;
    const tid = dmId(members[0]);
    ensureThread(tid, members);
    const id = newVoiceId();
    const at = Date.now();
    const b64 = bytesToB64(audio);
    upChats((p) => pruneAudio({ ...p, [tid]: [...(p[tid] || []), { id, from: 'me', kind: 'v', audio: b64, mime, ms, at, s: { [members[0]]: 'queued' } }].slice(-CHAT_MAX) }));
    upThreads((p) => ({ ...p, [tid]: { ...p[tid], updated: at } }));
    upOutbox((o) => [...o, { id, tid, to: members[0], kind: 'v', audio: b64, mime, at }]);
    setTimeout(() => flush(members[0]), 0);
    return true;
  };

  // Tell the people you're writing to that you're typing (at most every 3 s, and never
  // when the radio is busy sending a message).
  const notifyTyping = () => {
    const t = Date.now();
    if (!R.current.on || t - lastTyping.current < TYPING_EVERY_MS || pendingTx.current > 0) return;
    const tid = threadFor(R.current.selected);
    lastTyping.current = t;
    R.current.selected.filter(isNear).forEach((fp) => {
      tx(fp, { t: 'ty', f: R.current.st?.fingerprint, ...(tid && !tid.startsWith('dm:') ? { g: tid } : {}) }).catch(() => {});
    });
  };

  const typingNow = Object.entries(typing)
    .filter(([fp, v]) => v.tid === activeTid && selected.includes(fp))
    .map(([fp]) => labelOf(fp));

  // ---- saved devices ----
  const renameDevice = (fp, alias) => upContacts((c) => ({ ...c, [fp]: { ...c[fp], alias: cleanName(alias) || undefined } }));
  const refreshDevice = (fp) => { helloed.current.delete(fp); hello(fp); };
  const refreshAll = () => {
    const t = Date.now();
    const keep = Object.fromEntries(Object.entries(R.current.live).filter(([, v]) => t - v.t < IN_RANGE_MS));
    R.current.live = keep; setLive(keep); helloed.current.clear();
    Object.keys(keep).forEach(refreshDevice);
  };
  const deleteDevice = (fp) => {
    upContacts((c) => { const n = { ...c }; delete n[fp]; return n; });
    upOutbox((o) => o.filter((m) => m.to !== fp));
    upThreads((p) => Object.fromEntries(Object.entries(p).filter(([id, th]) => id !== dmId(fp) && !(th.members.length === 1 && th.members[0] === fp))));
    upChats((p) => { const n = { ...p }; delete n[dmId(fp)]; return n; });
    setSelected((s) => s.filter((x) => x !== fp));
  };
  const deleteThread = (tid) => {
    upThreads((p) => { const n = { ...p }; delete n[tid]; return n; });
    upChats((p) => { const n = { ...p }; delete n[tid]; return n; });
    upOutbox((o) => o.filter((m) => m.tid !== tid));
    if (tid === threadFor(R.current.selected)) setSelected([]);
  };

  return {
    available, st, on, err, name, live, contacts, threads, chats, outbox, selected, now,
    activeTid, typingNow, isNear, labelOf, sendErr,
    toggle, rename, toggleSelect, setSelected, openThread, markRead, send, sendVoice, notifyTyping,
    renameDevice, refreshDevice, refreshAll, deleteDevice, deleteThread,
  };
}
