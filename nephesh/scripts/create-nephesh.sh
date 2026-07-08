#!/usr/bin/env bash
# create-nephesh.sh — build nephesh:1.3 from the repo Modelfile with a
# swappable reasoning base. Linux port of create-nullprime.ps1 (v3.1).
#
# Usage:
#   ./create-nephesh.sh                        # default base: qwen3:8b
#   ./create-nephesh.sh phi4-mini-reasoning    # comfortable fallback
#   ./create-nephesh.sh llama3.2               # small-host fallback (~2 GB)
set -euo pipefail

BASE="${1:-qwen3:8b}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELFILE="$HERE/../Modelfile"

[ -f "$MODELFILE" ] || { echo "Modelfile not found at $MODELFILE"; exit 1; }

curl -sf --max-time 5 http://localhost:11434/api/tags >/dev/null \
  || { echo "Ollama API not reachable. Run ./install-nephesh.sh first."; exit 1; }

echo "Pulling base model: $BASE (first pull may be several GB)..."
ollama pull "$BASE"

# Substitute the base at build time, exactly like the -Base parameter in v3.1.
TMP="$(mktemp /tmp/nephesh-modelfile.XXXXXX)"
sed "s|^FROM .*|FROM $BASE|" "$MODELFILE" > "$TMP"

ollama rm nephesh:1.3 2>/dev/null || true

echo "Building nephesh:1.3 on $BASE ..."
ollama create nephesh:1.3 -f "$TMP"
rm -f "$TMP"

if ollama list | grep -q "nephesh:1.3"; then
  echo "Built. Smoke-test the audit protocol, one claim per prompt:"
  echo '  ollama run nephesh:1.3 "Dark matter exists. Audit both sides."'
  echo '  ollama run nephesh:1.3 "A psi field mediates telepathy. Audit both sides."'
  echo '  ollama run nephesh:1.3 "Abiogenesis occurred: life arose from non-life. Audit both sides."'
  echo '  ollama run nephesh:1.3 "A lost ancient civilization possessed advanced technology. Audit both sides."'
  echo "Then run the promotion gate from the repo:"
  echo '  NEPHESH_BASE_URL=http://localhost:11434 node nephesh/eval/run-eval.mjs'
else
  echo "Build didn't register — check the output above."
  exit 1
fi
