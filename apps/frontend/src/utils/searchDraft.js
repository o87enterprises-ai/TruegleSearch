// WHAT IS IN THE SEARCH BOX, carried from page to page.
//
// Owner, 2026-10-01: "the search bar needs to carry state from one page to the
// next (it drops state upon page switch)". Every page owned its own box, so
// moving Landing → Chat → Tube → Feed emptied it each time and the query had to
// be typed again.
//
// IN MEMORY ONLY, on purpose. It survives moving around the app (a switch is a
// route change inside the same page load) and is gone on a reload, a new tab
// or a fresh visit — nobody should come back tomorrow to find yesterday's
// half-typed query waiting, and nothing here is ever written to disk.
let draft = '';

export const getDraft = () => draft;
export const setDraft = (text) => { draft = String(text || '').slice(0, 2000); };
