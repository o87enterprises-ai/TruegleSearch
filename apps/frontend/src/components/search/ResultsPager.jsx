// Google-style page numbers: ‹ Previous  1 2 3 … 9  Next ›
//
// Paging is done on the results already fetched — no extra request per page —
// so turning a page is instant and costs nothing.
export default function ResultsPager({ page, pageCount, onPage, accent }) {
  if (pageCount <= 1) return null;

  // Show the first, last and up to two either side of the current page.
  const pages = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 2) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  const btn = 'min-w-[2rem] h-8 px-2 rounded-lg text-sm transition-colors';
  return (
    <nav aria-label="Result pages" className="flex items-center justify-center gap-1 mt-8 select-none">
      {page > 1 && (
        <button type="button" onClick={() => onPage(page - 1)} className={`${btn} text-white/70 hover:bg-white/10`}>
          ‹ Previous
        </button>
      )}
      {pages.map((p, i) => (p === '…'
        ? <span key={`gap-${i}`} className="px-1 text-white/30">…</span>
        : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? 'page' : undefined}
            className={`${btn} ${p === page ? `bg-white/15 text-white font-semibold ${accent?.link || ''}` : 'text-white/60 hover:bg-white/10'}`}
          >
            {p}
          </button>
        )))}
      {page < pageCount && (
        <button type="button" onClick={() => onPage(page + 1)} className={`${btn} text-white/70 hover:bg-white/10`}>
          Next ›
        </button>
      )}
    </nav>
  );
}
