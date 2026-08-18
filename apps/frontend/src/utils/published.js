// When a thing was published, said the way a person would say it.
//
// THE HARD PART IS NOT THE FORMATTING, IT IS KNOWING. The search backend used
// to stamp `new Date().toISOString()` on every result whose provider gave no
// publish date — which, on SearXNG, is most of them — so "we don't know when"
// arrived indistinguishable from "an hour ago". Printing that would have put
// today's date on a video from 2019, which is worse than the blank space it
// replaced, and it also had undated results scoring maximum recency in the
// ranker. SearchService now returns null, and everything here treats null as
// null: no date is not a date.
//
// The suspicious-value guards below are the second half of that. A timestamp
// in the future, or one from before the web, is a parsing accident rather than
// a fact about a video, and rendering it confidently would just move the lie
// one layer up.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEB_EPOCH = Date.UTC(1995, 0, 1);

/**
 * Parse a publish date, or null if there isn't a believable one.
 * @param {string|number|Date|null|undefined} value
 * @returns {number|null} epoch ms
 */
export function publishedAt(value) {
  if (value === null || value === undefined || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  // A minute of slack: clock skew between us and a provider is ordinary, a
  // video published next year is not.
  if (ms > Date.now() + MINUTE) return null;
  if (ms < WEB_EPOCH) return null;
  return ms;
}

/**
 * "3 days ago" · "Mar 2024" · null.
 *
 * Relative while that is the useful reading, absolute once it isn't — nobody
 * benefits from "847 days ago".
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {string|null}
 */
export function publishedLabel(value) {
  const ms = publishedAt(value);
  if (ms === null) return null;
  const age = Date.now() - ms;

  if (age < HOUR) {
    const mins = Math.max(1, Math.round(age / MINUTE));
    return mins === 1 ? '1 min ago' : `${mins} mins ago`;
  }
  if (age < DAY) {
    const hours = Math.round(age / HOUR);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  if (age < 7 * DAY) {
    const days = Math.round(age / DAY);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }
  if (age < 365 * DAY) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** Sort comparator: newest first, undated last in either direction. */
export function byNewest(a, b) {
  const av = publishedAt(a?.published);
  const bv = publishedAt(b?.published);
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return bv - av;
}
