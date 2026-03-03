from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Gateway
    openclaw_gateway_ws: str = "ws://127.0.0.1:18789"
    openclaw_gateway_token: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./dashboard.db"

    # Agent personas
    jarvis_model: str = "ollama-cloud-1/glm-5"
    wolff_model: str = "nvidia-pool/z-ai/glm4.7"
    dobby_model: str = "ollama-cloud-2/glm-5"
    claudy_model: str = "ollama-cloud-3/glm-5"
    fallback_model: str = "nvidia-pool/z-ai/glm4.7"

    # Notion
    notion_api_key: str = ""
    notion_openclaw_db: str = "3024fc92-d02d-8016-b4b5-ce4c5ad4b2e9"
    notion_personal_db: str = "3034fc92-d02d-80ca-bf20-da4f0ad9e576"
    notion_ideas_db: str = "3034fc92-d02d-8042-afd2-df675475a053"
    notion_sync_enabled: bool = True
    notion_sync_mode: str = "poll"
    notion_poll_interval_seconds: int = 60
    notion_max_requests_per_sec: int = 2

    # Self-healing
    healing_enabled: bool = True
    healing_poll_interval_seconds: int = 15
    healing_stuck_threshold_minutes: int = 5
    healing_max_retries: int = 3
    healing_nudge_timeout_seconds: int = 120

    # Backup
    backup_dir: str = "./backups"
    backup_retention_days: int = 30

    # Server
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    log_level: str = "INFO"
    log_format: str = "json"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
