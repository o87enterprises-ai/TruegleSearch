import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Persistent, see-through digital clock pinned to the top-right of every page.
// Immovable (position: fixed) and non-interfering (pointer-events: none) so it
// never blocks a click — it only displays the local time + date. The dark
// translucent chip + backdrop-blur keeps it legible over any background
// (including the amber pre-production banner behind it).
const HIDDEN = new Set(['/auth/login', '/auth/signup']);

export default function PageClock() {
  const [now, setNow] = useState(() => new Date());
  const { pathname } = useLocation();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (HIDDEN.has(pathname)) return null;

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div
      aria-hidden="true"
      className="fixed top-3 right-3 z-[9997] pointer-events-none select-none flex flex-col items-end leading-none rounded-lg px-2.5 py-1.5 bg-black/25 border border-white/10 backdrop-blur-md shadow-lg"
    >
      <span className="font-mono tabular-nums text-[13px] font-semibold text-white/80 tracking-tight">{time}</span>
      <span className="font-mono text-[9px] uppercase tracking-wider text-white/40 mt-0.5">{date}</span>
    </div>
  );
}
