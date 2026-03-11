#!/usr/bin/env python3
"""
GitHub Monitor for ClawdBot
Watches repos for new issues, PRs, releases
Posts digest to Telegram via OpenClaw gateway
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Config
CONFIG_FILE = Path.home() / "monitoring" / "config" / "github-config.json"
STATE_FILE = Path.home() / "monitoring" / "config" / "github-state.json"
LOG_FILE = Path.home() / "monitoring" / "logs" / "github-monitor.log"

# Default repos to watch
DEFAULT_REPOS = [
    "openclaw/openclaw",
    "grp06/openclaw-studio",
    "jarvis-clawdbot/openclaw-studio",
]

# Telegram chat ID (from OpenClaw config)
TELEGRAM_CHAT = "7909511562"

def log(msg: str):
    """Append to log file"""
    timestamp = datetime.now().isoformat()
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")

def load_state() -> dict:
    """Load last-check state"""
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"last_check": None, "seen_issues": [], "seen_prs": [], "seen_releases": []}

def save_state(state: dict):
    """Save state to file"""
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def load_config() -> dict:
    """Load config or use defaults"""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return json.load(f)
    return {"repos": DEFAULT_REPOS, "enabled": True}

def run_gh_command(cmd: str) -> str:
    """Run gh CLI command"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout.strip()
    except Exception as e:
        log(f"gh command failed: {e}")
        return ""

def get_new_items(repo: str, state: dict) -> dict:
    """Fetch new issues, PRs, releases since last check"""
    new = {"issues": [], "prs": [], "releases": []}
    
    # Get recent issues
    issues = run_gh_command(f"gh issue list -R {repo} -L 10 --json number,title,state,createdAt,author --state all")
    if issues:
        try:
            for issue in json.loads(issues):
                key = f"{repo}#{issue['number']}"
                if key not in state["seen_issues"]:
                    new["issues"].append({
                        "repo": repo,
                        "number": issue["number"],
                        "title": issue["title"],
                        "state": issue["state"],
                        "created": issue["createdAt"],
                        "author": issue["author"]["login"]
                    })
                    state["seen_issues"].append(key)
        except Exception as e:
            log(f"Error parsing issues: {e}")
    
    # Get recent PRs
    prs = run_gh_command(f"gh pr list -R {repo} -L 10 --json number,title,state,createdAt,author --state all")
    if prs:
        try:
            for pr in json.loads(prs):
                key = f"{repo}#{pr['number']}"
                if key not in state["seen_prs"]:
                    new["prs"].append({
                        "repo": repo,
                        "number": pr["number"],
                        "title": pr["title"],
                        "state": pr["state"],
                        "created": pr["createdAt"],
                        "author": pr["author"]["login"]
                    })
                    state["seen_prs"].append(key)
        except Exception as e:
            log(f"Error parsing PRs: {e}")
    
    # Get recent releases
    releases = run_gh_command(f"gh release list -R {repo} -L 5 --json tagName,name,publishedAt,isPrerelease")
    if releases:
        try:
            for rel in json.loads(releases):
                key = f"{repo}@{rel['tagName']}"
                if key not in state["seen_releases"]:
                    new["releases"].append({
                        "repo": repo,
                        "tag": rel["tagName"],
                        "name": rel["name"],
                        "published": rel["publishedAt"],
                        "prerelease": rel["isPrerelease"]
                    })
                    state["seen_releases"].append(key)
        except Exception as e:
            log(f"Error parsing releases: {e}")
    
    return new

def send_telegram_message(message: str):
    """Send message via OpenClaw gateway"""
    # Use sessions_send through OpenClaw
    # For now, log and we'll set up proper delivery
    log(f"TELEGRAM: {message}")
    
    # Alternative: use curl to Telegram Bot API if token available
    # This would need BOT_TOKEN from config
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if bot_token:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            data = {
                "chat_id": TELEGRAM_CHAT,
                "text": message,
                "parse_mode": "Markdown"
            }
            subprocess.run(
                ["curl", "-s", "-X", "POST", url, "-d", json.dumps(data)],
                timeout=10
            )
            log("Message sent via Telegram API")
        except Exception as e:
            log(f"Failed to send Telegram: {e}")

def format_digest(new: dict) -> str:
    """Format findings as readable message"""
    lines = ["🔍 **GitHub Activity Digest**\n"]
    
    if new["issues"]:
        lines.append("📋 **New Issues:**")
        for issue in new["issues"]:
            emoji = "🟢" if issue["state"] == "open" else "⚫"
            lines.append(f"{emoji} `{issue['repo']}#{issue['number']}`: {issue['title']} by @{issue['author']}")
        lines.append("")
    
    if new["prs"]:
        lines.append("🔀 **New PRs:**")
        for pr in new["prs"]:
            emoji = "🟢" if pr["state"] == "open" else "⚫"
            lines.append(f"{emoji} `{pr['repo']}#{pr['number']}`: {pr['title']} by @{pr['author']}")
        lines.append("")
    
    if new["releases"]:
        lines.append("📦 **New Releases:**")
        for rel in new["releases"]:
            emoji = "⚠️" if rel["prerelease"] else "✅"
            lines.append(f"{emoji} `{rel['repo']}`: {rel['tag']} - {rel['name']}")
        lines.append("")
    
    if not any(new.values()):
        lines.append("No new activity since last check.")
    
    lines.append(f"\n_Checked at: {datetime.now().strftime('%Y-%m-%d %H:%M')}_")
    return "\n".join(lines)

def main():
    config = load_config()
    if not config.get("enabled", True):
        log("GitHub monitor disabled in config")
        return
    
    state = load_state()
    all_new = {"issues": [], "prs": [], "releases": []}
    
    for repo in config["repos"]:
        log(f"Checking {repo}...")
        new = get_new_items(repo, state)
        for key in ["issues", "prs", "releases"]:
            all_new[key].extend(new[key])
    
    # Save updated state
    # Keep only last 100 seen items to prevent unbounded growth
    for key in ["seen_issues", "seen_prs", "seen_releases"]:
        state[key] = state[key][-100:]
    save_state(state)
    
    # Send digest if there's new activity
    if any(all_new.values()):
        message = format_digest(all_new)
        send_telegram_message(message)
        log(f"Sent digest: {len(all_new['issues'])} issues, {len(all_new['prs'])} PRs, {len(all_new['releases'])} releases")
    else:
        log("No new activity")
    
    print(f"Check complete. Found: {len(all_new['issues'])} issues, {len(all_new['prs'])} PRs, {len(all_new['releases'])} releases")

if __name__ == "__main__":
    main()
