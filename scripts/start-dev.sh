#!/bin/bash
# Force Node.js 20 for this project
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js 20
nvm use 20 2>/dev/null || nvm install 20

# Start the dev server
npm run dev
