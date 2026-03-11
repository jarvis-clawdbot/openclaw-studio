#!/usr/bin/env python3
"""
Token Analytics for ClawdBot
Aggregates daily token usage, cost trends, anomaly detection
Daily report at 6 AM
"""

import json
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
import statistics

# Config
LOG_FILE = Path.home() / "monitoring" / "logs" / "token-analytics.log"
OUTPUT_DIR = Path.home() / "monitoring" / "analytics"
STATE_FILE = Path.home() / "monitoring" / "config" / "analytics-state.json"

TELEGRAM_CHAT = "7909511562"

# OpenClaw paths
OPENCLAW_DIR = Path.home().parent / ".openclaw"  # ~/.openclaw
SESSION_LOGS_DIR = OPENCLAW_DIR / "agents"

def log(msg: str):
    timestamp = datetime.now().isoformat()
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")

def get_session_logs() -> list:
    """Find all session log files"""
    logs = []
    if SESSION_LOGS_DIR.exists():
        for agent_dir in SESSION_LOGS_DIR.iterdir():
            if agent_dir.is_dir():
                sessions_dir = agent_dir / "sessions"
                if sessions_dir.exists():
                    for log_file in sessions_dir.glob("*.jsonl"):
                        logs.append(log_file)
    return logs

def parse_session_log(log_path: Path) -> dict:
    """Parse a session log file for token usage"""
    data = {
        "total_tokens": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "cost": 0.0,
        "requests": 0,
        "model": "unknown",
    }
    
    try:
        with open(log_path) as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    if entry.get("type") == "tool-result":
                        # Extract token info from tool results
                        if "usage" in entry:
                            usage = entry["usage"]
                            data["total_tokens"] += usage.get("totalTokens", 0)
                            data["input_tokens"] += usage.get("promptTokens", 0)
                            data["output_tokens"] += usage.get("completionTokens", 0)
                        data["requests"] += 1
                except:
                    continue
    except Exception as e:
        log(f"Error parsing {log_path}: {e}")
    
    return data

def estimate_cost(tokens: int, model: str) -> float:
    """Estimate cost based on model pricing"""
    # Rough pricing per 1M tokens
    pricing = {
        "glm-5": 1.0,
        "qwen": 0.5,
        "claude": 3.0,
        "gemini": 0.3,
        "deepseek": 0.5,
        "kimi": 0.5,
    }
    
    rate = 1.0  # Default
    for model_name, price in pricing.items():
        if model_name in model.lower():
            rate = price
            break
    
    return (tokens / 1_000_000) * rate

def detect_anomaly(current: float, history: list) -> bool:
    """Detect if current usage is anomalous"""
    if len(history) < 3:
        return False
    
    mean = statistics.mean(history)
    stdev = statistics.stdev(history) if len(history) > 1 else 0
    
    # Anomaly if > 2 standard deviations above mean
    if stdev > 0 and current > mean + (2 * stdev):
        return True
    return False

def send_telegram_message(message: str):
    """Send via Telegram Bot API"""
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if bot_token:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            data = {
                "chat_id": TELEGRAM_CHAT,
                "text": message,
                "parse_mode": "Markdown",
            }
            subprocess.run(
                ["curl", "-s", "-X", "POST", url, "-d", json.dumps(data)],
                timeout=10
            )
            log("Message sent via Telegram API")
        except Exception as e:
            log(f"Failed to send Telegram: {e}")

def main():
    log("=== Token Analytics Started ===")
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    # Get all session logs
    logs = get_session_logs()
    log(f"Found {len(logs)} session logs")
    
    # Aggregate by agent
    by_agent = {}
    today = datetime.now().date()
    
    for log_path in logs:
        # Extract agent name from path
        parts = log_path.parts
        try:
            agent_idx = parts.index("agents") + 1
            agent_name = parts[agent_idx]
        except:
            agent_name = "unknown"
        
        if agent_name not in by_agent:
            by_agent[agent_name] = {
                "total_tokens": 0,
                "cost": 0.0,
                "requests": 0,
                "sessions": 0,
            }
        
        data = parse_session_log(log_path)
        by_agent[agent_name]["total_tokens"] += data["total_tokens"]
        by_agent[agent_name]["cost"] += estimate_cost(data["total_tokens"], data["model"])
        by_agent[agent_name]["requests"] += data["requests"]
        by_agent[agent_name]["sessions"] += 1
    
    # Calculate totals
    total_tokens = sum(a["total_tokens"] for a in by_agent.values())
    total_cost = sum(a["cost"] for a in by_agent.values())
    total_requests = sum(a["requests"] for a in by_agent.values())
    
    # Load history for anomaly detection
    history_file = OUTPUT_DIR / "daily-history.json"
    if history_file.exists():
        with open(history_file) as f:
            history = json.load(f)
    else:
        history = []
    
    # Check for anomalies
    anomalies = []
    for agent, data in by_agent.items():
        agent_history = [h.get(agent, {}).get("tokens", 0) for h in history[-7:]]
        if detect_anomaly(data["total_tokens"], agent_history):
            anomalies.append(agent)
    
    # Add today to history
    today_record = {
        today.isoformat(): {
            agent: {"tokens": data["total_tokens"], "cost": data["cost"]}
            for agent, data in by_agent.items()
        }
    }
    history.append(today_record)
    history = history[-30:]  # Keep 30 days
    with open(history_file, "w") as f:
        json.dump(history, f, indent=2)
    
    # Format report
    lines = ["📊 **Token Analytics Report**\n"]
    lines.append(f"**Date:** {today.strftime('%Y-%m-%d')}\n")
    
    lines.append("**Summary:**")
    lines.append(f"• Total Tokens: {total_tokens:,}")
    lines.append(f"• Est. Cost: ${total_cost:.2f}")
    lines.append(f"• Total Requests: {total_requests:,}")
    lines.append(f"• Active Agents: {len(by_agent)}\n")
    
    lines.append("**By Agent:**")
    for agent, data in sorted(by_agent.items(), key=lambda x: x[1]["total_tokens"], reverse=True):
        lines.append(f"• `{agent}`: {data['total_tokens']:,} tokens (${data['cost']:.2f}) - {data['sessions']} sessions")
    
    if anomalies:
        lines.append("\n⚠️ **Anomalies Detected:**")
        for agent in anomalies:
            lines.append(f"• `{agent}` - unusual spike in usage")
    
    lines.append(f"\n_Report generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}_")
    
    message = "\n".join(lines)
    
    # Save full report
    report_file = OUTPUT_DIR / f"analytics-{today.isoformat()}.md"
    with open(report_file, "w") as f:
        f.write(message)
    
    # Send via Telegram
    send_telegram_message(message)
    
    log(f"Report: {total_tokens:,} tokens, ${total_cost:.2f}")
    print(f"Analytics complete: {total_tokens:,} tokens, ${total_cost:.2f}")
    
    if anomalies:
        print(f"Anomalies: {', '.join(anomalies)}")

if __name__ == "__main__":
    main()
