import { useEffect, useReducer, useRef, useState } from 'react';
import { Send, Globe2 } from 'lucide-react';
import { startMailbox, subscribe, getChats, getOutbox, receive } from './mailbox';
import { sendMessage } from './send';
import { cleanHandle } from './seal';
import { lookupHandle } from './identity';

const STATE = { queued: 'waiting to send', sent: 'sent', failed: 'couldn’t send' };

// Messages to a handle over the internet, for when you are out of Bluetooth range. They are
// encrypted on this device before they leave it; our server only holds scrambled bytes until the
// other person's app picks them up (instantly if it is open, otherwise when they come back).
export default function InternetChat() {
  const [, bump] = useReducer((n) => n + 1, 0);
  const [peer, setPeer] = useState('');
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    const stop = startMailbox();
    const un = subscribe(bump);
    receive().catch(() => {});
    return () => { un(); stop(); };
  }, []);

  const chats = getChats();
  const waiting = getOutbox().length;
  const handles = Object.keys(chats).sort((a, b) => (chats[b].at(-1)?.at || 0) - (chats[a].at(-1)?.at || 0));
  const list = open ? chats[open] || [] : [];
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [list.length, open]);

  const start = async (e) => {
    e.preventDefault();
    const h = cleanHandle(peer);
    if (!h) return;
    setBusy(true); setErr('');
    try {
      const found = await lookupHandle(h);
      if (!found) { setErr(`No one is called “${h}”. Names must be typed exactly.`); return; }
      setOpen(found.handle); setPeer('');
    } catch { setErr('Could not look that up right now.'); } finally { setBusy(false); }
  };
  const send = async (e) => {
    e.preventDefault();
    if (!open || !text.trim()) return;
    setErr('');
    try { await sendMessage(open, text); setText(''); } catch (x) { setErr(x?.message || 'Could not send.'); }
  };

  return (
    <section aria-label="Internet messages" className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3" data-internet-chat="">
      <div className="flex items-center gap-2 text-sm text-white/80"><Globe2 size={14} /> Message anyone, anywhere</div>
      <p className="text-[11px] text-white/45">
        Out of Bluetooth range? Type a name. Your message is encrypted on this device and delivered when their app is open or the next time they
        come back (kept up to 7 days, scrambled — we can’t read it).{waiting > 0 && ` ${waiting} waiting to send.`}
      </p>

      <form className="flex items-center gap-2" onSubmit={start}>
        <input value={peer} onChange={(e) => setPeer(e.target.value)} placeholder="Their name, e.g. calm-otter-4821" maxLength={30} aria-label="Their name"
          className="min-w-0 flex-1 h-8 px-2 rounded-md bg-white/5 border border-white/15 text-xs text-white outline-none focus:border-white/40" />
        <button type="submit" disabled={busy || !peer}
          className="h-8 px-3 rounded-md border border-white/20 text-[11px] uppercase tracking-wider text-white/70 enabled:hover:bg-white/10 disabled:opacity-30">Open</button>
      </form>

      {handles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {handles.map((h) => (
            <button key={h} type="button" onClick={() => setOpen(h)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${h === open ? 'border-orange-400/70 text-orange-200' : 'border-white/15 text-white/60 hover:bg-white/5'}`}>{h}</button>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-2">
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1" role="log" aria-live="polite">
            {list.length === 0 && <p className="text-[11px] text-white/35">No messages yet with {open}.</p>}
            {list.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${m.from === 'me' ? 'bg-orange-400/15 text-orange-50' : 'bg-white/10 text-white'}`}>
                  <p className="whitespace-pre-wrap break-words">{m.x}</p>
                  {m.from === 'me' && m.s && <p className="text-[9px] text-white/40 mt-0.5">{STATE[m.s] || m.s}</p>}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="flex items-center gap-2" onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${open}`} maxLength={1000} aria-label="Message"
              className="min-w-0 flex-1 h-9 px-3 rounded-md bg-white/5 border border-white/15 text-sm text-white outline-none focus:border-white/40" />
            <button type="submit" disabled={!text.trim()} aria-label="Send"
              className="flex items-center justify-center w-9 h-9 rounded-md border border-white/20 text-white/80 enabled:hover:bg-white/10 disabled:opacity-30"><Send size={14} /></button>
          </form>
        </div>
      )}
      {err && <p className="text-[11px] text-red-300" role="alert">{err}</p>}
    </section>
  );
}
