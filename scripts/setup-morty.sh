#!/usr/bin/env bash
#
# setup-morty.sh — stand up the Morty result proxy on the AWS SearXNG host so
# Truegle's "View anonymously" feature works (Startpage-style proxied page views).
#
# Run this ON the EC2 instance that already runs SearXNG. It:
#   1. generates a shared HMAC key (or reuses MORTY_KEY if you export one),
#   2. runs Morty in Docker on port 3000,
#   3. prints the exact settings.yml block + Vercel env vars to paste.
#
# Re-runnable: it replaces any existing `morty` container.
#
# Usage:
#   chmod +x scripts/setup-morty.sh
#   ./scripts/setup-morty.sh                 # bind 127.0.0.1:3000 (put a TLS reverse proxy in front)
#   MORTY_PORT=3000 MORTY_BIND=0.0.0.0 ./scripts/setup-morty.sh
#   MORTY_KEY="$(openssl rand -base64 33)" ./scripts/setup-morty.sh
#
set -euo pipefail

MORTY_IMAGE="${MORTY_IMAGE:-mortyproxy/morty:latest}"
MORTY_PORT="${MORTY_PORT:-3000}"
MORTY_BIND="${MORTY_BIND:-127.0.0.1}"   # keep loopback; terminate TLS at nginx/caddy
MORTY_KEY="${MORTY_KEY:-$(openssl rand -base64 33)}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Install it first (Amazon Linux: 'sudo dnf install -y docker && sudo systemctl enable --now docker')." >&2
  exit 1
fi

echo "==> Pulling ${MORTY_IMAGE}"
# If this image/tag is unavailable in your region, build from source instead:
#   git clone https://github.com/asciimoo/morty && cd morty && docker build -t morty:local .
#   then re-run with MORTY_IMAGE=morty:local
docker pull "${MORTY_IMAGE}"

echo "==> (Re)starting morty container on ${MORTY_BIND}:${MORTY_PORT}"
docker rm -f morty >/dev/null 2>&1 || true
docker run -d \
  --name morty \
  --restart unless-stopped \
  -p "${MORTY_BIND}:${MORTY_PORT}:3000" \
  -e MORTY_KEY="${MORTY_KEY}" \
  -e MORTY_ADDRESS="0.0.0.0:3000" \
  "${MORTY_IMAGE}" \
  -key "${MORTY_KEY}" -listen "0.0.0.0:3000"

echo "==> morty is up. Verify locally:"
echo "    curl -s -o /dev/null -w '%{http_code}\\n' http://${MORTY_BIND}:${MORTY_PORT}/"

cat <<EOF

────────────────────────────────────────────────────────────────────────
NEXT STEPS — wire the key into SearXNG and the Truegle backend.
The SAME base64 key must be used in all three places.

1) SearXNG settings.yml  (then restart the searxng container):

   result_proxy:
     url: https://anon.truegle.info/         # public URL of THIS morty (front it with TLS)
     key: !!binary "${MORTY_KEY}"
   server:
     image_proxy: true                        # also proxy image thumbnails

2) Vercel backend env vars (Project: backend) → then redeploy:

   SEARXNG_RESULT_PROXY_URL = https://anon.truegle.info/
   SEARXNG_RESULT_PROXY_KEY = ${MORTY_KEY}

3) Put a TLS reverse proxy in front of ${MORTY_BIND}:${MORTY_PORT}
   (nginx/caddy) and point anon.truegle.info at it. Don't expose morty
   unauthenticated on a public port without the HMAC key set.

Full docs: docs/ANONYMOUS-VIEW.md
────────────────────────────────────────────────────────────────────────
EOF
