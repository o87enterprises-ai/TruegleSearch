#!/usr/bin/env bash
# Truegle SessionStart hook — everything the agent should "know" before acting,
# injected into context automatically at the start of every session.
#
# Edit this to add/remove what auto-loads. It runs from the repo root.
# Keep it fast and failure-tolerant: a missing file must never break startup.
set +e
cd "$(dirname "$0")/.." 2>/dev/null || true

echo 'Truegle company skills ACTIVE (ponytail/tech/financial/design auto-apply). Default terse.'
echo

# 1. Persistent agent memory (facts / decisions / open threads).
node .claude/memory/mem.mjs digest 2>/dev/null \
  || echo '(agent memory unavailable — read HANDOFF.md top + CLAUDE.md PERMANENT FACTS before acting)'

# 2. Always-in-force company skills, loaded in full so their rules are active
#    without waiting to be invoked. Trim this list to save tokens if desired.
for skill in ponytail executive-summary; do
  f=".claude/skills/${skill}/SKILL.md"
  if [ -f "$f" ]; then
    echo
    echo "===== /${skill} (auto-loaded, always in force) ====="
    cat "$f"
  fi
done
