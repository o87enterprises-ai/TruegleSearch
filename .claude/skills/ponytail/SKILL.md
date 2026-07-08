---
name: ponytail
description: Truegle engineering principles. Apply whenever writing, reviewing, or shipping code in this repo — defines verification standards, root-cause discipline, session hygiene, and hard-won rules from past incidents.
---

# Ponytail — Truegle Engineering Principles

The senior-engineer voice on the team. Every line of code shipped to Truegle
follows these principles.

## Core principles

1. **Boot it, don't just check it.** `node --check` passing is not verification. A past attribution-header change 500'd every backend route because it was never booted. Start the server, hit the route, watch the browser console before calling anything done.
2. **Root cause, not symptom.** Truegle's history is full of symptom-chasing (blog canonicals, animation loops, OAuth redirects) that only ended when the actual root cause was found (`_redirects` rewrite precedence, useEffect deps, `VERCEL_URL` instability). Keep digging until the explanation predicts the symptom exactly.
3. **Respect PERMANENT FACTS.** `HANDOFF.md` records dead ends in red (Adsterra API is inaccessible; banner anti-adblock codes don't exist; the adult toggle can't be disabled; Impact.com is closed until 50K/mo traffic). Never re-litigate them, never re-ask the user.
4. **Free first.** Prefer the free/self-hosted path (SearXNG before paid APIs, Cloudflare free tier, WARP over paid proxies). Paid APIs are graceful supplements, never hard dependencies — the app must degrade gracefully when a key is missing.
5. **Ship small, ship on main-ready branches.** New branch per session (see `tech` skill). Every commit message says what and why. No giant mixed commits.

## Repo-specific hard rules (learned the expensive way)

- **Never add a prerendered route to `_redirects`.** A 200 rewrite beats directory-index lookup on Cloudflare Pages — it will serve the SPA shell over your static file. Only pure client-side routes go in `_redirects`.
- **Every route in `_redirects` needs a matching `_headers` entry** (`Content-Type: text/html`), or Cloudflare serves it as an octet-stream download. `_headers` matches the *original* URL, not the rewrite target.
- **HTTP header values must be ASCII.** Non-ASCII (em-dashes) in `res.setHeader` throws `ERR_INVALID_CHAR` and takes down every route. Guard header writes with try/catch.
- **Keep `package-lock.json` in sync.** A desynced lockfile silently kills Cloudflare's `npm ci` build and auto-deploy.
- **Animation components:** never put animation-phase state in useEffect dependency arrays; use refs for animation parameters; always include a WebGL capability check + CSS fallback before enabling WebGL backgrounds.
- **CSP is strict.** Any new inline script needs its sha256 hash added to `_headers`; any new third-party domain needs `script-src`/`frame-src`/`connect-src` entries. Test in the browser console after deploy.
- **Backend URL config:** use `import.meta.env.VITE_BACKEND_URL` (frontend) and `VERCEL_PROJECT_PRODUCTION_URL` fallback (backend). Never `VERCEL_URL` — it changes per deployment.
- **`UniversalSearch.jsx` is the live results page.** `components/SearchResults.jsx` is dead code. Check which component actually renders a route before editing.
- **Clean up `.backup`/`.old` files** rather than adding more — the pages directory is already littered; don't make it worse.

## Definition of done

- Runs locally (`npm run dev`) with no new console errors
- Verified end-to-end in the browser (the actual user flow, not just the unit)
- Lint passes (`npm run lint`)
- CSP/`_headers`/`_redirects` updated if routes or third-party scripts changed
- `HANDOFF.md` session log updated (see `tech` skill)
- No secrets committed; keys go in env vars / the secrets store
