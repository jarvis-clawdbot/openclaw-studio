#!/bin/bash
# Dashboard Vision Backend — persistent restart wrapper
# Keeps the backend alive; logs to /tmp/dashboard-backend.log

BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
LOG_FILE="/tmp/dashboard-backend.log"
PID_FILE="/tmp/dashboard-backend.pid"

cd "$BACKEND_DIR"

echo "[$(date)] Starting Dashboard Vision backend..." >> "$LOG_FILE"

while true; do
  echo "[$(date)] Launching uvicorn..." >> "$LOG_FILE"
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> "$LOG_FILE" 2>&1 &
  PID=$!
  echo $PID > "$PID_FILE"
  echo "[$(date)] PID=$PID" >> "$LOG_FILE"
  wait $PID
  EXIT_CODE=$?
  echo "[$(date)] Backend exited (code=$EXIT_CODE), restarting in 3s..." >> "$LOG_FILE"
  sleep 3
done
