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

# 2. ponytail — engineering discipline, loaded IN FULL (actionable every session).
if [ -f ".claude/skills/ponytail/SKILL.md" ]; then
  echo
  echo "===== /ponytail (auto-loaded, always in force) ====="
  cat ".claude/skills/ponytail/SKILL.md"
fi

# 3. executive-summary — only the Mission + Values top (rarely changes; the rest
#    is on-demand via /executive-summary). Prints up to the first '## ' section
#    after Values, i.e. stops before '## Product blueprint'.
if [ -f ".claude/skills/executive-summary/SKILL.md" ]; then
  echo
  echo "===== /executive-summary — Mission & Values (rest: run /executive-summary) ====="
  awk '/^## Product blueprint/{exit} {print}' ".claude/skills/executive-summary/SKILL.md"
fi
