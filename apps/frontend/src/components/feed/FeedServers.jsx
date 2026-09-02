import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { PROVIDERS, isConnectable } from '../../config/socialProviders';

// SERVERS — which sources the timeline draws from. Default: all of them.
//
// ── WHY A DROPDOWN AND NOT MORE PILLS ───────────────────────────────────────
//
// The pill row works for three sources and stops working at ten. The spec's
// source list runs to Reddit, X, GitHub, Hacker News, live news, markets,
// music, Tube and community submissions, and a row of ten pills is a wall,
// not a control. A dropdown holds the full list, shows how many are on at a
// glance, and does not reflow the page when one is toggled.
//
// ── "DEFAULT ALL" MEANS ALL THE ONES THAT CAN ACTUALLY RUN ──────────────────
//
// Everything keyless is on for a first-time visitor, because a feed that
// opens empty and asks you to pick sources before it will show you anything
// is a worse first run than one that just works. What "all" cannot include is
// a source that needs an account: switching those on for somebody who has not
// connected one would fetch nothing and report an error they did not cause.
// So `isConnectable` decides membership, the same predicate the connect flow
// uses — a source becomes available here the moment it becomes available
// there, with no second list to keep in step.
//
// A source that cannot work yet is still LISTED, greyed, with its real reason
// on it. "Why is X missing" is a worse question than "why is X grey", because
// only the second one has a visible answer.

export default function FeedServers({ selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  // Click-away and Escape. A dropdown that can only be closed by clicking its
  // own button is a trap on touch, where there is no cursor to signal that
  // the rest of the page is still live.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const available = PROVIDERS.filter((p) => isConnectable(p.id));
  const toggle = (id) => {
    const has = selected.includes(id);
    // Never let the last one be switched off. An empty selection is not a
    // filter, it is a blank page with no way back except guessing.
    if (has && selected.length === 1) return;
    onChange(has ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const allOn = available.length > 0 && available.every((p) => selected.includes(p.id));

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        data-feed-servers-toggle=""
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
      >
        <span className="flex -space-x-1">
          {available.filter((p) => selected.includes(p.id)).slice(0, 4).map((p) => (
            <span
              key={p.id}
              className="w-2.5 h-2.5 rounded-full ring-1 ring-black"
              style={{ background: p.colour }}
            />
          ))}
        </span>
        Servers
        <span className="text-white/40">
          {allOn ? 'all' : `${selected.length}/${available.length}`}
        </span>
        <ChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </button>

      {open && (
        <div
          role="listbox"
          data-feed-servers-menu=""
          className="absolute z-30 mt-1.5 w-64 max-h-80 overflow-y-auto rounded-xl border border-white/15 bg-[#0b0e12]/95 backdrop-blur-sm p-1 shadow-2xl"
        >
          {PROVIDERS.map((p) => {
            const usable = isConnectable(p.id);
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={on}
                data-feed-server={p.id}
                data-usable={usable ? 'yes' : 'no'}
                disabled={!usable}
                onClick={() => usable && toggle(p.id)}
                title={p.note}
                className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${
                  usable ? 'hover:bg-white/[0.07] cursor-pointer' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                  style={{ background: p.colour }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-white/90 truncate">{p.label}</span>
                  <span className="block text-[10px] leading-tight text-white/40 truncate">{p.note}</span>
                </span>
                {on && <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
