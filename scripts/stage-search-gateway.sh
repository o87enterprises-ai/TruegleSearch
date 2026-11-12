#!/usr/bin/env bash
# Assemble the Hugging Face Space folder for the search gateway.
#   bash scripts/stage-search-gateway.sh [outdir]      (default /tmp/truegle-search-gateway-space)
# The adapters/pool/app are COPIED from apps/backend/services/openSearch so there is one source of
# truth; run this again whenever they change, then re-upload (see services/search-gateway/README.md).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-/tmp/truegle-search-gateway-space}"
rm -rf "$OUT"
mkdir -p "$OUT/services/openSearch" "$OUT/utils"
cp "$ROOT"/services/search-gateway/{Dockerfile,README.md,server.js,package.json} "$OUT/"
cp "$ROOT"/apps/backend/services/openSearch/*.js "$OUT/services/openSearch/"
# The pool logs provider failures through the backend's winston logger; the Space gets a tiny stand-in
# (no dependency, no request content).
cat > "$OUT/utils/logger.js" <<'JS'
module.exports = {
  warn: (...a) => console.warn(...a),
  info: (...a) => console.log(...a),
  error: (...a) => console.error(...a),
};
JS
echo "staged -> $OUT"
find "$OUT" -type f | sed "s#^$OUT/#  #" | sort
