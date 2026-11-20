import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BOOK, search, blocks, toPlainText, printAsPdf, download } from '../utils/encyclopedia';
import TruegleLogo from './ui/TruegleLogo';
import TruegleSearchField from './ui/TruegleSearchField';

// The Survivor's Encyclopedia, on screen.
//
// The reading area is deliberately plain: no animation, no gradients, a
// readable measure. This is a reference somebody might be reading by torchlight
// with one hand, and the design brief for that is "get out of the way". Only the
// header wears the Truegle brand (logo + search field); the book itself does not.
//
// SAVE A COPY is the most important control on the page, which is why it is
// not hidden behind a menu. Reading it here needs Truegle to be reachable;
// the file does not.

const cx = (...c) => c.filter(Boolean).join(' ');

function Body({ md }) {
  // The source is ours, the renderer is thirty lines and emits only <p>, <ol>,
  // <ul>, <li>, <strong> and <em>. dangerouslySetInnerHTML is safe here in the
  // way it is almost never safe: there is no user input anywhere in the chain.
  const html = useMemo(() => blocks(md), [md]);
  return (
    <div
      className="prose-vault text-[15px] leading-relaxed text-white/80"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const Encyclopedia = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState('');
  const scroller = useRef(null);

  const results = useMemo(() => (query.trim().length > 1 ? search(query) : null), [query]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const jump = (letter) => {
    const el = document.getElementById(`vault-L${letter}`);
    if (el && scroller.current) scroller.current.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
  };

  const save = async (kind) => {
    let ok = false;
    try {
      ok = kind === 'pdf'
        ? await printAsPdf()
        : await download('survivors-encyclopedia.txt', toPlainText(), 'text/plain;charset=utf-8');
    } catch { setSaved('failed'); setTimeout(() => setSaved(''), 5000); return; }
    if (!ok) return; // picker closed without saving: say nothing
    setSaved(kind);
    setTimeout(() => setSaved(''), 4000);
  };

  const article = (e) => (
    <article key={e.id} id={`vault-${e.id}`} className="border-t border-white/10 py-4">
      <h3 className="text-white font-semibold text-[15px] mb-1">{e.title}</h3>
      {e.seeAlso ? (
        <p className="text-white/45 text-sm italic">See {e.seeAlso.replace(/\*/g, '')}</p>
      ) : (
        <Body md={e.body} />
      )}
    </article>
  );

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-[#0d0f12] text-white/80 flex flex-col">
      <style>{`
        .prose-vault p { margin: .45rem 0; }
        .prose-vault ol, .prose-vault ul { margin: .45rem 0; padding-left: 1.35rem; }
        .prose-vault ol { list-style: decimal; }
        .prose-vault ul { list-style: disc; }
        .prose-vault li { margin: .25rem 0; }
        .prose-vault strong { color: #fff; font-weight: 600; }
        .prose-vault em { color: rgba(255,255,255,.6); }
        .prose-vault .tbl { overflow-x: auto; margin: .7rem 0; }
        .prose-vault table { border-collapse: collapse; font-size: 13px; min-width: 100%; }
        .prose-vault th, .prose-vault td { border: 1px solid rgba(255,255,255,.12); padding: .3rem .5rem; text-align: left; vertical-align: top; }
        .prose-vault th { background: rgba(255,255,255,.06); color: #fff; font-weight: 600; }
      `}</style>

      <header className="flex-none border-b border-white/10 px-4 pt-4 pb-3 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            {/* The Truegle mark, as on every other page. Tapping it leaves the
                book (same as ×) rather than the default jump to '/', so on the
                offline 404 it returns to that page instead of a dead home. */}
            <TruegleLogo size="medium" animated className="-my-3" onClick={onClose} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close the encyclopedia"
              className="text-white/40 hover:text-white text-2xl leading-none px-2"
            >
              ×
            </button>
          </div>

          <h1 className="text-white text-lg font-bold tracking-tight mt-2">{BOOK.title}</h1>
          <p className="text-white/40 text-[11px] font-mono tracking-wider mt-0.5">
            {BOOK.entries.length} ENTRIES · WORKS WITHOUT US
          </p>

          <TruegleSearchField
            className="mt-3"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — water, fire, snare, solar…"
            ariaLabel="Search the encyclopedia"
          />

          {!results && (
            <div className="mt-2 flex flex-wrap gap-0.5">
              {BOOK.letters.map((l) => (
                <button
                  key={l.letter}
                  type="button"
                  onClick={() => jump(l.letter)}
                  className="min-w-[1.5rem] px-1 py-0.5 font-mono text-xs font-bold
                             text-emerald-300/70 hover:text-emerald-200"
                >
                  {l.letter}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto pb-24">
          {results ? (
            <>
              <p className="text-white/40 text-xs font-mono tracking-wider py-3">
                {results.length} {results.length === 1 ? 'ENTRY' : 'ENTRIES'}
              </p>
              {results.length === 0 && (
                <p className="text-white/50 text-sm py-6">
                  Nothing under that word. Try a plainer one — “water”, “fire”, “meat”, “rope”.
                </p>
              )}
              {results.map(article)}
            </>
          ) : (
            <>
              <p className="text-white/50 text-sm italic py-4 border-b border-white/10">
                {BOOK.intro.replace(/\*/g, '').split('\n').filter(Boolean).slice(-1)[0]}
              </p>
              {BOOK.letters.map((l) => (
                <section key={l.letter} id={`vault-L${l.letter}`}>
                  <h2 className="font-mono text-emerald-300 text-xl font-bold pt-7 pb-1">
                    {l.letter}{l.title ? <span className="text-emerald-300/70 text-base font-semibold"> — {l.title}</span> : null}
                  </h2>
                  {l.entries.map(article)}
                </section>
              ))}
              <p className="text-white/40 text-sm italic pt-8">{BOOK.outro.replace(/\*/g, '')}</p>
            </>
          )}
        </div>
      </div>

      {/* The point of the whole thing. A copy on your own disk needs no
          Truegle, no network and no browser cache that a phone can evict. */}
      <footer className="flex-none border-t border-white/10 bg-[#0d0f12] px-4 py-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2">
          <span className="text-white/40 text-[11px] font-mono tracking-wider mr-1">
            {saved === 'failed' ? 'COULD NOT SAVE — TRY THE OTHER BUTTON'
              : saved ? 'SAVED — KEEP IT SOMEWHERE OFFLINE' : 'TAKE A COPY:'}
          </span>
          <button
            type="button"
            onClick={() => save('pdf')}
            className={cx('px-3 py-1.5 rounded-md text-xs font-bold transition-colors',
              saved === 'pdf' ? 'bg-emerald-400 text-black' : 'bg-white text-black hover:bg-white/90')}
          >
            {saved === 'pdf' ? '✓ PDF' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={() => save('txt')}
            className={cx('px-3 py-1.5 rounded-md text-xs font-bold border transition-colors',
              saved === 'txt' ? 'border-emerald-400 text-emerald-300' : 'border-white/20 text-white/70 hover:text-white')}
          >
            {saved === 'txt' ? '✓ TEXT FILE' : 'TEXT FILE'}
          </button>
          <span className="text-white/25 text-[11px] ml-auto hidden sm:inline">
            One file, no network needed.
          </span>
        </div>
      </footer>
    </div>,
    document.body,
  );
};

export default Encyclopedia;
