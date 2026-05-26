#!/bin/bash
echo "=== Fixing Project Structure ==="
echo ""

cd ~/qwen-experiment-project

echo "1. Creating necessary directories..."
mkdir -p src/pages
mkdir -p src/components/pages

echo "2. Finding all LandingPage files..."
find . -name "*LandingPage*" -type f 2>/dev/null | grep -v node_modules

echo ""
echo "3. Checking current state of src/pages..."
ls -la src/pages/ 2>/dev/null || echo "src/pages doesn't exist yet"

echo ""
echo "4. Copying LandingPage from frontend to src..."
if [ -f "frontend/src/pages/LandingPage.jsx" ]; then
    echo "Found: frontend/src/pages/LandingPage.jsx"
    cp -f "frontend/src/pages/LandingPage.jsx" "src/pages/LandingPage.jsx"
    echo "✅ Copied LandingPage.jsx"
else
    echo "❌ Could not find LandingPage in frontend"
fi

echo ""
echo "5. Verifying copy..."
if [ -f "src/pages/LandingPage.jsx" ]; then
    echo "✅ File exists at: src/pages/LandingPage.jsx"
    echo "   Size: $(wc -l < src/pages/LandingPage.jsx) lines"
else
    echo "❌ Copy failed!"
    echo "Trying alternative: creating the file with Qwen..."
    
    # Create a minimal LandingPage component
    cat > src/pages/LandingPage.jsx << 'LANDING_EOF'
import React from 'react';

const LandingPage = () => {
    return (
        <div style={{ padding: '40px', textAlign: 'center' }}>
            <h1>Landing Page Placeholder</h1>
            <p>This is a temporary landing page created to fix import errors.</p>
            <p>Your actual LandingPage.jsx should be in frontend/src/pages/LandingPage.jsx</p>
            <button onClick={() => alert('Landing page loaded!')}>
                Test Button
            </button>
        </div>
    );
};

export default LandingPage;
LANDING_EOF
    echo "✅ Created placeholder LandingPage.jsx"
fi

echo ""
echo "6. Checking import in App.jsx..."
if grep -q "import LandingPage from './pages/LandingPage'" src/App.jsx; then
    echo "✅ Import statement is correct"
else
    echo "❌ Import statement needs fixing"
    echo "Current import:"
    grep -n "LandingPage" src/App.jsx
fi

echo ""
echo "7. Restarting dev server..."
pkill -f "vite" 2>/dev/null || true
sleep 2
./start-dev.sh &
sleep 5

echo ""
echo "=== Fix Complete ==="
echo "Check: http://localhost:5174"
echo "If still errors, run: pkill -f vite && ./start-dev.sh"
