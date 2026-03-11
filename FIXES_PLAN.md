# Dashboard Critical Fixes - Execution Plan

## Issues Identified (2026-03-02 22:47)

1. **Topology Status Wrong** - All agents show "Idle" even when active
2. **Tasks Not Auto-Created** - Static list, no sync with actual work
3. **Analytics Stale** - Not pulling real token usage
4. **Add Buttons Broken** - No onClick handlers for Gateways/Cron/Webhooks/Organizations
5. **Logs Fake** - Backend generates mock data
6. **Memory/Sessions Empty** - Wrong API calls

## Root Cause
Backend tries HTTP POST to gateway (which uses WebSocket/RPC). Must use `openclaw` CLI.

## Fixes

### ✅ DONE (Previous Session)
- sessions.py - rewrote to use CLI
- memory.py - rewrote to use CLI  
- logs.py - rewrote to tail real log file with SSE
- cron.py - rewrote to use CLI
- logs/page.tsx - added real-time SSE streaming
- sessions/page.tsx - improved UI with token display
- memory/page.tsx - added example queries

### 🔄 IN PROGRESS
- Add webhooks/gateways/organizations backend routes
- Create modal components for Add buttons
- Fix topology real-time status detection
- Auto-create tasks from user requests

### ⏳ TODO
- Settings persistence
- Analytics real-time sync
- Task auto-creation hook
