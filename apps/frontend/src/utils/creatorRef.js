import api from '../services/api';

/*
 * Record a creator-referral hit (for the featured-creator rotation + future
 * revenue-share). Deduped once per session per code. Also stores a last-touch
 * `truegle_ref` so a later conversion can be attributed. All failures are
 * swallowed — attribution is best-effort and never blocks the UI.
 */
export function recordRef(code) {
  if (!code || !/^[a-z0-9-]{2,40}$/.test(code)) return;
  const key = `truegle_ref_sent_${code}`;
  try {
    localStorage.setItem('truegle_ref', code);
    if (sessionStorage.getItem(key)) return; // already counted this session
    sessionStorage.setItem(key, '1');
  } catch {
    // storage disabled (private mode) — still fire the beacon below
  }
  api.post(`/creators/ref/${code}`).catch(() => {});
}
