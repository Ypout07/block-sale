#!/bin/bash
echo "🛡️  STABILIZING BLOCK-SALE FOR DEMO..."

# 1. Kill any existing node processes on port 3000
# This means you don't even have to Ctrl+C, the script will force-reset the port for you.
echo "扫 Cleaning network ports..."
lsof -ti :3000 | xargs kill -9 2>/dev/null

# 2. Delete the buggy cache folders and reset demo databases (Correct Paths)
echo "🗑️  Clearing corrupt caches and resetting demo data..."
rm -rf apps/web/.next
rm -rf node_modules/.cache
rm -f apps/web/claims_db.json apps/web/waitlist_db.json apps/web/events_db.json apps/web/purchases_db.json apps/web/redemptions_db.json
rm -f claims_db.json waitlist_db.json events_db.json purchases_db.json redemptions_db.json

# 3. Build the application and ensure liquidity
echo "🏗️  Building production bundle and ensuring liquidity..."
npx ts-node reset_demo.ts
npx ts-node fix_alice.ts
cd apps/web
npx next build

# 4. Start the stable server
echo "🚀 SERVER READY! Open http://localhost:3000 on your machine."
echo "📲 Network Link: http://$(ipconfig getifaddr en0):3000"
npx next start --port 3000 --hostname 0.0.0.0
