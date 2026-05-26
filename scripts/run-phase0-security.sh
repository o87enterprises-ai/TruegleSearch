#!/bin/bash

echo "🔒 Starting Phase 0: Security Audit"
echo "===================================="

# Task 0.001: Security Audit
ollama run llama3.3:70b-instruct-q4_K_M << 'PROMPT'
You are a Security Architect specializing in web application security.

MISSION: Perform comprehensive security audit on the Truegle project.

PROJECT LOCATION: /Users/ducke.duck/Desktop/TruethTempEigent45-main

TASKS:
1. Scan entire codebase for exposed API keys and credentials
2. Search for patterns: API_KEY, SECRET, TOKEN, PASSWORD, STRIPE_KEY, GOOGLE_API_KEY
3. Check all .env files (especially in frontend)
4. Review authentication implementation
5. Check localStorage usage for sensitive data
6. Identify CORS misconfigurations
7. Review for XSS vulnerabilities
8. Check input validation

INSTRUCTIONS:
- List every file containing potential security issues
- Categorize by severity: CRITICAL, HIGH, MEDIUM, LOW
- For each issue, provide:
  * File path
  * Line number(s)
  * Description of vulnerability
  * Recommended fix
  * Estimated fix time

OUTPUT FORMAT:
Generate a detailed markdown report with sections:
1. Executive Summary
2. Critical Vulnerabilities (must fix immediately)
3. High Priority Issues
4. Medium Priority Issues
5. Low Priority Issues
6. Recommendations
7. Next Steps

Begin the security audit now.
PROMPT

