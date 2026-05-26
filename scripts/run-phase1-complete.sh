#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  TRUEGLE - PHASE 1 DATABASE SETUP     ║"
echo "║  Schema + Models + Seeding            ║"
echo "╚════════════════════════════════════════╝"
echo ""

START_TIME=$(date +%s)

# Phase 1.1: Schema Design
echo "📍 Step 1/3: Designing database schema..."
./.eigent/scripts/phase1-database-schema.sh
echo ""

# Phase 1.2: Connection & Models
echo "📍 Step 2/3: Creating database models..."
./.eigent/scripts/phase1-database-models.sh
echo ""

# Phase 1.3: Seed Data
echo "📍 Step 3/3: Generating seed data..."
./.eigent/scripts/phase1-database-seeding.sh
echo ""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "╔════════════════════════════════════════╗"
echo "║  ✅ PHASE 1 COMPLETE                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Duration: ${DURATION} seconds"
echo ""
echo "📄 Generated Files:"
echo "   Database:"
echo "   - backend/migrations/001_initial_schema.sql"
echo "   - backend/src/db/boltClient.js"
echo "   - backend/src/models/User.js"
echo "   - backend/seeds/001_bias_sources.json"
echo ""
echo "📊 Build Catalog Updated:"
echo "   - Tasks 0.100, 0.101, 0.102, 0.103 complete"
echo ""
echo "🎯 Next Steps:"
echo "   1. Review database schema"
echo "   2. Test Bolt Database connection"
echo "   3. Run migrations"
echo "   4. Seed bias sources"
echo "   5. Proceed to Phase 2: API Integration"
echo ""
