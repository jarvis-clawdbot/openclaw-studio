# Dashboard Vision - Real-Time Data Testing Plan

## Objective
Verify that ALL dashboard pages fetch real-time data from the OpenClaw Gateway (http://localhost:18789), not hard-coded data.

## Current Status
- ✅ Backend: Running (75 endpoints on :8000)
- ❌ Frontend: Compilation error blocking tests
- ✅ Gateway: Running (openclaw-gateway on :18789)

## Error Details
**File:** `src/features/agents/approvals/pendingStore.ts`
**Issue:** Missing exports for exec approval feature
**Impact:** HomeClient.tsx fails to compile, blocking dashboard render

## Test Matrix (22 Pages)

### Core Pages
| Page | URL | Expected Data Source | Status |
|------|-----|---------------------|---------|
| Fleet | `/` | Gateway `/api/agents` | ⏳ Blocked |
| Agent Settings | `/agents/{id}/settings` | Gateway `/api/agents/{id}` | ⏳ Blocked |
| Agent Create | `/agents/create` | User input | ⏳ Blocked |
| Topology | `/topology` | Gateway `/api/agents` | ⏳ Blocked |
| Tasks | `/tasks` | Backend `/api/tasks` | ⏳ Blocked |
| Analytics | `/analytics` | Backend `/api/analytics/token-usage` | ⏳ Blocked |
| Replay | `/replay` | Backend `/api/replay/sessions` | ⏳ Blocked |

### Audit & Approvals
| Page | URL | Expected Data Source | Status |
|------|-----|---------------------|---------|
| Audit | `/audit` | Backend `/api/activity` | ⏳ Blocked |
| Approvals | `/approvals` | Backend `/api/approvals/decisions` | ⏳ Blocked |

### Marketplace & Extensions
| Page | URL | Expected Data Source | Status |
|------|-----|---------------------|---------|
| Skills | `/skills` | Backend `/api/skills` | ⏳ Blocked |
| Boards | `/boards` | Backend `/api/boards` | ⏳ Blocked |

### Infrastructure
| Page | URL | Expected Data Source | Status |
|------|-----|---------------------|---------|
| Gateways | `/gateways` | Backend `/api/gateways` | ⏳ Blocked |
| Cron Jobs | `/cron` | Gateway `/api/cron` (list action) | ⏳ Blocked |
| Webhooks | `/webhooks` | Backend `/api/webhooks` | ⏳ Blocked |

### Organizations
| Page | URL | Expected Data Source | Status |
|------|-----|---------------------|---------|
| Organizations | `/organizations` | Backend `/api/organizations` | ⏳ Blocked |

### Core Features (Phase 6)
| Page | URL | Expected Data Source | Status |
|------|-----|---------------------|---------|
| Sessions | `/sessions` | Gateway `/api/sessions/list` | ⏳ Blocked |
| Memory | `/memory` | Gateway `/api/memory/search` | ⏳ Blocked |
| Nodes | `/nodes` | Gateway `/api/nodes` (status action) | ⏳ Blocked |
| Logs | `/logs` | Backend `/api/logs/recent` | ⏳ Blocked |
| Settings | `/settings` | LocalStorage + User input | ⏳ Blocked |
| Command Center | `/command-center` | Mixed | ⏳ Blocked |

## Test Criteria

For each page, verify:
1. ✅ **No Hard-Coded Data** - All data fetched via API
2. ✅ **Real-Time Updates** - Data refreshes automatically
3. ✅ **Correct API Endpoint** - Matches backend/gateway
4. ✅ **Error Handling** - Shows empty state when no data
5. ✅ **Loading States** - Shows "Loading..." before data arrives

## Test Procedure

### Step 1: Fix Compilation Error
- Option A: Comment out exec approval feature
- Option B: Implement missing pendingStore exports
- Option C: Use minimal HomeClient without exec approval

### Step 2: Start Services
```bash
# Backend
cd backend && .venv/bin/uvicorn app.main:app --port 8000

# Frontend
npm run dev

# Gateway (already running)
# openclaw-gateway on :18789
```

### Step 3: Test Each Page
For each page:
1. Navigate to URL
2. Open DevTools Network tab
3. Verify API calls (not hard-coded data)
4. Take screenshot showing:
   - Data displayed
   - Network tab with API request
   - No errors in console

### Step 4: Document Results
- Screenshot per page
- API endpoint called
- Data shown (real vs hard-coded)
- Any errors found

## Expected API Calls

### Gateway Endpoints (should proxy to :18789)
- `POST /api/agents` → action: list
- `POST /api/sessions/list`
- `POST /api/cron` → action: list
- `POST /api/nodes` → action: status

### Backend Endpoints (direct to :8000)
- `GET /api/tasks`
- `GET /api/analytics/token-usage`
- `GET /api/activity`
- `GET /api/approvals/decisions`
- `GET /api/skills`
- `GET /api/boards`
- `GET /api/gateways`
- `GET /api/webhooks`
- `GET /api/organizations`
- `GET /api/logs/recent`

## Success Criteria

✅ All 22 pages load without errors
✅ All pages make real API calls (visible in Network tab)
✅ No hard-coded mock data
✅ Empty states when no data (not fake data)
✅ Real-time updates work (WebSocket or polling)

## Blockers

❌ **CRITICAL:** Exec approval feature breaks HomeClient compilation
❌ **Resolution needed before testing can proceed**

---

**Status:** Awaiting decision on how to handle exec approval issue.
**Next Step:** Fix compilation → Test all 22 pages → Document results with screenshots.
