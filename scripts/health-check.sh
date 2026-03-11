#!/bin/bash
# Health Check Script for ClawdBot
# Pings all services, logs status, alerts on failures

LOG_DIR="$HOME/monitoring/logs"
CONFIG_DIR="$HOME/monitoring/config"
CONFIG_FILE="$CONFIG_DIR/health-config.json"
STATE_FILE="$CONFIG_DIR/health-state.json"
LOG_FILE="$LOG_DIR/health-check.log"
ALERT_THRESHOLD=3

TELEGRAM_CHAT="7909511562"

log() {
    echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

check_tcp() {
    local host="$1"
    local port="$2"
    if timeout 5 bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null; then
        echo "ok"
    else
        echo "fail"
    fi
}

check_https() {
    local host="$1"
    if curl -s --connect-timeout 5 "https://$host" > /dev/null 2>&1; then
        echo "ok"
    else
        echo "fail"
    fi
}

load_state() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        echo '{"consecutive_failures": {}, "last_alert": null}'
    fi
}

save_state() {
    echo "$1" > "$STATE_FILE"
}

send_alert() {
    local message="$1"
    log "ALERT: $message"
    
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT" \
            -d "text=🚨 HEALTH ALERT: $message" \
            -d "parse_mode=Markdown" > /dev/null
    fi
    
    echo "[$(date -Iseconds)] ALERT: $message" >> "$LOG_DIR/alerts.log"
}

# Main
log "=== Health Check Started ==="

state=$(load_state)
failures_this_run=0
status_report="🏥 **Health Check Report**\n\n"

# Read services from config or use defaults
if [[ -f "$CONFIG_FILE" ]]; then
    services=$(python3 -c "
import json
with open('$CONFIG_FILE') as f:
    config = json.load(f)
for s in config.get('services', []):
    print(f\"{s['name']}:{s['host']}:{s['port']}:{s.get('type', 'tcp')}\")
")
else
    services="gateway:100.82.115.97:18789:tcp
openclaw-docs:docs.openclaw.ai:443:https"
fi

while IFS=: read -r name host port type; do
    [[ -z "$name" ]] && continue
    
    if [[ "$type" == "https" ]]; then
        status=$(check_https "$host")
    else
        status=$(check_tcp "$host" "$port")
    fi
    
    if [[ "$status" == "ok" ]]; then
        status_report+="✅ \`$name\` ($host:$port) - OK\n"
        state=$(echo "$state" | python3 -c "import sys,json; d=json.load(sys.stdin); d['consecutive_failures']['$name']=0; print(json.dumps(d))")
        log "✅ $name is healthy"
    else
        status_report+="❌ \`$name\` ($host:$port) - FAILED\n"
        failures_this_run=$((failures_this_run + 1))
        
        state=$(echo "$state" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['consecutive_failures']['$name'] = d['consecutive_failures'].get('$name', 0) + 1
print(json.dumps(d))
")
        
        current_failures=$(echo "$state" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['consecutive_failures'].get('$name', 0))")
        log "❌ $name failed (consecutive: $current_failures)"
        
        if [[ "$current_failures" -ge "$ALERT_THRESHOLD" ]]; then
            last_alert=$(echo "$state" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('last_alert', {}).get('$name', ''))")
            
            if [[ "$last_alert" != "$current_failures" ]]; then
                send_alert "$name is down (failed $current_failures times in a row)"
                state=$(echo "$state" | python3 -c "
import sys, json
d = json.load(sys.stdin)
d['last_alert'] = d.get('last_alert', {})
d['last_alert']['$name'] = '$current_failures'
print(json.dumps(d))
")
            fi
        fi
    fi
done <<< "$services"

save_state "$state"

status_report+="\n**Checked at:** $(date '+%Y-%m-%d %H:%M')\n"
if [[ "$failures_this_run" -eq 0 ]]; then
    status_report+="\n🟢 All services healthy"
else
    status_report+="\n🔴 $failures_this_run service(s) failing"
fi

log "$status_report"

# Send to Telegram if token available
if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT" \
        -d "text=$status_report" \
        -d "parse_mode=Markdown" > /dev/null
fi

echo "Health check complete: $failures_this_run failures"
