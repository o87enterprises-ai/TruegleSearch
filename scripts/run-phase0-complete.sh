#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  TRUEGLE - PHASE 0 & 0.5 EXECUTION    ║"
echo "║  Security + Legal + Financial         ║"
echo "╚════════════════════════════════════════╝"
echo ""

START_TIME=$(date +%s)

# Phase 0: Security
echo "📍 Starting Phase 0: Security Remediation..."
./.eigent/scripts/phase0-security-audit.sh
echo ""

# Phase 0.5: Legal
echo "📍 Starting Phase 0.5a: Legal Foundation..."
./.eigent/scripts/phase0.5-legal-setup.sh
echo ""

# Phase 0.5: Financial
echo "📍 Starting Phase 0.5b: Financial Optimization..."
./.eigent/scripts/phase0.5-financial-setup.sh
echo ""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "╔════════════════════════════════════════╗"
echo "║  ✅ PHASE 0 & 0.5 COMPLETE            ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Duration: ${DURATION} seconds"
echo ""
echo "📄 Generated Documents:"
echo "   Security:"
echo "   - .eigent/reports/security-audit-report.md"
echo ""
echo "   Legal:"
echo "   - .eigent/legal/trademark-analysis.md"
echo "   - .eigent/legal/corporate-formation-guide.md"
echo "   - .eigent/legal/terms-of-service-draft.md"
echo ""
echo "   Financial:"
echo "   - .eigent/financial/tax-optimization-guide.md"
echo "   - .eigent/financial/financial-model-formulas.md"
echo ""
echo "📊 Build Catalog:"
echo "   - TRUEGLE_BUILD_CATALOG.md (updated)"
echo ""
echo "🎯 Next Steps:"
echo "   1. Review security audit report"
echo "   2. Review legal documents (attorney review recommended)"
echo "   3. Review financial model"
echo "   4. Proceed to Phase 1: Database Setup"
echo ""
