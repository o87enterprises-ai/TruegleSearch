import { useParams, Link } from 'react-router-dom';
import { getCreator } from '../content/creators';
import UniversalSearch from './UniversalSearch';

/*
 * Creator hub — /creator/:slug.
 *
 * This page used to be its own layout: its own header, its own embed, its own
 * grid of uploads. That made it the seventh copy of the search page shell in
 * this repo, and it had already drifted — different type, different
 * background, a "YouTube ↗" chip that sent people off the site, and none of
 * the player the rest of Truegle is built around.
 *
 * It is now the True Tube page with a creator attached. Same mark, same pill
 * row, same search bar, same one player, same results underneath — so a
 * creator page is on brand by construction instead of being re-matched by hand
 * every time the search layout changes. Everything specific to the creator
 * lives in components/creator/CreatorHeader.jsx.
 *
 * Same architectural call as /tube itself: a MODE of the search page, not a
 * new page. See openspec notes and the /biased, /green precedents in App.jsx.
 */
export default function CreatorPage() {
  const { slug } = useParams();
  const creator = getCreator(slug);

  if (!creator) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <p className="text-white/70 mb-4">Creator not found.</p>
        <Link to="/tube" className="text-sm text-orange-400 hover:text-orange-300">← True Tube</Link>
      </div>
    );
  }

  return <UniversalSearch creator={creator} />;
}
