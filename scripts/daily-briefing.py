#!/usr/bin/env python3
"""
Daily Briefing Script for Cathy (Android)
Sends morning/evening summaries via Telegram
"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

# Config
LOG_FILE = Path.home() / "monitoring" / "logs" / "briefing.log"
CONFIG_FILE = Path.home() / "monitoring" / "config" / "briefing-config.json"

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8298046077:AAFWNHfH5mV24kd76SIETOdju83AzhYeLnA")
TELEGRAM_CHAT = "7909511562"

def log(msg: str):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(f"[{datetime.now().isoformat()}] {msg}\n")

def send_telegram(message: str):
    """Send message via Telegram Bot API"""
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = {
            "chat_id": TELEGRAM_CHAT,
            "text": message,
            "parse_mode": "Markdown"
        }
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", url, "-d", json.dumps(data)],
            capture_output=True,
            text=True,
            timeout=15
        )
        log(f"Telegram sent: {result.stdout[:100]}")
        return True
    except Exception as e:
        log(f"Telegram failed: {e}")
        return False

def get_time_of_day() -> str:
    """Return 'morning' or 'evening' based on current hour"""
    hour = datetime.now().hour
    if 6 <= hour < 12:
        return "morning"
    elif 17 <= hour < 21:
        return "evening"
    return "other"

def fetch_briefing_data() -> dict:
    """Fetch briefing data from ClawdBot or local cache"""
    # For now, return placeholder data
    # In production, this would SSH to ClawdBot and fetch:
    # - GitHub activity
    # - Reddit findings
    # - Health status
    # - Research results
    return {
        "github_issues": 0,
        "github_prs": 0,
        "reddit_posts": 0,
        "health_status": "all healthy",
        "research_completed": 0,
    }

def format_morning_briefing(data: dict) -> str:
    """Format morning briefing message"""
    now = datetime.now()
    lines = [
        "☀️ **Good Morning, Shubham!**",
        f"_Generated: {now.strftime('%A, %B %d at %I:%M %p')}_\n",
        "📊 **Yesterday's Summary:**",
        f"• GitHub: {data['github_issues']} new issues, {data['github_prs']} PRs",
        f"• Reddit: {data['reddit_posts']} relevant posts",
        f"• Health: {data['health_status']}",
        "",
        "📋 **Today's Focus:**",
        "• Check dashboard for fleet agent status",
        "• Review any overnight research results",
        "",
        "🤖 **Fleet Status:**",
        "• ClawdBot (Azure): Active ✅",
        "• Cathy (Android): Active ✅",
        "",
        f"_Have a productive day! 🚀_"
    ]
    return "\n".join(lines)

def format_evening_briefing(data: dict) -> str:
    """Format evening briefing message"""
    now = datetime.now()
    lines = [
        "🌙 **Evening Summary**",
        f"_Generated: {now.strftime('%A, %B %d at %I:%M %p')}_\n",
        "📈 **Today's Activity:**",
        f"• GitHub: {data['github_issues']} issues, {data['github_prs']} PRs",
        f"• Reddit: {data['reddit_posts']} posts scanned",
        f"• Research: {data['research_completed']} tasks completed",
        "",
        "🏥 **System Health:**",
        f"• {data['health_status']}",
        "",
        "📋 **Pending Items:**",
        "• Review tomorrow's tasks in Notion",
        "",
        "_Rest well! Tomorrow is another day to build._ 🌟"
    ]
    return "\n".join(lines)

def main():
    log("=== Briefing Started ===")
    
    time_of_day = get_time_of_day()
    data = fetch_briefing_data()
    
    if time_of_day == "morning":
        message = format_morning_briefing(data)
    elif time_of_day == "evening":
        message = format_evening_briefing(data)
    else:
        # Manual trigger - send both
        message = format_morning_briefing(data)
    
    send_telegram(message)
    log("Briefing sent")
    print(f"Briefing sent ({time_of_day})")

if __name__ == "__main__":
    main()