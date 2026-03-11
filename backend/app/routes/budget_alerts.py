"""Budget Alerts and Spending Monitoring"""
from __future__ import annotations
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func, and_
from app.database import async_session
from app.models import CostRecord

router = APIRouter()

# Budget configuration (can be moved to config file)
BUDGET_THRESHOLDS = {
    "daily": 10.0,      # $10/day
    "weekly": 50.0,     # $50/week
    "monthly": 150.0    # $150/month
}

# Alert configuration
ALERT_PERCENTAGES = {
    "warning": 0.75,    # Alert at 75% of budget
    "critical": 0.90    # Critical alert at 90% of budget
}


async def calculate_spending(period: str) -> Dict[str, Any]:
    """Calculate spending for a given period (daily/weekly/monthly)"""
    async with async_session() as db:
        now = datetime.utcnow()
        
        if period == "daily":
            start_time = now - timedelta(days=1)
            budget = BUDGET_THRESHOLDS["daily"]
        elif period == "weekly":
            start_time = now - timedelta(weeks=1)
            budget = BUDGET_THRESHOLDS["weekly"]
        elif period == "monthly":
            start_time = now - timedelta(days=30)
            budget = BUDGET_THRESHOLDS["monthly"]
        else:
            raise ValueError(f"Unknown period: {period}")
        
        # Calculate total spending
        result = await db.execute(
            select(func.sum(CostRecord.cost_usd)).where(
                and_(
                    CostRecord.recorded_at >= start_time,
                    CostRecord.cost_usd > 0
                )
            )
        )
        total_spent = float(result.scalar() or 0.0)
        
        # Calculate by agent
        result = await db.execute(
            select(
                CostRecord.agent_id,
                func.sum(CostRecord.cost_usd).label("total")
            ).where(
                and_(
                    CostRecord.recorded_at >= start_time,
                    CostRecord.cost_usd > 0
                )
            ).group_by(CostRecord.agent_id)
        )
        by_agent = {
            f"agent_{row[0]}": float(row[1]) 
            for row in result.fetchall() 
            if row[0] is not None
        }
        
        # Calculate by model
        result = await db.execute(
            select(
                CostRecord.model,
                func.sum(CostRecord.cost_usd).label("total")
            ).where(
                and_(
                    CostRecord.recorded_at >= start_time,
                    CostRecord.cost_usd > 0
                )
            ).group_by(CostRecord.model)
        )
        by_model = {
            row[0]: float(row[1]) 
            for row in result.fetchall() 
            if row[0]
        }
        
        # Calculate percentage of budget
        percentage = (total_spent / budget * 100) if budget > 0 else 0
        
        # Determine alert level
        alert_level = "ok"
        if percentage >= ALERT_PERCENTAGES["critical"] * 100:
            alert_level = "critical"
        elif percentage >= ALERT_PERCENTAGES["warning"] * 100:
            alert_level = "warning"
        
        # Calculate remaining budget
        remaining = budget - total_spent
        
        # Project end-of-period spending
        if period == "daily":
            hours_elapsed = (now - start_time).total_seconds() / 3600
            projected = (total_spent / hours_elapsed * 24) if hours_elapsed > 0 else total_spent
        elif period == "weekly":
            days_elapsed = (now - start_time).total_seconds() / 86400
            projected = (total_spent / days_elapsed * 7) if days_elapsed > 0 else total_spent
        else:  # monthly
            days_elapsed = (now - start_time).total_seconds() / 86400
            projected = (total_spent / days_elapsed * 30) if days_elapsed > 0 else total_spent
        
        return {
            "period": period,
            "budget": budget,
            "spent": round(total_spent, 4),
            "remaining": round(remaining, 4),
            "percentage": round(percentage, 2),
            "projected": round(projected, 4),
            "alert_level": alert_level,
            "by_agent": by_model,  # Use model instead of agent_id for clarity
            "by_model": dict(list(by_model.items())[:5]),  # Top 5 models
            "start_time": start_time.isoformat(),
            "end_time": now.isoformat()
        }


@router.get("")
async def get_budget_status(period: Optional[str] = "daily"):
    """
    Get budget status for specified period
    
    Query params:
    - period: daily, weekly, or monthly (default: daily)
    """
    if period not in ["daily", "weekly", "monthly"]:
        raise HTTPException(
            status_code=400, 
            detail="Invalid period. Must be 'daily', 'weekly', or 'monthly'"
        )
    
    try:
        spending = await calculate_spending(period)
        return spending
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating budget: {str(e)}")


@router.get("/all")
async def get_all_budgets():
    """Get budget status for all periods (daily, weekly, monthly)"""
    try:
        daily = await calculate_spending("daily")
        weekly = await calculate_spending("weekly")
        monthly = await calculate_spending("monthly")
        
        return {
            "daily": daily,
            "weekly": weekly,
            "monthly": monthly,
            "overall_alert": max(
                daily["alert_level"],
                weekly["alert_level"],
                monthly["alert_level"],
                key=lambda x: {"ok": 0, "warning": 1, "critical": 2}.get(x, 0)
            )
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating budgets: {str(e)}")


@router.get("/alerts")
async def get_budget_alerts():
    """Get active budget alerts"""
    try:
        alerts = []
        
        for period in ["daily", "weekly", "monthly"]:
            spending = await calculate_spending(period)
            
            if spending["alert_level"] != "ok":
                alerts.append({
                    "period": period,
                    "level": spending["alert_level"],
                    "message": f"{period.capitalize()} budget: ${spending['spent']:.2f} / ${spending['budget']:.2f} ({spending['percentage']:.1f}%)",
                    "remaining": spending["remaining"],
                    "projected": spending["projected"],
                    "recommendation": get_recommendation(spending)
                })
        
        # Sort by severity (critical first)
        alerts.sort(
            key=lambda x: {"critical": 0, "warning": 1, "ok": 2}.get(x["level"], 3)
        )
        
        return {
            "alerts": alerts,
            "total_alerts": len(alerts),
            "critical_count": sum(1 for a in alerts if a["level"] == "critical"),
            "warning_count": sum(1 for a in alerts if a["level"] == "warning")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting alerts: {str(e)}")


def get_recommendation(spending: Dict[str, Any]) -> str:
    """Generate spending recommendation based on budget status"""
    if spending["alert_level"] == "critical":
        if spending["projected"] > spending["budget"] * 1.2:
            return f"URGENT: Projected to exceed budget by ${spending['projected'] - spending['budget']:.2f}. Consider reducing API usage immediately."
        else:
            return f"CRITICAL: Only ${spending['remaining']:.2f} remaining. Monitor usage closely."
    elif spending["alert_level"] == "warning":
        if spending["projected"] > spending["budget"]:
            return f"WARNING: On track to exceed budget by ${spending['projected'] - spending['budget']:.2f}. Consider optimizing usage."
        else:
            return f"WARNING: {spending['percentage']:.1f}% of budget used. Projected to stay within budget."
    else:
        return "Budget status healthy. Continue monitoring."


@router.get("/top-spenders")
async def get_top_spenders(limit: int = 5, period: str = "daily"):
    """Get top spending models/agents"""
    if period not in ["daily", "weekly", "monthly"]:
        raise HTTPException(status_code=400, detail="Invalid period")
    
    async with async_session() as db:
        now = datetime.utcnow()
        
        if period == "daily":
            start_time = now - timedelta(days=1)
        elif period == "weekly":
            start_time = now - timedelta(weeks=1)
        else:
            start_time = now - timedelta(days=30)
        
        result = await db.execute(
            select(
                CostRecord.model,
                func.sum(CostRecord.cost_usd).label("total"),
                func.sum(CostRecord.total_tokens).label("tokens"),
                func.count().label("requests")
            ).where(
                and_(
                    CostRecord.recorded_at >= start_time,
                    CostRecord.cost_usd > 0
                )
            ).group_by(CostRecord.model)
            .order_by(func.sum(CostRecord.cost_usd).desc())
            .limit(limit)
        )
        
        top_spenders = [
            {
                "model": row[0],
                "total_cost": round(float(row[1]), 4),
                "total_tokens": row[2],
                "request_count": row[3],
                "avg_cost_per_request": round(float(row[1]) / row[3], 4) if row[3] > 0 else 0
            }
            for row in result.fetchall()
            if row[0]
        ]
        
        return {
            "period": period,
            "top_spenders": top_spenders,
            "limit": limit
        }
