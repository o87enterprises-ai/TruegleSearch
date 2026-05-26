#!/bin/bash

echo "🔒 Starting Security Audit (Memory-Safe Mode)"
echo "============================================="

# Use 8B model (safe for 8GB RAM)
ollama run llama3.1:8b << 'PROMPT'
Perform security audit on Truegle project at /Users/ducke.duck/Desktop/TruethTempEigent45-main

Focus on:
1. Find exposed API keys in .env files
2. Check for hardcoded credentials
3. Review authentication code
4. Identify top 5 critical security issues

Keep response under 500 words.
PROMPT

