import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Smartphone, Search, MessageCircle, Copy, Check, ChevronDown } from 'lucide-react';
import { useInstallState, promptInstall, isStandalone } from '../../utils/installPrompt';
import { copyText } from '../../utils/clipboard';

// "Get Truegle one tap away" — install, default search, default assistant.
//
// WHY OUR OWN: the only install prompt anybody saw was the BROWSER's, which
// each browser shows on its own schedule (Chrome once, then silent for about
// three months after a dismissal) and which Safari, Firefox and iOS never show
// at all. This one appears on the landing page for everybody, and is always
// reachable from the menu.
//
// HONEST ABOUT LIMITS. Only Chromium browsers let a page open the real
// installer. No browser lets a site make itself the default search engine,
// and phones only let native apps be the system assistant — so those two are
// the quickest real routes for the browser in hand, with the exact web
// address to paste one tap away. Nothing is sent anywhere.

const DISMISS_KEY = 'truegle_install_dismissed_at';
const REMIND_AFTER_MS = 21 * 24 * 60 * 60 * 1000;
const SEARCH_URL = 'https://truegle.info/search?q=%s';
const CHAT_URL = 'https://truegle.info/chat?q=%s';
export const OPEN_INSTALL_EVENT = 'truegle:open-install';

function detect() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = /iPhone|iPad|iPod/.test(ua)
    || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const samsung = /SamsungBrowser/.test(ua);
  const edge = /Edg(A|iOS)?\//.test(ua);
  const firefox = /Firefox|FxiOS/.test(ua);
  const opera = /OPR\/|Opera/.test(ua);
  const chrome = /Chrome|CriOS/.test(ua) && !edge && !samsung && !opera;
  const safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg|OPR|SamsungBrowser/.test(ua);
  return { ios, android, samsung, edge, firefox, chrome, safari, mobile: ios || android };
}

function homeSteps(b) {
  if (b.ios) return ['Tap the Share button (the square with an arrow).', 'Scroll down and tap “Add to Home Screen”, then “Add”.'];
  if (b.android && b.firefox) return ['Tap the ⋮ menu.', 'Tap “Add to Home screen” (or “Install”).'];
  if (b.android && b.samsung) return ['Tap the ≡ menu.', 'Tap “Add page to” → “Home screen”.'];
  if (b.android) return ['Tap the ⋮ menu.', 'Tap “Add to Home screen” → “Install”.'];
  if (b.safari) return ['In the menu bar choose File → “Add to Dock”.'];
  if (b.firefox) return ['Firefox on a computer can’t install web apps.', 'Pin this tab instead (right-click the tab → “Pin Tab”) or bookmark it.'];
  if (b.edge) return ['Click the ⋯ menu → Apps → “Install this site as an app”.'];
  return ['Click the install icon at the right end of the address bar,', 'or ⋮ menu → “Cast, save, and share” → “Install page as app”.'];
}

function searchSteps(b) {
  if (b.ios || b.safari) return ['Safari only offers its own built-in list of search engines — it doesn’t let any other site be the default.', 'Add Truegle to your Home Screen above for one-tap search instead.'];
  if (b.android && b.firefox) return ['Tap ⋮ → Settings → Search → Default search engine.', 'Tap “Add search engine”, name it Truegle and paste the address below.', 'Save, then choose Truegle.'];
  if (b.android && b.samsung) return ['Tap ≡ → Settings → Search engine and choose Truegle if it’s listed.', 'If it isn’t, install Truegle to your home screen above instead.'];
  if (b.android) return ['Search something on Truegle first (you just did, if you came from a search).', 'Tap ⋮ → Settings → Search engine.', 'Choose truegle.info under “Recently visited”.'];
  if (b.firefox) return ['Right-click the address bar and choose “Add Truegle”.', 'Then open Settings → Search → Default Search Engine → Truegle.'];
  if (b.edge) return ['Open edge://settings/searchEngines (paste it into the address bar).', 'Find Truegle, click ⋯ → “Make default”.', 'Not listed? Click Add: name Truegle, shortcut truegle, and the address below.'];
  return ['Open chrome://settings/searchEngines (paste it into the address bar).', 'Find truegle.info under Site search, click ⋮ → “Make default”.', 'Not listed? Click Add: name Truegle, shortcut truegle, and the address below.'];
}

function assistantSteps(b) {
  const intro = 'Phones only let native apps be the system assistant, so here is the fastest way to reach TrueGLE:';
  if (b.ios) return [intro, 'Open truegle.info/chat, then Share → “Add to Home Screen”. That icon opens straight into chat.'];
  if (b.android) return [intro, 'Install Truegle (above), then long-press its icon → “Chat with TrueGLE” and drag it to your home screen.'];
  if (b.safari) return ['Safari has no custom address-bar shortcuts.', 'Bookmark truegle.info/chat and put it in your Favorites bar.'];
  return ['Add an address-bar shortcut, the same way as the search engine above:', 'Name TrueGLE Chat, shortcut “ask”, and the chat address below.', 'Then type “ask” + your question in the address bar.'];
}

function CopyField({ value, label }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { if (await copyText(value)) { setDone(true); setTimeout(() => setDone(false), 1600); } }}
      className="mt-2 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-black/40 border border-white/10 text-left text-[11px] font-mono text-white/70 hover:border-white/25 transition-colors"
      aria-label={`Copy ${label}`}
    >
      <span className="flex-1 truncate">{value}</span>
      {done ? <Check size={13} className="text-emerald-400 shrink-0" /> : <Copy size={13} className="text-white/40 shrink-0" />}
    </button>
  );
}

function Section({ id, open, onToggle, icon: Icon, title, subtitle, children, accent }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03]">
      <button type="button" onClick={() => onToggle(id)} aria-expanded={open}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
        <span className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${accent}26`, color: accent }}>
          <Icon size={17} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-white">{title}</span>
          <span className="block text-[11px] text-white/45">{subtitle}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="px-3.5 pb-3.5 text-[12px] text-white/70 leading-relaxed">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Steps = ({ items }) => (
  <ol className="space-y-1 list-decimal pl-4 marker:text-white/30">
    {items.map((s) => <li key={s}>{s}</li>)}
  </ol>
);

export default function InstallTruegle() {
  const { pathname } = useLocation();
  const { canPrompt, installed } = useInstallState();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState('home');
  const [result, setResult] = useState('');
  const browser = useMemo(detect, []);

  // Always openable from the menu.
  useEffect(() => {
    const show = () => { setSection('home'); setOpen(true); };
    window.addEventListener(OPEN_INSTALL_EVENT, show);
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, show);
  }, []);

  // Offered by itself once on the landing page, then not again for three
  // weeks after a dismissal. Never inside the installed app. Waits for any
  // other dialog (the tutorial, a sign-in prompt) to be out of the way.
  useEffect(() => {
    if (pathname !== '/' || installed || isStandalone()) return undefined;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (at && Date.now() - at < REMIND_AFTER_MS) return undefined;
    } catch { /* private mode: just offer it */ }
    let tries = 0;
    let t = setTimeout(function attempt() {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]') && tries++ < 12) {
        t = setTimeout(attempt, 5000);
        return;
      }
      setOpen(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [pathname, installed]);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const install = async () => {
    const outcome = await promptInstall();
    setResult(outcome === 'accepted' ? 'Installed — look for Truegle on your home screen.' : outcome === 'dismissed' ? 'No problem — it’s here whenever you want it.' : '');
  };

  const toggle = (id) => setSection((s) => (s === id ? '' : id));

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          data-install-truegle=""
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Get Truegle one tap away"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-md max-h-[88svh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0b0e14] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <button type="button" onClick={close} aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4 pr-8">
              <img src="/truegle.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
              <div>
                <h2 className="text-base font-bold text-white">Get Truegle one tap away</h2>
                <p className="text-[12px] text-white/50">Private, unbiased search — no ads, no tracking.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Section id="home" open={section === 'home'} onToggle={toggle} icon={Smartphone} accent="#22c55e"
                title={browser.mobile ? 'Add to Home Screen' : 'Install Truegle'}
                subtitle={installed ? 'Already installed on this device' : 'Opens like an app, full screen'}>
                {installed ? (
                  <p>Truegle is already installed here. 🎉</p>
                ) : canPrompt ? (
                  <>
                    <p className="mb-2">Your browser can install Truegle in one tap.</p>
                    <button type="button" data-install-now="" onClick={install}
                      className="w-full py-2.5 rounded-lg bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 transition-colors">
                      {browser.mobile ? 'Add to Home Screen' : 'Install Truegle'}
                    </button>
                  </>
                ) : (
                  <Steps items={homeSteps(browser)} />
                )}
                {result && <p className="mt-2 text-emerald-300">{result}</p>}
              </Section>

              <Section id="search" open={section === 'search'} onToggle={toggle} icon={Search} accent="#3b82f6"
                title="Make Truegle your default search" subtitle="Searches from the address bar go to Truegle">
                <Steps items={searchSteps(browser)} />
                {!(browser.ios || browser.safari) && <CopyField value={SEARCH_URL} label="the Truegle search address" />}
              </Section>

              <Section id="assistant" open={section === 'assistant'} onToggle={toggle} icon={MessageCircle} accent="#a855f7"
                title="Make TrueGLE your assistant" subtitle="Ask the AI from anywhere, in one tap">
                <Steps items={assistantSteps(browser)} />
                {!browser.mobile && !browser.safari && <CopyField value={CHAT_URL} label="the TrueGLE chat address" />}
              </Section>
            </div>

            <button type="button" onClick={close}
              className="mt-4 w-full py-2 text-xs text-white/40 hover:text-white/70">
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
