#!/bin/bash
# Auto-commit + push dashboard-vision changes daily
# Called by OpenClaw cron at 3 AM

cd ~/dashboard-vision || exit 1

# Only commit if there are changes
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No changes to commit"
  exit 0
fi

git add -A

# Exclude secrets and DB WAL files
git reset HEAD backend/dashboard.db 2>/dev/null
git reset HEAD backend/dashboard.db-shm 2>/dev/null
git reset HEAD backend/dashboard.db-wal 2>/dev/null
git reset HEAD .env 2>/dev/null

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
CHANGED=$(git diff --cached --name-only | wc -l | tr -d ' ')

if [ "$CHANGED" -eq 0 ]; then
  echo "No substantive changes after filtering (DB WAL, .env, etc.) — skipping commit"
  exit 0
fi

git commit -m "auto: daily snapshot ${TIMESTAMP} (${CHANGED} files)" 2>&1

git push origin dashboard-vision 2>&1

echo "Done: committed and pushed ${CHANGED} files"
