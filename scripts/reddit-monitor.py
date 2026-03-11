#!/usr/bin/env python3
"""
Reddit Monitor for ClawdBot
Scans subreddits for mentions, trends, new tools
Daily digest to Telegram
"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
import time

# Config
CONFIG_FILE = Path.home() / "monitoring" / "config" / "reddit-config.json"
STATE_FILE = Path.home() / "monitoring" / "config" / "reddit-state.json"
LOG_FILE = Path.home() / "monitoring" / "logs" / "reddit-monitor.log"

DEFAULT_SUBREDDITS = [
    "OpenClaw",
    "LocalLLaMA",
    "artificial",
    "MachineLearning",
    "singularity",
]

DEFAULT_KEYWORDS = [
    "OpenClaw",
    "multi-agent",
    "agent framework",
    "autonomous agent",
    "AI agent",
    "LangChain",
    "AutoGen",
    "CrewAI",
]

TELEGRAM_CHAT = "7909511562"

def log(msg: str):
    timestamp = datetime.now().isoformat()
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")

def load_state() -> dict:
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"seen_posts": [], "last_scan": None}

def save_state(state: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def search_reddit(subreddit: str, keywords: list) -> list:
    """Search subreddit for keywords using pushshift or Reddit API"""
    results = []
    
    # Use Reddit search via curl (no API key needed for basic search)
    for keyword in keywords:
        try:
            url = f"https://www.reddit.com/r/{subreddit}/search.json?q={keyword}&sort=new&limit=10&restrict_sr=1"
            cmd = f'curl -s -A "ClawdBot/1.0" "{url}"'
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
            
            if result.returncode == 0:
                data = json.loads(result.stdout)
                for post in data.get("data", {}).get("children", []):
                    post_data = post.get("data", {})
                    results.append({
                        "title": post_data.get("title", ""),
                        "url": f"https://reddit.com{post_data.get('permalink', '')}",
                        "subreddit": subreddit,
                        "keyword": keyword,
                        "score": post_data.get("score", 0),
                        "created": post_data.get("created_utc", 0),
                        "author": post_data.get("author", "[deleted]"),
                    })
                    time.sleep(1)  # Rate limit
        except Exception as e:
            log(f"Error searching r/{subreddit} for '{keyword}': {e}")
    
    return results

def filter_new_posts(posts: list, state: dict) -> list:
    """Filter out already-seen posts"""
    new_posts = []
    for post in posts:
        key = post["url"]
        if key not in state["seen_posts"]:
            # Only include posts from last 48 hours
            age_hours = (datetime.now().timestamp() - post["created"]) / 3600
            if age_hours < 48:
                new_posts.append(post)
                state["seen_posts"].append(key)
    
    # Keep only last 200 seen to prevent unbounded growth
    state["seen_posts"] = state["seen_posts"][-200:]
    return new_posts

def format_digest(posts: list) -> str:
    """Format as readable message"""
    if not posts:
        return "📱 **Reddit Monitor**\n\nNo new relevant posts in the last 48 hours."
    
    lines = ["📱 **Reddit Intelligence Digest**\n"]
    
    # Group by subreddit
    by_sub = {}
    for post in posts:
        sub = post["subreddit"]
        if sub not in by_sub:
            by_sub[sub] = []
        by_sub[sub].append(post)
    
    for sub, sub_posts in sorted(by_sub.items()):
        lines.append(f"**r/{sub}:**")
        for post in sub_posts[:5]:  # Max 5 per subreddit
            lines.append(f"• [{post['title']}]({post['url']}) ⬆️{post['score']}")
        lines.append("")
    
    lines.append(f"_Found {len(posts)} relevant posts | {datetime.now().strftime('%Y-%m-%d %H:%M')}_")
    return "\n".join(lines)

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
                "disable_web_page_preview": False
            }
            subprocess.run(
                ["curl", "-s", "-X", "POST", url, "-d", json.dumps(data)],
                timeout=10
            )
            log("Message sent via Telegram API")
        except Exception as e:
            log(f"Failed to send Telegram: {e}")

def main():
    log("=== Reddit Monitor Started ===")
    
    # Load config
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            config = json.load(f)
    else:
        config = {
            "subreddits": DEFAULT_SUBREDDITS,
            "keywords": DEFAULT_KEYWORDS,
            "enabled": True
        }
    
    if not config.get("enabled", True):
        log("Reddit monitor disabled")
        return
    
    state = load_state()
    all_posts = []
    
    for subreddit in config["subreddits"]:
        log(f"Scanning r/{subreddit}...")
        posts = search_reddit(subreddit, config["keywords"])
        all_posts.extend(posts)
        time.sleep(2)  # Be nice to Reddit
    
    # Filter new posts
    new_posts = filter_new_posts(all_posts, state)
    save_state(state)
    
    log(f"Found {len(all_posts)} total, {len(new_posts)} new")
    
    # Send digest
    if new_posts:
        message = format_digest(new_posts)
        send_telegram_message(message)
        print(f"Sent digest: {len(new_posts)} posts")
    else:
        log("No new posts to report")
        print("No new posts")

if __name__ == "__main__":
    main()
