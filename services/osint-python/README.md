---
title: Truegle OSINT
emoji: 🔎
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Truegle OSINT service

The Python-only half of Truegle's OSINT toolkit. See
`docs/OSINT-SERVICE-PLAN.md` in the main repo for why it exists and what it
deliberately does not do.

## Deploy

1. Create a **private** Space at https://huggingface.co/new-space, SDK **Docker**.
2. Push the contents of this directory to it (this README's frontmatter is what
   tells Spaces to build the Dockerfile and expose port 7860).
3. Space → **Settings → Variables and secrets** → add secret
   `OSINT_SERVICE_TOKEN` with a long random value.

The service **refuses to start serving** without that token rather than run as
an open OSINT API on a public URL.

## Verify

```bash
TOKEN=...   SPACE=https://<user>-<space>.hf.space

curl -s -H "Authorization: Bearer $TOKEN" $SPACE/health

# Offline, instant, and strictly more than the Node side can produce —
# the right first call to prove the wiring without waiting on any upstream.
curl -s -X POST $SPACE/phone \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"phone":"5416230460","region":"US"}'
```

`/health` reports which libraries actually imported, so a partial build is
visible immediately instead of surfacing later as an empty result.

## Notes

- Free Spaces sleep after extended inactivity — expect a cold start on the
  first call. Never put this on a user's critical path.
- Every endpoint takes `budget_ms` and returns `partial: true` rather than
  running past it.
- A well-formed request that fails upstream returns HTTP 200 with
  `ok: false`, so the Node caller can treat it as one more settled promise.
