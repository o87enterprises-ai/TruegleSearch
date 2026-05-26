#!/bin/bash

echo "🔍 Verifying Truegle Project Structure..."

# Check if main directories exist
echo "Checking main directories..."
if [ -d "apps/frontend" ] && [ -d "apps/backend" ]; then
    echo "✅ Apps directory structure is correct"
else
    echo "❌ Apps directory structure is missing"
    exit 1
fi

# Check frontend structure
echo "Checking frontend structure..."
FRONTEND_DIRS=("components" "pages" "hooks" "services" "utils" "context" "assets" "styles" "types" "config")
for dir in "${FRONTEND_DIRS[@]}"; do
    if [ ! -d "apps/frontend/src/$dir" ]; then
        echo "❌ Frontend src/$dir directory is missing"
        exit 1
    fi
done
echo "✅ Frontend directory structure is correct"

# Check backend structure
echo "Checking backend structure..."
BACKEND_DIRS=("controllers" "models" "routes" "middleware" "services" "utils" "config" "validations")
for dir in "${BACKEND_DIRS[@]}"; do
    if [ ! -d "apps/backend/src/$dir" ]; then
        echo "❌ Backend src/$dir directory is missing"
        exit 1
    fi
done
echo "✅ Backend directory structure is correct"

# Check if config files exist
echo "Checking configuration files..."
if [ -f "apps/frontend/package.json" ] && [ -f "apps/backend/package.json" ]; then
    echo "✅ Package configuration files exist"
else
    echo "❌ Package configuration files are missing"
    exit 1
fi

# Check documentation
echo "Checking documentation structure..."
if [ -d "docs/development" ] && [ -d "docs/api" ] && [ -d "docs/architecture" ]; then
    echo "✅ Documentation structure is correct"
else
    echo "❌ Documentation structure is missing"
    exit 1
fi

echo ""
echo "🎉 All structure verifications passed!"
echo ""
echo "📁 Current Structure Summary:"
echo "   apps/frontend/ - React frontend application"
echo "   apps/backend/ - Express.js backend API"
echo "   docs/ - Project documentation"
echo "   scripts/ - Utility scripts"
echo "   tests/ - Test files"
echo "   docker/ - Docker configurations"
echo ""
echo "🚀 Truegle project is properly organized!"