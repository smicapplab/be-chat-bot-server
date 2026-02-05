#!/bin/bash

# Kill and delete any existing app instance
pm2 delete be-chat-bot-server || true

# Clean previous build
rm -rf dist

# Rebuild the project
npm run build

# Start or re-register the app cleanly
pm2 start ecosystem.config.js --only be-chat-bot-server