# Audit Log Quick Reference

## 📍 URLs
- **Frontend:** http://localhost:3000/audit
- **Backend Stats:** http://localhost:8000/api/audit/stats
- **Backend Logs:** http://localhost:8000/api/audit/logs

## 🔑 Key Files
```
backend/app/models/__init__.py        # AuditLog model
backend/app/routes/audit.py           # API routes
backend/app/routes/__init__.py        # Router registration
src/app/audit/page.tsx                # Frontend UI
```

## 💻 API Quick Start

### Get Recent Logs
```bash
curl http://localhost:8000/api/audit/logs
```

### Filter by Agent
```bash
curl 'http://localhost:8000/api/audit/logs?agent=orchestrator'
```

### High-Risk Actions Only
```bash
curl 'http://localhost:8000/api/audit/logs?risk_level=high'
```

### Export CSV
```bash
curl -X POST 'http://localhost:8000/api/audit/export?format=csv' -o audit.csv
```

### Get Statistics
```bash
curl http://localhost:8000/api/audit/stats | jq .
```

## 🔨 Write Audit Logs (Python)

### From any backend route:
```python
from app.routes.audit import log_audit

# Success action
log_audit(
    agent_id="orchestrator",
    action="exec",
    details={"cmd": "ls -la", "exit_code": 0},
    risk_level="low",
    status="success"
)

# High-risk action
log_audit(
    agent_id="admin",
    action="gateway_restart",
    details={"reason": "config change", "downtime_ms": 1200},
    risk_level="high",
    status="success"
)

# Failure
log_audit(
    agent_id="coder",
    action="exec",
    details={"cmd": "pytest", "exit_code": 1, "stderr": "2 tests failed"},
    risk_level="medium",
    status="failure"
)
```

## 🎨 Risk Levels

| Level | When to Use | Examples |
|-------|-------------|----------|
| **low** | Read-only, routine ops | file_read, api_call, status_check |
| **medium** | Write ops, external calls | exec (safe), file_write, api_post |
| **high** | Destructive, system-critical | gateway_restart, file_delete (important), exec (rm -rf) |

## 🏷️ Common Actions

```
exec                 # Shell command execution
file_read            # Read file
file_write           # Write/edit file
file_delete          # Delete file
gateway_restart      # Restart gateway service
gateway_connect      # Connect to gateway
agent_spawn          # Spawn subagent
agent_kill           # Kill agent/session
cron_trigger         # Cron job fired
approval_granted     # User approved action
approval_denied      # User denied action
config_change        # Config file modified
api_call             # External API request
login                # User login
export               # Data export
```

## 🔍 Frontend Features

- **Auto-refresh:** Every 15 seconds
- **Filters:** Agent, Action, Risk, Status, Search, Time Range
- **Pagination:** 100 entries per page
- **Export:** CSV + JSON download
- **Expandable rows:** Click to see full JSON details
- **Stats cards:** Total, High-Risk, Failures, Blocked
- **Charts:** By-Action and By-Agent breakdowns

## 🛠️ Seed Test Data

### Via Frontend:
Click "⚗️ Seed test data" button (adds 12 logs)

### Via CLI:
```bash
curl -X POST http://localhost:8000/api/audit/log \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "orchestrator",
    "action": "exec",
    "details": {"cmd": "ls -la"},
    "risk_level": "low",
    "status": "success"
  }'
```

## 📊 Stats Response Schema

```json
{
  "total": 42,
  "by_agent": {
    "orchestrator": 20,
    "coder": 15,
    "researcher": 7
  },
  "by_action": {
    "exec": 18,
    "file_write": 12,
    "api_call": 8,
    "gateway_restart": 4
  },
  "by_risk": {
    "low": 25,
    "medium": 14,
    "high": 3
  },
  "by_status": {
    "success": 39,
    "failure": 3,
    "blocked": 0
  },
  "since_hours": 24
}
```

## 🚨 Security Notes

1. **Append-only:** No UPDATE or DELETE endpoints
2. **Server-side timestamps:** Cannot be spoofed
3. **JSON validation:** Details must be valid dict/null
4. **IP tracking:** Ready for multi-user audit
5. **High-risk alerts:** Red UI highlight for dangerous actions

## 📦 Dependencies

- Backend: FastAPI, SQLAlchemy, Pydantic
- Frontend: Next.js 14, React 18, Tailwind CSS
- Database: SQLite (audit_logs table)

## 🔗 Related Endpoints

- `/api/activity` — Activity events (different schema, real-time)
- `/api/error-logs` — Error-specific logs
- `/api/gateway-events` — Gateway lifecycle events

---

**Quick Start:**
1. Backend already running on :8000
2. Frontend already running on :3000
3. Visit http://localhost:3000/audit
4. Click "Seed test data" to populate
5. Try filters, search, export

**Full docs:** See `AUDIT-LOG-IMPLEMENTATION.md`
