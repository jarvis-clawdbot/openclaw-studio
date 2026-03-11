#!/usr/bin/env python3
"""
Research Queue Processor for ClawdBot
Polls for research topics queued by Jarvis
Spawns researcher subagent for each topic
Delivers results via Telegram
"""

import json
import os
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
import time

# Config
QUEUE_FILE = Path.home() / "research-queue.json"
OUTPUT_DIR = Path.home() / "monitoring" / "research-output"
LOG_FILE = Path.home() / "monitoring" / "logs" / "research-queue.log"
STATE_FILE = Path.home() / "monitoring" / "config" / "research-state.json"

TELEGRAM_CHAT = "7909511562"

# OpenClaw gateway config
GATEWAY_HOST = "127.0.0.1"
GATEWAY_PORT = "18789"
GATEWAY_TOKEN = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")

def log(msg: str):
    timestamp = datetime.now().isoformat()
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")

def load_queue() -> list:
    """Load research queue"""
    if QUEUE_FILE.exists():
        with open(QUEUE_FILE) as f:
            return json.load(f)
    return []

def save_queue(queue: list):
    """Save queue back to file"""
    with open(QUEUE_FILE, "w") as f:
        json.dump(queue, f, indent=2)

def load_state() -> dict:
    """Load processing state"""
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"processed": [], "failed": []}

def save_state(state: dict):
    """Save state"""
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def spawn_researcher(topic: str, priority: str = "normal") -> str:
    """Spawn researcher subagent via OpenClaw CLI"""
    timeout = 3600 if priority == "high" else 1800
    
    task = f"""## Research Task: {topic}

**Priority:** {priority}
**Started:** {datetime.now().isoformat()}

## Instructions
1. Conduct thorough web research on this topic
2. Use web_search with 2s delays between calls
3. Fetch relevant pages with web_fetch
4. Synthesize findings into a comprehensive report
5. Include sources, key insights, and actionable takeaways
6. Keep report under 5000 words

## Output Format
- Executive Summary (3-5 bullets)
- Key Findings (organized by theme)
- Sources (with URLs)
- Recommendations (if applicable)
"""
    
    try:
        # Use OpenClaw sessions_spawn
        cmd = f'''
openclaw sessions spawn \\
  --agentId researcher \\
  --runtime subagent \\
  --mode run \\
  --label "queue-research-{int(time.time())}" \\
  --timeout {timeout} \\
  --task "{task.replace(chr(10), ' ').replace('"', '\\\\"')}"
'''
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode == 0:
            # Parse session key from output
            for line in result.stdout.split("\n"):
                if "sessionKey" in line or "childSessionKey" in line:
                    return line.strip()
            return "spawned"
        else:
            log(f"Spawn failed: {result.stderr}")
            return f"failed: {result.stderr}"
    
    except Exception as e:
        log(f"Exception spawning: {e}")
        return f"exception: {e}"

def upload_to_markdownbin(content: str, title: str) -> str:
    """Upload report to mdbin"""
    try:
        # Use mdbin.sivaramp.com (fallback service)
        cmd = f'''
curl -s -X POST https://mdbin.sivaramp.com/api/new \\
  -H "Content-Type: application/json" \\
  -d '{{"title": "{title}", "content": {json.dumps(content)}}}'
'''
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("url", "upload failed")
    except Exception as e:
        log(f"Upload failed: {e}")
    return "upload failed"

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
    log("=== Research Queue Processor Started ===")
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    queue = load_queue()
    state = load_state()
    
    if not queue:
        log("Queue is empty")
        print("Queue empty")
        return
    
    processed = 0
    
    # Process items (oldest first, respecting priority)
    queue.sort(key=lambda x: (x.get("priority", "normal") != "high", x.get("added", "")))
    
    for item in queue[:]:  # Iterate over copy
        topic = item.get("topic", "Unknown topic")
        priority = item.get("priority", "normal")
        added = item.get("added", "unknown")
        
        # Skip if already processed
        item_key = f"{topic}_{added}"
        if item_key in state["processed"]:
            queue.remove(item)
            continue
        
        # Skip if previously failed (max 2 retries)
        fail_count = sum(1 for f in state["failed"] if f.startswith(item_key))
        if fail_count >= 2:
            log(f"Skipping {topic} - failed {fail_count} times")
            queue.remove(item)
            continue
        
        log(f"Processing: {topic} (priority: {priority})")
        
        # Spawn researcher
        result = spawn_researcher(topic, priority)
        
        if "failed" in result or "exception" in result:
            log(f"Spawn failed: {result}")
            state["failed"].append(f"{item_key}:{result}")
            send_telegram_message(f"❌ Research failed: {topic}\n\nError: {result}")
        else:
            log(f"Spawned: {result}")
            send_telegram_message(
                f"🔬 **Research Started**\n\n"
                f"**Topic:** {topic}\n"
                f"**Priority:** {priority}\n"
                f"**Session:** `{result}`\n\n"
                f"_Will deliver results when complete._"
            )
            state["processed"].append(item_key)
            processed += 1
        
        # Remove from queue
        if item in queue:
            queue.remove(item)
        
        # Save progress
        save_queue(queue)
        save_state(state)
        
        # Rate limit: 1 research per 5 minutes
        if processed > 0:
            log("Waiting 5 min before next research task...")
            time.sleep(300)
    
    # Keep state bounded
    state["processed"] = state["processed"][-50:]
    state["failed"] = state["failed"][-20:]
    save_state(state)
    
    log(f"Processed {processed} items")
    print(f"Processed {processed} research tasks")

if __name__ == "__main__":
    main()
