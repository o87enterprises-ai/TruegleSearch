const reddit = require('./reddit');

// The provider adapters, behind one shape.
//
// This is the seam. Adding a real provider means writing one file here and
// setting two env vars — no route changes, no client changes. Each adapter is:
//
//   id                          the string the client and the URL use
//   mode                        'demo' | 'live' — what it is ACTUALLY doing,
//                               reported to the client so the UI can say so
//   authorizeUrl({state, callback, back})
//                               where to send the browser. Live points at the
//                               provider; demo points straight back at our own
//                               callback, which is what makes the whole flow
//                               testable end to end with no credentials.
//   exchange({code})            code → connection. Server-side, because the
//                               real version needs a client secret and a
//                               secret that reaches the browser is not one.
//
// ONLY PROVIDERS THAT CAN ACTUALLY WORK ARE LISTED. It is tempting to register
// all six and let them all fall back to a demo adapter, but then
// `/api/social-auth/anything/start` succeeds and the route's 404 is dead code.
// The five that cannot serve a feed are absent here on purpose; the frontend's
// socialProviders.js carries each one's real reason and greys its pill out.

const ADAPTERS = [reddit];

const getProvider = (id) => ADAPTERS.find((a) => a.id === id) || null;

module.exports = { PROVIDERS: ADAPTERS, getProvider };
