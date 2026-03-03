from __future__ import annotations
from fastapi import APIRouter
from app.routes import logs,  nodes,  memory,  sessions,  agents, tasks, analytics, recovery, replay, health, sync, gateway_events, activity, approvals, skills, gateways, tags, boards, cron, exec_approvals, webhooks, organizations

api_router = APIRouter(prefix="/api")

api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(recovery.router, prefix="/recovery", tags=["recovery"])
api_router.include_router(replay.router, prefix="/replay", tags=["replay"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(gateway_events.router, prefix="/gateway-events", tags=["gateway-events"])
api_router.include_router(activity.router, prefix="/activity", tags=["activity"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
api_router.include_router(skills.router, prefix="/skills", tags=["skills"])
api_router.include_router(gateways.router, prefix="/gateways", tags=["gateways"])
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
api_router.include_router(boards.router, prefix="/boards", tags=["boards"])
api_router.include_router(cron.router, prefix="/cron", tags=["cron"])
api_router.include_router(exec_approvals.router, prefix="/exec-approvals", tags=["exec-approvals"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(nodes.router, prefix="/nodes", tags=["nodes"])
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
