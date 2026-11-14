#!/bin/bash
# Production deploy. Requires NPM_TOKEN (GitHub PAT, read:packages) in the environment
# or /root/.deploy-env, see BACKLOG.md / README.
set -euo pipefail

[ -f /root/.deploy-env ] && source /root/.deploy-env

git pull --ff-only
npm ci
npm run build    # build before touching the running app, so a failed build causes no downtime
pm2 restart avaawa --update-env || pm2 start npm --name avaawa -- run server
