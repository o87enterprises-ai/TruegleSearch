#!/bin/bash

echo "🚀 LAUNCHING TRUEGLE EIGENT WORKFLOWS"
echo "======================================"
echo ""

# Check if Eigent server is running
if ! curl -s http://localhost:5174/health > /dev/null; then
    echo "❌ Eigent server not running!"
    echo "Please start it with: cd ~/Development/eigent && npm run dev"
    exit 1
fi

echo "✅ Eigent server detected"
echo ""

# Launch Phase 0: Security Remediation
echo "🔒 Launching Phase 0: Security Remediation..."
curl -X POST http://localhost:5174/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d @.eigent/workflows/phase0-security-remediation.json

echo ""
echo ""

# Launch Phase 0.5: Legal & Financial (parallel)
echo "⚖️  Launching Phase 0.5: Legal & Financial Foundation..."
curl -X POST http://localhost:5174/api/workflows/execute \
  -H "Content-Type: application/json" \
  -d @.eigent/workflows/phase0.5-legal-financial.json

echo ""
echo ""
echo "======================================"
echo "✅ WORKFLOWS LAUNCHED"
echo "======================================"
echo ""
echo "Monitor progress at: http://localhost:5174"
echo "Check logs in: .eigent/logs/"
echo "Reports will be in: .eigent/reports/"
echo ""
