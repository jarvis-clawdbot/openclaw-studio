# Dashboard Vision

Multi-agent orchestration dashboard for OpenClaw. Forked from openclaw-studio with additional features.

## Features

### Existing (from openclaw-studio)
- ✅ Gateway WebSocket proxy
- ✅ Agent fleet management (list, create, delete, rename)
- ✅ Chat/transcript streaming with tool call rendering
- ✅ Exec approval workflows
- ✅ Cron job management
- ✅ Device auth + challenge-nonce signing
- ✅ Tailscale remote gateway support

### New Features
- 🆕 **Topology visualization** - React Flow + ELK layout showing agent relationships
- 🆕 **Self-healing engine** - Stuck detection, nudging, automatic recovery
- 🆕 **Usage analytics** - Token tracking per agent/model
- 🆕 **Session replay** - Timeline scrubber + playback
- 🆕 **Notion sync** - Bidirectional task sync (polling-based)
- 🆕 **Task board** - Kanban with drag-and-drop
- 🆕 **Named agent personas** - Jarvis, Wolff, Dobby, Claudy

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.9+
- OpenClaw Gateway running on `ws://127.0.0.1:18789`

### Development

```bash
# Install dependencies
make install

# Start both servers
make dev

# Or start individually
make dev-backend   # FastAPI on :8000
make dev-frontend  # Next.js on :3000
```

### Docker

```bash
# Build and run
make docker-up

# Stop
make docker-down
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `OPENCLAW_GATEWAY_WS` - Gateway WebSocket URL
- `OPENCLAW_GATEWAY_TOKEN` - Gateway auth token
- `NOTION_API_KEY` - Notion integration token (optional)

## Project Structure

```
dashboard-vision/
├── src/                    # Frontend (Next.js 16)
│   ├── app/               # Pages (topology, tasks, analytics, replay)
│   ├── components/        # React components
│   ├── stores/            # Zustand state management
│   └── lib/               # Utilities
├── backend/               # FastAPI Python sidecar
│   ├── app/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Background workers
│   │   └── models/       # SQLAlchemy models
│   └── requirements.txt
├── Makefile              # Development commands
└── docker-compose.yml    # Container orchestration
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/agents` | List agents |
| `GET /api/tasks` | List tasks |
| `POST /api/tasks` | Create task |
| `GET /api/analytics/usage` | Usage statistics |
| `GET /api/replay/sessions` | Session list |
| `WS /ws` | Real-time updates |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   FastAPI       │────▶│   OpenClaw      │
│   (Next.js)     │     │   Backend       │     │   Gateway       │
│   :3000         │     │   :8000         │     │   :18789        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │  (gateway proxy)      │  (self-healing, Notion sync)
         │                       │
         └───────────────────────┘
```

## Agent Personas

| Persona | Role | Default Model |
|---------|------|--------------|
| Jarvis | Orchestrator | GLM-5 |
| Wolff | Researcher | GLM-4.7 |
| Dobby | Builder | GLM-5 |
| Claudy | Reviewer | GLM-5 |

## License

MIT
