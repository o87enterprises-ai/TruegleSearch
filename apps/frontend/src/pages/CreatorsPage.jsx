import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchPageShell from '../components/layout/SearchPageShell';
import SearchBar from '../components/ui/SearchBar';
import CreatorsRoster from '../components/creators/CreatorsRoster';

/*
 * Creators — /creators. The landing spot for the Creators pill.
 *
 * WHY THIS PAGE EXISTS. The roster in content/creators.js already backed ten
 * /creator/:slug pages, but nothing linked to them as a set: you could only
 * reach a creator if you already knew their slug, or if the rotation happened
 * to feature them. The pill needed somewhere to land, and "the list of people
 * we host" is the obvious thing that was missing rather than a new concept
 * invented to fill the slot.
 *
 * It is built on SearchPageShell for the same reason FeedPage is: this repo
 * has already killed five copy-pasted search layouts that drifted apart, and a
 * sixth would drift too. Same background, same logo, same pill row, same bar.
 *
 * The bar FILTERS the roster rather than searching the web — on a page that is
 * a list of ten people, "search" that navigated away would be a trapdoor. Any
 * other pill mode still carries the query off to that mode, matching submit
 * behaviour everywhere else on the site.
 */

export default function CreatorsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pillMode, setPillMode] = useState('yellow');

  // Same contract as every other page: the pill CYCLES, it never navigates.
  // Where a submit goes is decided at submit time.
  const onPill = useCallback((next) => setPillMode(next), []);

  const submit = useCallback(() => {
    const q = query.trim();
    // Yellow is this page, so a submit just leaves the filter applied — the
    // list is already live as you type. Any other mode means the pill was
    // cycled away, and the submit is what carries the query there.
    if (pillMode === 'yellow') return;
    if (pillMode === 'black') { navigate(q ? `/chat?q=${encodeURIComponent(q)}` : '/chat'); return; }
    if (pillMode === 'tube') { navigate(q ? `/tube?q=${encodeURIComponent(q)}` : '/tube'); return; }
    navigate(`/search?mode=${pillMode}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  }, [pillMode, query, navigate]);

  const searchBar = (
    <SearchBar
      value={query}
      showSearchButton={false}
      showBiasedButton={false}
      showUnbiasedButton={false}
      showCategories={false}
      onChange={setQuery}
      onSubmit={submit}
      onSearch={submit}
      placeholder="Filter creators…"
    />
  );

  return (
    <SearchPageShell mode="yellow" pillMode={pillMode} onPillSelect={onPill} pageMode="yellow" query={query} searchBar={searchBar}>
      <div className="max-w-4xl mx-auto">
        <CreatorsRoster query={query} onClearFilter={() => setQuery('')} titleTag="h1" />
      </div>
    </SearchPageShell>
  );
}
