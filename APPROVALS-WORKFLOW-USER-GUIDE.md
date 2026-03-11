# Approval Workflows Dashboard — User Guide

**For:** Shubham Sharma  
**Dashboard:** http://localhost:3000/approvals  
**API Docs:** See `APPROVALS-WORKFLOW-IMPLEMENTATION.md`

---

## Quick Start

1. **Access:** Navigate to `http://localhost:3000/approvals` (or click "Approvals" in sidebar)
2. **Current State:** 1 pending approval waiting for your review (#2: large_spend from claudy)
3. **Action Required:** Review and approve/reject pending items

---

## User Journey

### Scenario: Agent Requests High-Risk Action

**Step 1: Agent Creates Approval**

Agent (jarvis, wolff, claudy) encounters a high-risk action:
- Deleting files (`exec_rm`)
- Restarting gateway (`gateway_restart`)
- Spending >$10 (`large_spend`)

Agent calls API:
```bash
POST /api/approvals-ui/create
{
  "agent_id": "jarvis",
  "action": "exec_rm",
  "details": {"command": "rm -rf /tmp/logs", "cwd": "/tmp"},
  "risk_level": "high"
}
```

**Step 2: Approval Appears in Dashboard**

- Red "1 pending" badge appears in header (animated pulse)
- Card shows in "⏳ Queue" tab with:
  - 🚨 or ⚠️ emoji (high/medium risk)
  - Action name in monospace font
  - Agent ID + timestamp
  - JSON details in code block
  - Two buttons: ✅ Approve | ❌ Reject

**Step 3: You Review Details**

Example pending approval:
```
🚨  exec_rm                [HIGH]
    jarvis · 2m ago · #3

    {
      "command": "rm -rf /tmp/logs",
      "cwd": "/tmp"
    }

    [✅ Approve] [❌ Reject]
```

**Step 4: You Decide**

### Option A: Approve

1. Click **✅ Approve** button
2. (Optional) Add comment: "Safe cleanup operation"
3. Click **Confirm Approve ✅**
4. Toast appears: "Approved #3 ✅"
5. Card disappears from queue
6. Approval moves to History with status "approved"
7. Agent receives approval, executes action

### Option B: Reject

1. Click **❌ Reject** button
2. Textarea appears: "Rejection reason (required)…"
3. Type reason: "Too risky during peak hours"
4. Click **Confirm Reject ❌**
5. Toast appears: "Rejected #3 ❌"
6. Card disappears from queue
7. Approval moves to History with status "rejected"
8. Agent receives rejection, aborts action

---

## Dashboard Tabs

### ⏳ Queue Tab (Default)

**Purpose:** Review pending approvals requiring your decision

**Layout:** Card grid (responsive: 1 col mobile, 2 cols tablet, 3 cols desktop)

**Empty State:**
```
✅
No pending approvals

High-risk agent actions will appear here for your review
```

**Pending Card Anatomy:**
```
┌─────────────────────────────────────────┐
│ 🚨  exec_rm              [HIGH]         │
│     jarvis · 2m ago · #3                │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ {                                   │ │
│ │   "command": "rm -rf /tmp/logs",    │ │
│ │   "cwd": "/tmp"                     │ │
│ │ }                                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [    ✅ Approve    ] [    ❌ Reject    ] │
└─────────────────────────────────────────┘
```

**Interactions:**
- Approve → Opens comment field → Confirm
- Reject → Opens reason field (required) → Confirm
- Cancel → Closes confirmation flow

---

### 📋 History Tab

**Purpose:** View all past approval decisions (audit trail)

**Layout:** Table with sortable columns

**Columns:**
- `#` — Approval ID
- `Action / Agent` — Action name (monospace) + agent ID (blue)
- `Risk` — Badge (HIGH/MED)
- `Status` — Badge (✅ approved / ❌ rejected / ⏳ pending)
- `Created` — "2m ago" format
- `Decided` — When decision was made (or "—" if pending)
- `Notes` — Rejection reason (red) or approve comment (green)

**Example Row:**
```
| # | Action / Agent    | Risk | Status     | Created | Decided | Notes                       |
|---|-------------------|------|------------|---------|---------|----------------------------|
| 3 | exec_rm          | HIGH | ✅ approved | 5m ago  | 2m ago  | Safe cleanup operation     |
|   | jarvis           |      |            |         |         |                            |
```

**Features:**
- Hover row → highlights
- Truncated notes → shows full text on hover (future: tooltip)
- Newest first (sorted by `decided_at` or `created_at`)

---

### ⚙️ Config Tab

**Purpose:** Configure approval thresholds and policies

**Layout:** Vertical list of editable cards

**Thresholds:**

1. **max_spend_usd**
   - Description: "Require approval for single actions spending more than this amount (USD)"
   - Current: `10`
   - Edit: Change to `15` → Save

2. **exec_risk_level**
   - Description: "Minimum risk level requiring approval: 'medium' or 'high'"
   - Current: `"high"`
   - Edit: Change to `"medium"` → All medium+ risk actions need approval

3. **auto_approve_low_risk**
   - Description: "Automatically approve low-risk actions without human review"
   - Current: `false`
   - Edit: Change to `true` → Low-risk actions auto-approved

4. **notify_telegram**
   - Description: "Send Telegram notification when a new approval is pending"
   - Current: `true`
   - Edit: Change to `false` → No notifications (check dashboard manually)

**Editing Flow:**
1. Click **✏️ Edit** button
2. Input field appears with current value (JSON)
3. Modify value (e.g., `10` → `15`)
4. Click **Save** → Green toast "Saved config: max_spend_usd"
5. Or click **Cancel** → Reverts to original value

**Value Types:**
- Numbers: `10`, `15.5`
- Strings: `"high"`, `"medium"`
- Booleans: `true`, `false`
- Arrays: `["exec_rm", "gateway_restart"]` (future)
- Objects: `{"min": 10, "max": 100}` (future)

---

## Stats Row (Top)

**Location:** Below page header, above tabs

**Metrics:**

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Pending    │  High Risk  │  Approved   │  Rejected   │
│     1       │     0       │     1       │     1       │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Colors:**
- Pending: Blue (animated pulse if >0)
- High Risk: Red
- Approved: Green
- Rejected: Red

**Auto-Refresh:** Updates every 10 seconds

---

## Features

### Real-Time Polling

- Dashboard checks for new approvals every 10 seconds
- No manual refresh needed
- "Last polled" timestamp shows in header
- Manual refresh button available (↻ Refresh)

### Toast Notifications

**Success (Green):**
- "Approved #3 ✅"
- "Saved config: max_spend_usd"

**Error (Red):**
- "Failed to approve #3"
- "Failed to save config"

**Auto-dismiss:** 3 seconds

### Keyboard Shortcuts (Future)

- `A` → Approve first pending
- `R` → Reject first pending
- `H` → Switch to History tab
- `C` → Switch to Config tab
- `Esc` → Cancel confirmation flow

---

## Integration Examples

### Agent Side (Python)

```python
import httpx
import asyncio

async def request_approval(action: str, details: dict, risk: str = "high"):
    """Request approval and block until decision."""
    resp = httpx.post(
        "http://localhost:8000/api/approvals-ui/create",
        json={
            "agent_id": "my-agent",
            "action": action,
            "details": details,
            "risk_level": risk
        }
    )
    approval_id = resp.json()["id"]
    
    print(f"⏳ Approval #{approval_id} pending. Waiting for decision...")
    
    while True:
        resp = httpx.get(f"http://localhost:8000/api/approvals-ui/history?limit=1")
        latest = resp.json()[0]
        
        if latest["id"] == approval_id:
            if latest["status"] == "approved":
                print(f"✅ Approval #{approval_id} approved!")
                return True
            elif latest["status"] == "rejected":
                print(f"❌ Approval #{approval_id} rejected: {latest['rejection_reason']}")
                return False
        
        await asyncio.sleep(5)

# Usage
approved = await request_approval(
    action="deploy_to_prod",
    details={"target": "api.example.com", "version": "v2.1.0"},
    risk="high"
)

if approved:
    deploy_to_production()
else:
    rollback_deployment()
```

### Curl Examples

**Create Approval:**
```bash
curl -X POST http://localhost:8000/api/approvals-ui/create \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "test-agent",
    "action": "test_action",
    "details": {"key": "value"},
    "risk_level": "medium"
  }'
```

**List Pending:**
```bash
curl http://localhost:8000/api/approvals-ui/pending | jq .
```

**Approve:**
```bash
curl -X POST http://localhost:8000/api/approvals-ui/1/approve \
  -H "Content-Type: application/json" \
  -d '{"comment": "Looks good", "decided_by": "shubham"}'
```

**Reject:**
```bash
curl -X POST http://localhost:8000/api/approvals-ui/1/reject \
  -H "Content-Type: application/json" \
  -d '{"reason": "Too risky", "decided_by": "shubham"}'
```

---

## FAQ

**Q: Can I approve via API instead of dashboard?**  
A: Yes! Use `POST /api/approvals-ui/{id}/approve` endpoint.

**Q: Can agents bypass approvals?**  
A: Not if implemented correctly. Agent should block execution until approval status changes to "approved".

**Q: What happens if I never approve/reject?**  
A: Approval stays in pending queue indefinitely. Future: Add auto-expiration (e.g., 24h → auto-reject).

**Q: Can I bulk approve?**  
A: Not yet. Future enhancement: "Approve all" button for trusted agents.

**Q: Can I delegate approvals?**  
A: Not yet. Future: Multi-user system with approval chains (requester → manager → admin).

**Q: Can I see who approved what?**  
A: Yes! History tab shows `decided_by` column.

**Q: Can I undo an approval?**  
A: No. Approvals are immutable. Future: Add "revoke" feature for pending executions.

**Q: Can I get notified via email/Telegram?**  
A: Telegram: Set `notify_telegram=true` in Config (requires Telegram bot integration).  
   Email: Not yet implemented.

---

## Troubleshooting

### "Backend Offline" in sidebar
- Check backend is running: `curl http://localhost:8000/api/health`
- Restart backend: `cd backend && .venv/bin/uvicorn app.main:app --reload`

### Pending approvals not showing
- Check API: `curl http://localhost:8000/api/approvals-ui/pending`
- Check browser console for errors (F12 → Console)
- Verify database tables exist: `sqlite3 backend/dashboard.db ".tables"`

### Approve/Reject button not working
- Check browser console for CORS errors
- Verify backend CORS settings in `backend/app/main.py`
- Check network tab (F12 → Network) for 4xx/5xx errors

### Config changes not saving
- Check API: `curl http://localhost:8000/api/approvals-ui/config`
- Verify threshold value is valid JSON (use `json.tool` to validate)
- Check backend logs for validation errors

---

## Best Practices

### For Users (You)

1. **Check dashboard daily** — Pending approvals block agent work
2. **Review details carefully** — Don't approve blindly
3. **Add meaningful comments** — Help future debugging
4. **Set thresholds wisely** — Too strict = approval fatigue, too loose = risky
5. **Use History tab** — Audit what was approved/rejected

### For Agent Developers

1. **Request approval early** — Don't make user wait at critical moments
2. **Provide context in details** — Help user make informed decision
3. **Set correct risk level** — HIGH = destructive/costly, MEDIUM = potentially risky
4. **Respect rejections** — Don't retry immediately
5. **Log approval decisions** — For debugging and auditing

---

## Next Steps

1. **Test the workflow:**
   - Open http://localhost:3000/approvals
   - Review pending approval (#2: large_spend)
   - Try approve/reject flows
   - Check history tab

2. **Configure thresholds:**
   - Go to Config tab
   - Adjust `max_spend_usd` to your budget
   - Save changes

3. **Integrate with agents:**
   - Add approval requests to high-risk agent code
   - Test with dev agents first
   - Deploy to production agents after testing

4. **Monitor usage:**
   - Check History tab weekly
   - Review approval patterns
   - Adjust thresholds based on usage

---

## Support

**Issues?** Check `APPROVALS-WORKFLOW-IMPLEMENTATION.md` for technical details.

**Questions?** Tag @coder subagent in Telegram for dev support.

**Feature requests?** Add to Notion backlog under "Dashboard Vision Phase 4".

---

**Happy approving! 🚀**
