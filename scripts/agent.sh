#!/bin/bash

# Simple Frontend/Backend Agent Split
# Usage: ./agent.sh [task] [type]

TASK=${1:-"Review the frontend code"}
TYPE=${2:-"frontend"}

echo "=== Agent Task ==="
echo "Task: $TASK"
echo "Type: $TYPE"
echo ""

if [ "$TYPE" = "frontend" ] || [ "$TYPE" = "ui" ] || [ "$TYPE" = "styling" ]; then
    echo "🔄 Using LOCAL Ollama for frontend..."
    echo "Model: codellama:7b"
    echo ""
    
    PROMPT="You are a senior frontend developer specializing in React, Tailwind CSS, and modern web development.

Task: $TASK

Context: This is a Truegle search engine project. Focus on React components, styling, responsive design, UX, and accessibility.

Please analyze the relevant files and provide specific, actionable recommendations."
    
    ollama run codellama:7b "$PROMPT"
    
elif [ "$TYPE" = "backend" ] || [ "$TYPE" = "api" ] || [ "$TYPE" = "server" ]; then
    echo "🤖 Using Claude for backend..."
    echo ""
    echo "Please run: claude"
    echo ""
    echo "Then paste this request:"
    echo ""
    echo "You are a senior backend developer specializing in Node.js, APIs, databases, and server architecture.

Task: $TASK

Context: This is a Truegle search engine backend. Focus on API routes, database queries, authentication, performance, and security.

Please analyze the relevant backend files and provide specific recommendations."
    echo ""
    
else
    echo "Usage:"
    echo "  ./agent.sh 'your task here' frontend   (uses local Ollama)"
    echo "  ./agent.sh 'your task here' backend    (uses Claude)"
    echo ""
    echo "Examples:"
    echo "  ./agent.sh 'Fix responsive issues in SearchResults.jsx' frontend"
    echo "  ./agent.sh 'Optimize the search API endpoint' backend"
fi