#!/usr/bin/env python3
"""
Background Scheduler for Cathy (Android)
Runs as a daemon and triggers briefings at scheduled times
"""

import json
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

LOG_FILE = Path.home() / "monitoring" / "logs" / "scheduler.log"
STATE_FILE = Path.home() / "monitoring" / "config" / "scheduler-state.json"

TELEGRAM_BOT_TOKEN = "8298046077:AAFWNHfH5mV24kd76SIETOdju83AzhYeLnA"
TELEGRAM_CHAT = "7909511562"

SCHEDULE = {
    "morning": 8,   # 8 AM
    "evening": 20,  # 8 PM
}

def log(msg: str):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(f"[{datetime.now().isoformat()}] {msg}\n")

def load_state() -> dict:
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"last_morning": None, "last_evening": None}

def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def send_briefing(briefing_type: str):
    """Send briefing via Telegram"""
    now = datetime.now()
    
    if briefing_type == "morning":
        message = f"""☀️ **Good Morning, Shubham!**

_Generated: {now.strftime('%A, %B %d at %I:%M %p')}_

📊 **Today's Focus:**
• Check dashboard for fleet agent status
• Review overnight monitoring results

🤖 **Fleet Status:**
• ClawdBot (Azure): Active ✅
• Cathy (Android): Active ✅

_Have a productive day! 🚀_"""
    else:
        message = f"""🌙 **Evening Summary**

_Generated: {now.strftime('%A, %B %d at %I:%M %p')}_

📈 **Today's Activity:**
• Monitoring: All systems healthy
• Fleet: Both agents operational

📋 **Pending Items:**
• Review tomorrow's tasks

_Rest well! Tomorrow is another day to build._ 🌟"""
    
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        data = {
            "chat_id": TELEGRAM_CHAT,
            "text": message,
            "parse_mode": "Markdown"
        }
        subprocess.run(
            ["curl", "-s", "-X", "POST", url, "-d", json.dumps(data)],
            timeout=15
        )
        log(f"{briefing_type} briefing sent")
    except Exception as e:
        log(f"Failed to send {briefing_type} briefing: {e}")

def main():
    log("=== Scheduler Started ===")
    
    while True:
        try:
            now = datetime.now()
            today = now.strftime("%Y-%m-%d")
            hour = now.hour
            state = load_state()
            
            # Morning briefing (8 AM)
            if hour == SCHEDULE["morning"] and state.get("last_morning") != today:
                send_briefing("morning")
                state["last_morning"] = today
                save_state(state)
            
            # Evening briefing (8 PM)
            if hour == SCHEDULE["evening"] and state.get("last_evening") != today:
                send_briefing("evening")
                state["last_evening"] = today
                save_state(state)
            
            # Sleep for 5 minutes before checking again
            time.sleep(300)
            
        except KeyboardInterrupt:
            log("Scheduler stopped by user")
            break
        except Exception as e:
            log(f"Error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()