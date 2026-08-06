import { useEffect, useState } from 'react';

// True while the visitor is typing into something that ISN'T the player.
//
// The floating/footer player is a fixed element pinned to the bottom of the
// screen, and on a phone the keyboard pushes it straight up onto the page's own
// search bar — so the one thing you were trying to use disappears behind the
// player, along with its suggestions dropdown. Hiding by hand every time is not
// a fix; the player getting out of the way on its own is.
//
// Deliberately scoped to text entry. Pressing an ordinary button shouldn't
// retract the player.
const TEXTLESS = new Set([
  'button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file', 'image',
]);

const isTextEntry = (el) => {
  if (!el || el.closest?.('[data-mini]')) return false;   // the player's own bar
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !TEXTLESS.has(String(el.type || 'text').toLowerCase());
};

export function usePageInputFocus() {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const sync = () => setFocused(isTextEntry(document.activeElement));
    // focusout fires BEFORE the next focusin, so tabbing between two fields
    // would flicker the player back and shove the layout around mid-type.
    // Re-reading activeElement on the next tick settles it.
    const later = () => setTimeout(sync, 0);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', later);
    sync();
    return () => {
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', later);
    };
  }, []);

  return focused;
}

export default usePageInputFocus;
