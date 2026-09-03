import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, ListPlus, ExternalLink, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

// The action sheet a tapped feed card opens: Open in app / Add to queue /
// Open link. Three actions, always in that order, always the same three
// regardless of platform — a card is never given a fourth option, because the
// point of "resembles the vids tab" is one predictable gesture everywhere in
// the feed rather than a different menu per source.
//
// PORTALED TO document.body, not rendered in place. Feed cards live inside
// scrolling containers — the vertical list, Browse's horizontal strips — and
// any of those can clip an absolutely-positioned child at its own overflow
// boundary. A portal is what lets one sheet component serve every card
// without each container needing its own overflow exception.
//
// "OPEN IN APP" AND "ADD TO QUEUE" ONLY APPEAR WHEN THE POST IS PLAYABLE.
// `source` is null for a post nothing in videoEmbed.js recognises, and there
// is nothing honest to play or queue — the sheet quietly becomes a two-item
// menu (Open link, Cancel) rather than offering an action that would do
// nothing.

export default function FeedCardActions({ open, onClose, source, link, title }) {
  const { playNow, enqueue } = usePlayer();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    // The sheet sits over the feed; scrolling the page underneath while it is
    // open would drag the sheet's own backdrop with it and feel broken.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const item = 'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/90 hover:bg-white/[0.07] text-left transition-colors';

  return createPortal(
    <div
      data-feed-card-actions=""
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="menu"
        aria-label="Post actions"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:w-80 sm:rounded-2xl rounded-t-2xl bg-[#0b0e12] border border-white/10 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {title && <p className="px-3.5 pt-2.5 pb-1.5 text-white/40 text-xs truncate">{title}</p>}

        {source && (
          <button
            type="button"
            role="menuitem"
            data-feed-action="play"
            onClick={() => { playNow(source); onClose(); }}
            className={item}
          >
            <Play size={18} className="shrink-0" />
            Open in app
          </button>
        )}

        {source && (
          <button
            type="button"
            role="menuitem"
            data-feed-action="queue"
            onClick={() => { enqueue(source); onClose(); }}
            className={item}
          >
            <ListPlus size={18} className="shrink-0" />
            Add to queue
          </button>
        )}

        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          data-feed-action="open-link"
          onClick={onClose}
          className={item}
        >
          <ExternalLink size={18} className="shrink-0" />
          Open link
        </a>

        <button
          type="button"
          onClick={onClose}
          className={`${item} text-white/45 mt-1 pt-3.5 border-t border-white/[0.06]`}
        >
          <X size={18} className="shrink-0" />
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
