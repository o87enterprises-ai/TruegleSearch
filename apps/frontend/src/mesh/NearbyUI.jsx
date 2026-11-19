import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, X, Check, Clock, ChevronDown, Trash2, Pencil, RefreshCw, Bluetooth, Mic, Square } from 'lucide-react';
import { proximity, byteLen, NAME_MAX } from './store';
import { audioToUrl } from './voice';

// ---------- On / off switch (replaces the pill on this page) ----------
export function PowerSwitch({ on, onChange, disabled }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-lg font-bold transition-colors duration-300 ${on ? 'text-orange-300' : 'text-white/40'}`}>
        Nearby {on ? 'ON' : 'OFF'}
      </span>
      <button type="button" role="switch" aria-checked={on} aria-label="Nearby" disabled={disabled} onClick={onChange}
        className={`relative h-9 w-[4.5rem] rounded-full border transition-colors duration-300 disabled:opacity-40 ${
          on ? 'bg-gradient-to-r from-orange-500 to-amber-500 border-orange-300/60 shadow-[0_0_24px_rgba(249,115,22,0.45)]' : 'bg-white/10 border-white/20'}`}>
        <span className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform duration-300 ${on ? 'translate-x-9' : ''}`} />
      </button>
    </div>
  );
}

// ---------- Proximity meter ----------
export function ProximityMeter({ rssi, near = true }) {
  const { bars, label } = near ? proximity(rssi) : { bars: 0, label: 'Out of range' };
  const color = bars >= 3 ? 'bg-emerald-400' : bars === 2 ? 'bg-amber-300' : 'bg-red-400';
  return (
    <span className="inline-flex items-center gap-2" title={near && typeof rssi === 'number' ? `${rssi} dBm` : undefined}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} style={{ height: 4 + i * 3 }} className={`w-[3px] rounded-sm ${i <= bars ? color : 'bg-white/15'}`} />
        ))}
      </span>
      <span className={`text-[11px] ${near ? 'text-white/70' : 'text-white/35'}`}>
        {label}{near && typeof rssi === 'number' && <span className="text-white/35"> · {rssi} dBm</span>}
      </span>
    </span>
  );
}

// ---------- The chat box: looks like the search bar, but it is the message box ----------
// (A dedicated box rather than the search bar itself, so messages never land in search history.)
export function ChatBar({ on, canSend, placeholder, value, onChange, onSend, limit, voice }) {
  const live = on && canSend;
  const recording = !!voice?.recording;
  const secs = ((voice?.ms || 0) / 1000).toFixed(1);
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className={`rounded-full p-[2px] transition-all duration-500 ${
        live ? 'bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400 shadow-[0_0_40px_rgba(249,115,22,0.4),0_0_80px_rgba(249,115,22,0.15)]'
          : 'bg-orange-700/30'}`}>
        <div className="flex items-center gap-2 rounded-full bg-black px-4 py-2.5">
          {recording ? (
            <div className="flex flex-1 items-center gap-2 text-sm text-red-300" aria-live="polite">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> Recording {secs}s / {voice.maxS}s — tap ■ to send
            </div>
          ) : (
            <input value={value} disabled={!live}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
              placeholder={placeholder} aria-label="Message"
              className="flex-1 bg-transparent text-base text-white placeholder:text-white/35 outline-none disabled:cursor-not-allowed" />
          )}
          {recording && (
            <button type="button" onClick={voice.onCancel} aria-label="Cancel recording" className="rounded-full p-2 text-white/60 hover:bg-white/10"><X size={16} /></button>
          )}
          {voice?.available && !value.trim() && (
            <button type="button" onClick={voice.onMic} disabled={!live || !voice.canVoice}
              aria-label={recording ? 'Stop and send voice note' : 'Record a voice note'}
              title={voice.canVoice ? 'Voice note' : 'Voice notes go to one device at a time'}
              className={`rounded-full p-2 transition-opacity disabled:opacity-30 ${recording ? 'bg-red-500 text-white' : 'bg-orange-500/90 text-black'}`}>
              {recording ? <Square size={16} /> : <Mic size={16} />}
            </button>
          )}
          {!recording && (!voice?.available || value.trim()) && (
            <button type="button" onClick={onSend} disabled={!live || !value.trim()} aria-label="Send message"
              className="rounded-full bg-orange-500/90 p-2 text-black transition-opacity disabled:opacity-30">
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
      {live && !recording && <p className="mt-1 text-right text-[10px] text-white/30">{byteLen(value)}/{limit} bytes</p>}
      {voice?.error && <p className="mt-1 text-center text-xs text-red-300" role="alert">{voice.error}</p>}
    </div>
  );
}

// ---------- Instruction modal ----------
export function GuideContent() {
  const H = ({ children }) => <h3 className="mt-3 text-sm font-semibold text-orange-300">{children}</h3>;
  const L = ({ children }) => <li className="text-[13px] text-white/70 leading-snug">{children}</li>;
  return (
    <div>
      <H>How it works</H>
      <ul className="mt-1 list-disc pl-5 space-y-1">
        <L>Phones with Truegle find each other over Bluetooth — no internet, signal or accounts.</L>
        <L>Turn Nearby on, <b>pick one or more phones</b> from Available devices, then type in the box and press send.</L>
        <L>Each phone shows how close the other is. Closer means a more reliable connection.</L>
        <L>Out of range? Your message waits on your phone and is sent automatically when that person comes back in range — with Nearby on and the app open on both phones.</L>
      </ul>
      <H>Using it in an emergency</H>
      <ul className="mt-1 list-disc pl-5 space-y-1">
        <L>Agree on a name with your group first (set “Your name”), and turn Nearby on at the same time.</L>
        <L>Keep messages short and useful: who, where, what you need, when you’ll check again.</L>
        <L>Call emergency services whenever you have any cell signal. Nearby is for when you don’t.</L>
        <L>Save battery: dim the screen, close other apps, and turn Nearby off when you’re not expecting messages.</L>
      </ul>
      <H>Limits — please read</H>
      <ul className="mt-1 list-disc pl-5 space-y-1">
        <L>Range is short: a room or a few houses, roughly 10–30 m indoors and up to about 100 m in the open. Walls, vehicles and bodies cut it.</L>
        <L><b>Android only, and the app must stay open</b> with Bluetooth on. It does not run in the background yet.</L>
        <L>Phones only reach each other directly — messages are <b>not relayed</b> through other phones yet.</L>
        <L>Text messages are short (about 90 characters). Voice notes are up to 8 seconds, to one person at a time, and take a few seconds to send.</L>
        <L>Nothing is <b>encrypted yet</b>. Don’t send passwords or anything private.</L>
        <L>Works on Android phones (6.0 or newer) with Bluetooth LE. Some budget phones can’t be “seen” by others; Nearby tells you if yours can’t. iPhones aren’t supported yet.</L>
        <L>Up to 5 other people per conversation. Queued messages are dropped after 24 hours.</L>
      </ul>
    </div>
  );
}

export function GuideModal({ open, onClose, hide, onHide }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
            role="dialog" aria-modal="true" aria-label="How Nearby works"
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-orange-400/40 bg-[#0a0a12] p-5 shadow-[0_0_40px_rgba(249,115,22,0.25)]"
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"><X size={18} /></button>
            <h2 className="text-lg font-bold text-white">Nearby is on</h2>
            <GuideContent />
            <label className="mt-4 flex items-center gap-2 text-xs text-white/55">
              <input type="checkbox" checked={hide} onChange={(e) => onHide(e.target.checked)} /> Don’t show this again
            </label>
            <button type="button" onClick={onClose} className="mt-3 w-full rounded-full bg-orange-500 py-2.5 text-sm font-bold text-black hover:bg-orange-400">Got it</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- "Connected" pop-up, like a Bluetooth pairing toast ----------
export function Toasts({ items }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[10001] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur ${
              t.kind === 'up' ? 'border-emerald-400/50 bg-emerald-950/90 text-emerald-100' : 'border-white/20 bg-neutral-900/90 text-white/70'}`}>
            <Bluetooth size={15} className={t.kind === 'up' ? 'text-emerald-300' : 'text-white/40'} />
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------- Collapsible section ----------
export function Collapsible({ open, onToggle, title, badge, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04]">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0 truncate text-sm font-semibold text-white">{title}{badge != null && <span className="ml-2 text-xs font-normal text-white/45">{badge}</span>}</span>
        <ChevronDown size={16} className={`flex-shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const initials = (s) => (s || '?').trim().slice(0, 2).toUpperCase();
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const ago = (t) => {
  if (!t) return 'never seen';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'seen just now' : m < 60 ? `seen ${m} min ago` : m < 1440 ? `seen ${Math.round(m / 60)} h ago` : `seen ${Math.round(m / 1440)} d ago`;
};

// ---------- Available devices: pick who to message; each row carries its own history + manage tools ----------
export function DeviceList({ rows, selected, onToggle, onDone, name, onName, onRefreshAll, canRefresh, onRename, onRefresh, onDelete, sendErr }) {
  const [editing, setEditing] = useState(null);
  const [val, setVal] = useState('');
  const commit = (fp) => { onRename(fp, val); setEditing(null); };
  return (
    <div>
      <div className="mb-3 flex items-end gap-2">
        <label className="flex-1 text-[11px] text-white/50">Your name (shown to others)
          <input value={name} maxLength={NAME_MAX} onChange={(e) => onName(e.target.value)}
            className="mt-1 w-full rounded-md bg-black/40 border border-white/15 px-3 py-2 text-sm text-white" />
        </label>
        <button type="button" onClick={onRefreshAll} disabled={!canRefresh}
          className="rounded-full border border-white/20 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-40">Refresh all</button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-white/45">Looking for nearby phones with Truegle… keep both phones close, with Bluetooth and Nearby on. Phones you meet are saved here.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const sel = selected.includes(r.fp);
            return (
              <li key={r.fp} className={`rounded-lg border transition-colors ${sel ? 'border-orange-400/70 bg-orange-500/10' : 'border-white/10'}`}>
                <div className="flex items-stretch">
                  <button type="button" onClick={() => editing !== r.fp && onToggle(r.fp)} aria-pressed={sel}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${sel ? 'border-orange-300 bg-orange-400 text-black' : 'border-white/30'}`}>{sel && <Check size={13} />}</span>
                    <span className="min-w-0 flex-1">
                      {editing === r.fp ? (
                        <input autoFocus value={val} maxLength={NAME_MAX} onClick={(e) => e.stopPropagation()} onChange={(e) => setVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commit(r.fp); if (e.key === 'Escape') setEditing(null); }}
                          onBlur={() => commit(r.fp)} aria-label="Device name"
                          className="w-full rounded bg-black/50 border border-white/20 px-2 py-1 text-sm" />
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${r.near ? 'bg-emerald-400' : 'bg-white/20'}`} aria-label={r.near ? 'In range' : 'Out of range'} />
                          <span className="truncate text-sm font-semibold">{r.label}</span>
                          {r.unread && <span className="rounded-full bg-orange-400 px-1.5 text-[10px] font-bold text-black">new</span>}
                          {r.waiting > 0 && <span className="text-[11px] text-amber-300">{r.waiting} waiting</span>}
                        </span>
                      )}
                      <span className="mt-0.5 block">
                        <ProximityMeter rssi={r.rssi} near={r.near} />
                        {!r.near && <span className="ml-2 text-[11px] text-white/30">{ago(r.last)}</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-white/45">
                        {r.lastMsg ? `${r.lastMsg.from === 'me' ? 'You: ' : ''}${r.lastMsg.kind === 'v' ? '🎤 Voice note' : r.lastMsg.x}` : 'No messages yet'}
                        {r.lastMsg && <span className="text-white/25"> · {hhmm(r.lastMsg.at)}</span>}
                      </span>
                      {r.waiting > 0 && sendErr[r.fp] && <span className="mt-0.5 block truncate text-[11px] text-red-300/80">Retrying: {sendErr[r.fp]}</span>}
                    </span>
                  </button>
                  <div className="flex flex-shrink-0 items-center gap-0.5 pr-2 text-white/45">
                    <button type="button" aria-label="Refresh device" title="Refresh" onClick={() => onRefresh(r.fp)} className="rounded p-1.5 hover:bg-white/10 hover:text-white"><RefreshCw size={14} /></button>
                    <button type="button" aria-label="Rename device" title="Rename" onClick={() => { setEditing(r.fp); setVal(r.alias || r.name || ''); }} className="rounded p-1.5 hover:bg-white/10 hover:text-white"><Pencil size={14} /></button>
                    <button type="button" aria-label="Delete device" title="Delete"
                      onClick={() => { if (window.confirm(`Delete ${r.label}? Its conversation and any waiting messages are removed from this phone.`)) onDelete(r.fp); }}
                      className="rounded p-1.5 hover:bg-white/10 hover:text-red-300"><Trash2 size={14} /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" onClick={onDone} disabled={selected.length === 0}
        className="mt-3 w-full rounded-full border border-orange-400/60 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/10 disabled:opacity-40">
        {selected.length ? `Message ${selected.length} ${selected.length === 1 ? 'device' : 'devices'}` : 'Select a device to message'}
      </button>
    </div>
  );
}

// ---------- Who you're talking to, with a live in-range indicator ----------
export function ConversationHeader({ people }) {
  return (
    <div className="flex flex-wrap gap-2">
      {people.map((p) => (
        <span key={p.fp} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${p.near ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/15 bg-white/5'}`}>
          <span className="relative flex h-2 w-2">
            {p.near && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${p.near ? 'bg-emerald-400' : 'bg-white/30'}`} />
          </span>
          <span className="font-semibold text-white">{p.label}</span>
          <span className={p.near ? 'text-emerald-300' : 'text-white/45'}>{p.near ? 'Online · in range' : 'Out of range'}</span>
          {p.near && <ProximityMeter rssi={p.rssi} near />}
        </span>
      ))}
    </div>
  );
}

// ---------- Message cards: sent = orange, received = blue; appear one at a time ----------
function Status({ m }) {
  const vals = Object.values(m.s || {});
  if (vals.length === 0) return null;
  const done = vals.filter((v) => v === 'delivered').length;
  const expired = vals.filter((v) => v === 'expired').length;
  if (done === vals.length) return <span className="inline-flex items-center gap-1 text-emerald-300"><Check size={11} /> Delivered</span>;
  if (done + expired === vals.length) return <span className="text-red-300">Not delivered (expired)</span>;
  return (
    <span className="inline-flex items-center gap-1 text-amber-300">
      <Clock size={11} /> {vals.length > 1 ? `Delivered to ${done} of ${vals.length} · waiting` : 'Waiting for them to come in range'}
    </span>
  );
}

function VoiceNote({ m }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!m.audio) return undefined;
    const u = audioToUrl(m.audio, m.mime);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [m.audio, m.mime]);
  if (!m.audio) return <p className="text-xs text-white/40">🎤 Voice note (older audio removed to save space)</p>;
  return url ? <audio controls preload="metadata" src={url} className="h-9 w-full" aria-label="Voice note" /> : null;
}

export function MessageCards({ list, labelOf }) {
  const end = useRef(null);
  const first = useRef(list.length); // messages already here when the thread opened play in one by one
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [list.length]);
  if (list.length === 0) return <p className="text-xs text-white/40">No messages yet — type in the box above.</p>;
  return (
    <ul className="space-y-2.5">
      {list.map((m, i) => {
        const mine = m.from === 'me';
        const who = mine ? 'You' : labelOf(m.from);
        return (
          <motion.li key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i < first.current ? Math.min(i, 10) * 0.12 : 0 }}
            className={`rounded-xl border border-l-4 p-3 ${mine
              ? 'border-orange-400/30 border-l-orange-400 bg-orange-500/[0.08] ml-6'
              : 'border-sky-400/30 border-l-sky-400 bg-sky-500/[0.08] mr-6'}`}>
            <div className="mb-1 flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-black ${mine ? 'bg-orange-400' : 'bg-sky-400'}`}>{initials(who)}</span>
              <span className={`text-xs font-semibold ${mine ? 'text-orange-200' : 'text-sky-200'}`}>{who}</span>
              <span className="text-[11px] text-white/35">{hhmm(m.at)}</span>
            </div>
            {m.kind === 'v' ? <VoiceNote m={m} /> : <p className="whitespace-pre-wrap break-words text-sm text-white">{m.x}</p>}
            {mine && <div className="mt-1.5 text-[11px]"><Status m={m} /></div>}
          </motion.li>
        );
      })}
      <li ref={end} aria-hidden="true" />
    </ul>
  );
}

export function TypingIndicator({ names }) {
  if (names.length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-white/60" aria-live="polite">
      <span className="inline-flex items-end gap-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-sky-300" style={{ animation: `nb-dot 1s ${i * 0.15}s infinite ease-in-out` }} />
        ))}
      </span>
      {names.join(', ')} {names.length > 1 ? 'are' : 'is'} typing…
      <style>{`@keyframes nb-dot { 0%,60%,100% { transform: translateY(0); opacity:.4 } 30% { transform: translateY(-4px); opacity:1 } }
        @media (prefers-reduced-motion: reduce) { [style*="nb-dot"] { animation: none !important } }`}</style>
    </div>
  );
}
