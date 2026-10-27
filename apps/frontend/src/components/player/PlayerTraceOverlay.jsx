import { useEffect, useState } from 'react';
import { getTrace, subscribeTrace, clearTrace, eventLine, traceText, pdebugOn } from '../../utils/playerTrace';

// ?pdebug=1 — a small, read-only view of the player's flight recorder
// (utils/playerTrace.js) with a Copy button, so a tester can paste what the
// player did instead of describing it. Renders nothing unless asked for.
export default function PlayerTraceOverlay() {
  const [on] = useState(() => pdebugOn());
  const [, bump] = useState(0);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => (on ? subscribeTrace(() => bump((n) => n + 1)) : undefined), [on]);
  if (!on) return null;

  const copy = async () => {
    const text = traceText(80, 20000);
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch {
      // Clipboard refused (insecure context / permissions): select-able text below still works.
      setCopied(false);
    }
  };

  const events = getTrace(40);
  return (
    <div
      data-player-trace=""
      className="fixed left-2 right-2 bottom-2 z-[9999] rounded-lg bg-black/85 text-[10px] leading-tight text-green-300 font-mono border border-green-500/40 pointer-events-auto"
      style={{ maxHeight: open ? '40vh' : undefined }}
    >
      <div className="flex items-center gap-2 px-2 py-1 border-b border-green-500/30">
        <b className="text-green-200">player trace</b>
        <span className="opacity-60">{getTrace().length} events</span>
        <span className="flex-1" />
        <button type="button" onClick={copy} className="px-2 py-0.5 rounded bg-green-500/20 hover:bg-green-500/30">{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" onClick={clearTrace} className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20">Clear</button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20">{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <pre className="m-0 p-2 overflow-auto whitespace-pre-wrap select-text" style={{ maxHeight: 'calc(40vh - 28px)' }}>
          {events.length ? events.map(eventLine).join('\n') : 'no events yet — play something'}
        </pre>
      )}
    </div>
  );
}
