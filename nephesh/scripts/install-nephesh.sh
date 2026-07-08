#!/usr/bin/env bash
# install-nephesh.sh — Step 1: install Ollama on the EC2 host, verify the
# local API, pull the base model. Linux port of install-nullprime.ps1.
#
# Usage:  ./install-nephesh.sh [base-model]     # default: qwen3:8b
set -euo pipefail

BASE="${1:-qwen3:8b}"

echo "[1/3] Checking for Ollama..."
if command -v ollama >/dev/null 2>&1; then
  echo "  Already installed: $(ollama --version)"
else
  echo "  Installing via official script..."
  curl -fsSL https://ollama.com/install.sh | sh
  command -v ollama >/dev/null 2>&1 || { echo "  'ollama' not on PATH after install — open a new shell and re-run."; exit 1; }
fi

echo "[2/3] Checking local API (localhost:11434)..."
if curl -sf --max-time 5 http://localhost:11434/api/tags >/dev/null; then
  echo "  API is up."
else
  echo "  Starting the service..."
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files ollama.service >/dev/null 2>&1; then
    sudo systemctl enable --now ollama
  else
    nohup ollama serve >/tmp/ollama.log 2>&1 &
  fi
  sleep 3
  curl -sf --max-time 5 http://localhost:11434/api/tags >/dev/null \
    || { echo "  Can't reach API. Check 'journalctl -u ollama' or /tmp/ollama.log, then re-run."; exit 1; }
  echo "  API is up."
fi

# Memory sanity check before a multi-GB pull
AVAIL_GB=$(awk '/MemAvailable/ {printf "%.1f", $2/1048576}' /proc/meminfo)
echo "  Available RAM: ${AVAIL_GB} GB (qwen3:8b needs ~5.5, phi4-mini-reasoning ~3, llama3.2 ~2)"

echo "[3/3] Pulling base model: $BASE (first pull may be several GB)..."
ollama pull "$BASE"
echo "Done. Next: ./create-nephesh.sh $BASE"
