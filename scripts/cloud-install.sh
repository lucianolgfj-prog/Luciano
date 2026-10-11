#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Luciano
npm ci --cache /tmp/jda-npm-cache
node scripts/init-env.mjs
if node --input-type=module -e 'import "dotenv/config"; process.exit(process.env.APP_MODE === "demo" ? 0 : 1)'; then
  docker compose up -d --wait db
fi
npm run db:generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
