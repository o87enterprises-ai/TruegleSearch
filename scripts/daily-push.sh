#!/bin/bash
# Truegle Daily Git Push Script

cd ~/Desktop/TruethTempEigent45-main

echo "📦 Adding changes..."
git add .

echo "💬 Creating commit..."
read -p "Commit message: " message
git commit -m "$message"

echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Done! Check: https://github.com/TruegleAi/TruegleAi"
