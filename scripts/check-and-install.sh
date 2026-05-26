#!/bin/bash
echo "=== Checking and Installing Dependencies ==="
cd ~/qwen-experiment-project

echo "1. Installing critical missing packages..."
CRITICAL_PACKAGES="lucide-react framer-motion react-router-dom tailwind-merge clsx"
for pkg in $CRITICAL_PACKAGES; do
    echo "Checking $pkg..."
    if npm list $pkg 2>/dev/null | grep -q $pkg; then
        echo "  ✅ Already installed"
    else
        echo "  ⬇️  Installing $pkg..."
        npm install $pkg
    fi
done

echo ""
echo "2. Checking for Tailwind CSS setup..."
if [ ! -f "tailwind.config.js" ] && [ -f "frontend/tailwind.config.js" ]; then
    cp frontend/tailwind.config.js .
    echo "  ✅ Copied tailwind.config.js"
fi

if [ ! -f "postcss.config.js" ] && [ -f "frontend/postcss.config.js" ]; then
    cp frontend/postcss.config.js .
    echo "  ✅ Copied postcss.config.js"
fi

echo ""
echo "3. Installing Tailwind CSS if needed..."
if ! npm list tailwindcss 2>/dev/null | grep -q tailwindcss; then
    echo "  ⬇️  Installing tailwindcss..."
    npm install -D tailwindcss postcss autoprefixer
fi

echo ""
echo "4. Creating missing utility file..."
if [ ! -f "src/utils/cn.js" ] && [ -f "frontend/src/utils/cn.js" ]; then
    mkdir -p src/utils
    cp frontend/src/utils/cn.js src/utils/
    echo "  ✅ Copied cn.js utility"
fi

echo ""
echo "5. Starting dev server..."
pkill -f "vite" 2>/dev/null
sleep 2
./start-dev.sh
