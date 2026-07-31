// Compact human time helpers shared by the persistent page clock and the
// per-message chat timestamps. Kept tiny and dependency-free (Intl only).

// Short stamp for a message: "3:42 PM" if today, else "Jul 31 · 3:42 PM".
export const fmtStamp = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
};

// Full, unambiguous stamp for hover/title — includes date, time, and locale TZ.
export const fmtStampFull = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

// A message's effective time: explicit createdAt, else fall back to the id when
// it looks like a Date.now() millisecond stamp (legacy threads carry no
// createdAt but their ids are Date.now()). Welcome message (id:1) → null.
export const msgTime = (m) =>
  m?.createdAt || (typeof m?.id === 'number' && m.id > 1e12 ? m.id : null);
