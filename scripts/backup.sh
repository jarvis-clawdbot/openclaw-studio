#!/bin/bash
# Backup script for Dashboard Vision
set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dashboard_${DATE}.db"

mkdir -p "$BACKUP_DIR"
cp backend/dashboard.db "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"
