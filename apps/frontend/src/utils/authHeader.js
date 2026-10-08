// The signed-in user's token as an Authorization header, for the fetch()
// calls that bypass the axios instance (services/api.js adds it there).
//
// Owner, 2026-10-08: "the safe search isn't remembering". The search requests
// were sent WITHOUT the sign-in, so the server (routes/search.js) saw every
// search as signed out and forced Safe Search back to Strict — "off" never
// reached it, and 18+ searches came back as Strict junk.
export function authHeader() {
  try {
    const t = localStorage.getItem('truegle_token');
    return t && !t.startsWith('guest_') ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

// The visitor's Safe Search choice, for searches made outside the Settings
// context (the player's own search box). The server still checks the sign-in.
export function storedSafeSearch() {
  try {
    const v = JSON.parse(localStorage.getItem('truegle_settings') || '{}').safeSearch;
    return ['safe', 'blur', 'off'].includes(v) ? v : 'safe';
  } catch {
    return 'safe';
  }
}

export default authHeader;
