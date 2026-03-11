#!/bin/bash
# Health Check Cron Script - Runs every 30 minutes
# Logs to workspace/logs/health.log
# Exit codes: 0=healthy, 1=degraded, 2=critical

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/health.log"
BACKEND_URL="http://localhost:8000"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Timestamp function
timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

# Log function
log() {
    echo "[$(timestamp)] $1" | tee -a "$LOG_FILE"
}

# Check backend health
check_backend() {
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" "$BACKEND_URL/api/health" 2>/dev/null)
    http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" != "200" ]; then
        log "❌ BACKEND: HTTP $http_code"
        return 2
    fi
    
    local status=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null)
    
    if [ "$status" = "healthy" ]; then
        log "✅ BACKEND: healthy"
        return 0
    elif [ "$status" = "degraded" ]; then
        log "⚠️  BACKEND: degraded"
        return 1
    else
        log "❌ BACKEND: $status"
        return 2
    fi
}

# Check budget alerts
check_budget() {
    local response
    response=$(curl -s "$BACKEND_URL/api/budget/alerts" 2>/dev/null)
    
    if [ -z "$response" ]; then
        log "⚠️  BUDGET: No response"
        return 1
    fi
    
    local critical_count=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('critical_count', 0))" 2>/dev/null)
    
    if [ "$critical_count" -gt 0 ]; then
        log "🔴 BUDGET: $critical_count critical alert(s) detected"
        
        # Extract and log alert details
        echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for alert in data.get('alerts', []):
    if alert.get('level') == 'critical':
        print(f\"  - {alert.get('period', 'unknown').capitalize()}: {alert.get('message', 'N/A')}\")
" 2>/dev/null | while read -r line; do
            log "  $line"
        done
        
        return 2
    else
        log "✅ BUDGET: No critical alerts"
        return 0
    fi
}

# Check error logs
check_errors() {
    local response
    response=$(curl -s "$BACKEND_URL/api/error-logs?limit=5" 2>/dev/null)
    
    if [ -z "$response" ]; then
        log "⚠️  ERRORS: No response"
        return 1
    fi
    
    local total=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total', 0))" 2>/dev/null)
    
    if [ "$total" -gt 0 ]; then
        log "⚠️  ERRORS: $total recent error(s) logged"
        
        # Log most recent error
        echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
errors = data.get('errors', [])
if errors:
    latest = errors[0]
    print(f\"  Latest: {latest.get('title', 'Unknown')} at {latest.get('timestamp', 'Unknown')}\")
" 2>/dev/null | while read -r line; do
            log "  $line"
        done
        
        return 1
    else
        log "✅ ERRORS: No recent errors"
        return 0
    fi
}

# Check agent status
check_agents() {
    local response
    response=$(curl -s "$BACKEND_URL/api/health" 2>/dev/null)
    
    if [ -z "$response" ]; then
        log "⚠️  AGENTS: No response"
        return 1
    fi
    
    # Count agent statuses
    local online=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
agents = data.get('checks', {}).get('agents', {})
print(sum(1 for a in agents.values() if a.get('status') == 'online'))
" 2>/dev/null)
    
    local unknown=$(echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
agents = data.get('checks', {}).get('agents', {})
print(sum(1 for a in agents.values() if a.get('status') == 'unknown'))
" 2>/dev/null)
    
    log "🤖 AGENTS: $online online, $unknown unknown (SSH tunnel needed)"
    
    if [ "$online" -eq 0 ]; then
        return 2
    elif [ "$unknown" -gt 0 ]; then
        return 1
    else
        return 0
    fi
}

# Main execution
main() {
    log "═══════════════════════════════════════════"
    log "🏥 Starting health check..."
    
    local exit_code=0
    
    # Run all checks
    check_backend || exit_code=$?
    check_budget || { local budget_code=$?; [ $budget_code -gt $exit_code ] && exit_code=$budget_code; }
    check_errors || { local error_code=$?; [ $error_code -gt $exit_code ] && exit_code=$error_code; }
    check_agents || { local agent_code=$?; [ $agent_code -gt $exit_code ] && exit_code=$agent_code; }
    
    # Summary
    log "═══════════════════════════════════════════"
    case $exit_code in
        0) log "✅ Health check PASSED - All systems healthy" ;;
        1) log "⚠️  Health check DEGRADED - Some issues detected" ;;
        2) log "🔴 Health check CRITICAL - Immediate attention needed" ;;
    esac
    log ""
    
    exit $exit_code
}

main "$@"
