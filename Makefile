.PHONY: install dev dev-backend dev-frontend test test-backend test-frontend migrate migration seed backup clean docker-up docker-down help

# Default target
help:
	@echo "Dashboard Vision - Makefile Commands"
	@echo ""
	@echo "  install        Install all dependencies (frontend + backend)"
	@echo "  dev            Start development servers (backend + frontend)"
	@echo "  dev-backend    Start backend server only"
	@echo "  dev-frontend   Start frontend server only"
	@echo "  test           Run all tests"
	@echo "  test-backend   Run backend tests only"
	@echo "  test-frontend  Run frontend tests only"
	@echo "  migrate        Run database migrations"
	@echo "  migration      Create new migration (use msg='description')"
	@echo "  seed           Seed database with default agents"
	@echo "  backup         Run backup script"
	@echo "  clean          Clean build artifacts"
	@echo "  docker-up      Start with Docker Compose"
	@echo "  docker-down    Stop Docker Compose"

# Install all dependencies
install:
	@echo "Installing frontend dependencies..."
	npm install
	@echo "Installing backend dependencies..."
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
	@echo "Done!"

# Start development servers (both in parallel)
dev:
	@echo "Starting backend on :8000 and frontend on :3000..."
	@trap 'kill 0' INT; \
	(cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) & \
	npm run dev & \
	wait

# Start backend server only
dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Start frontend server only
dev-frontend:
	npm run dev

# Run all tests
test: test-backend test-frontend

# Run backend tests only
test-backend:
	cd backend && .venv/bin/pytest -v

# Run frontend tests only
test-frontend:
	npm test

# Database migration
migrate:
	cd backend && .venv/bin/alembic upgrade head

# Create new migration
migration:
	cd backend && .venv/bin/alembic revision --autogenerate -m "$(msg)"

# Seed database with default agents
seed:
	cd backend && .venv/bin/python -m app.utils.seed

# Run backup
backup:
	bash scripts/backup.sh

# Clean build artifacts
clean:
	rm -rf .next node_modules
	rm -rf backend/.venv backend/__pycache__
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Docker
docker-up:
	docker-compose up --build

docker-down:
	docker-compose down
