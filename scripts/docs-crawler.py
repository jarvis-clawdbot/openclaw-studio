#!/usr/bin/env python3
"""
Documentation Crawler for ClawdBot
Fetches and summarizes new docs from OpenClaw, Anthropic, OpenAI, HuggingFace
Daily digest at 3 AM
"""

import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
import hashlib

# Config
CONFIG_FILE = Path.home() / "monitoring" / "config" / "docs-config.json"
STATE_FILE = Path.home() / "monitoring" / "config" / "docs-state.json"
CACHE_DIR = Path.home() / "monitoring" / "cache"
LOG_FILE = Path.home() / "monitoring" / "logs" / "docs-crawler.log"

DEFAULT_SOURCES = [
    {
        "name": "OpenClaw Docs",
        "url": "https://docs.openclaw.ai",
        "sitemap": "https://docs.openclaw.ai/sitemap.xml",
    },
    {
        "name": "Anthropic Docs",
        "url": "https://docs.anthropic.com",
        "sitemap": "https://docs.anthropic.com/sitemap.xml",
    },
    {
        "name": "OpenAI Platform",
        "url": "https://platform.openai.com/docs",
        "sitemap": None,  # No sitemap, use hardcoded pages
        "pages": [
            "/docs/api-reference",
            "/docs/guides",
            "/docs/new-models",
        ]
    },
    {
        "name": "HuggingFace Docs",
        "url": "https://huggingface.co/docs",
        "sitemap": None,
    },
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
    return {"seen_urls": [], "last_crawl": None}

def save_state(state: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def get_sitemap_urls(sitemap_url: str) -> list:
    """Extract URLs from sitemap"""
    try:
        cmd = f'curl -s "{sitemap_url}"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            urls = []
            for line in result.stdout.split("\n"):
                if "<loc>" in line:
                    url = line.split("<loc>")[1].split("</loc>")[0].strip()
                    urls.append(url)
            return urls[:50]  # Limit to 50 URLs per source
    except Exception as e:
        log(f"Error fetching sitemap {sitemap_url}: {e}")
    return []

def fetch_page(url: str) -> str:
    """Fetch page content"""
    try:
        cmd = f'curl -s -A "ClawdBot-DocsCrawler/1.0" "{url}"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            # Extract text (strip HTML)
            text = subprocess.run(
                'sed -e "s/<[^>]*>//g"',
                shell=True,
                input=result.stdout,
                capture_output=True,
                text=True
            ).stdout.strip()
            return text[:5000]  # Limit content
    except Exception as e:
        log(f"Error fetching {url}: {e}")
    return ""

def hash_content(content: str) -> str:
    """Create hash of content for change detection"""
    return hashlib.md5(content.encode()).hexdigest()

def summarize_changes(source: str, old_hash: str, new_hash: str, sample: str) -> str:
    """Create brief summary of what changed"""
    if old_hash is None:
        return f" **New page detected**\n\nSample:\n_{sample[:200]}..._"
    elif old_hash != new_hash:
        return f"📝 **Updated**\n\nSample:\n_{sample[:200]}..._"
    return None

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
    log("=== Docs Crawler Started ===")
    
    CACHE_DIR.mkdir(exist_ok=True)
    
    # Load config
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            config = json.load(f)
        sources = config.get("sources", DEFAULT_SOURCES)
    else:
        sources = DEFAULT_SOURCES
    
    state = load_state()
    changes = []
    
    for source in sources:
        log(f"Crawling {source['name']}...")
        urls_to_check = []
        
        # Get URLs from sitemap or hardcoded list
        if source.get("sitemap"):
            urls_to_check = get_sitemap_urls(source["sitemap"])
        elif source.get("pages"):
            base = source["url"]
            urls_to_check = [f"{base}{page}" for page in source["pages"]]
        else:
            # Just check main page
            urls_to_check = [source["url"]]
        
        for url in urls_to_check[:20]:  # Limit per source
            content = fetch_page(url)
            if not content:
                continue
            
            content_hash = hash_content(content)
            url_key = url
            
            # Check if we've seen this URL before
            old_hash = None
            cache_file = CACHE_DIR / f"{hashlib.md5(url.encode()).hexdigest()}.json"
            if cache_file.exists():
                with open(cache_file) as f:
                    cache_data = json.load(f)
                    old_hash = cache_data.get("hash")
            
            # Detect changes
            if old_hash != content_hash:
                sample = content[:300].replace("\n", " ")
                changes.append({
                    "source": source["name"],
                    "url": url,
                    "type": "new" if old_hash is None else "updated",
                    "sample": sample,
                })
            
            # Update cache
            with open(cache_file, "w") as f:
                json.dump({"hash": content_hash, "checked": datetime.now().isoformat()}, f)
            
            if url_key not in state["seen_urls"]:
                state["seen_urls"].append(url_key)
        
        # Keep seen URLs bounded
        state["seen_urls"] = state["seen_urls"][-500:]
    
    save_state(state)
    
    log(f"Found {len(changes)} changes")
    
    # Send digest
    if changes:
        lines = ["📚 **Documentation Updates**\n"]
        for change in changes[:10]:  # Max 10 in digest
            emoji = "🆕" if change["type"] == "new" else "📝"
            lines.append(f"{emoji} **{change['source']}**")
            lines.append(f"   {change['url']}")
            lines.append(f"   _{change['sample'][:150]}..._\n")
        
        lines.append(f"\n_Checked at: {datetime.now().strftime('%Y-%m-%d %H:%M')}_")
        message = "\n".join(lines)
        send_telegram_message(message)
        print(f"Sent digest: {len(changes)} changes")
    else:
        log("No changes detected")
        print("No changes")

if __name__ == "__main__":
    main()
