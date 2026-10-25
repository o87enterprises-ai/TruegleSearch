import { useParams, Navigate } from 'react-router-dom';

// /v/<id> — the client half of the SEO watch pages.
//
// functions/_middleware.js renders this route's own title, canonical,
// VideoObject and a real <iframe> at the edge, for the crawler and for
// anyone with JS off. Once React mounts, a human visitor gets Truegle's
// actual player instead — queueing, Radio, the lists sheet — all of which
// /tube?u= already does for any shared link, so this reuses it rather than
// re-implementing playback. See utils/seoPages.js videoPageFor() for where
// the id -> creator/title data this route is built on comes from.
//
// Deliberately not gated to the roster: an id that isn't one of ours still
// opens and plays here (the edge page for it is a plain noindex shell), the
// same way a /w link for a video we never indexed still plays.
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export default function VideoRedirectPage() {
  const { id } = useParams();
  if (!YT_ID.test(id || '')) return <Navigate to="/tube" replace />;
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  return <Navigate to={`/tube?u=${encodeURIComponent(watchUrl)}`} replace />;
}
