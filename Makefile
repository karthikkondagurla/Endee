# ─── Pigeon × Endee — Developer Makefile ─────────────────────────────────────
# Usage:  make <target>
# Run `make help` to see all available commands.

.PHONY: help dev endee up down build logs restart clean dig digest test-rag

##  ── Local Dev ──────────────────────────────────────────────────────────────

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

dev: ## Start Next.js dev server (hot reload)
	npm run dev

endee: ## Start only the Endee vector DB container
	docker compose up endee-oss -d
	@echo "Endee running at http://localhost:8080"

##  ── Docker Full Stack ───────────────────────────────────────────────────────

up: ## Start full stack (Endee + Pigeon app) in background
	docker compose up -d
	@echo "Pigeon: http://localhost:3000"
	@echo "Endee:  http://localhost:8080"

down: ## Stop all containers
	docker compose down

build: ## Rebuild the pigeon-app image (no cache)
	docker compose build --no-cache pigeon-app

logs: ## Tail logs for all services
	docker compose logs -f

logs-app: ## Tail logs for pigeon-app only
	docker compose logs -f pigeon-app

logs-endee: ## Tail logs for Endee only
	docker compose logs -f endee-oss

restart: ## Restart all services
	docker compose restart

##  ── Utilities ───────────────────────────────────────────────────────────────

clean: ## Remove containers, volumes, and local .next build cache
	docker compose down -v
	rm -rf .next

digest: ## Manually trigger the daily digest agent
	@echo "Hitting /api/cron/digest..."
	curl -s -X GET http://localhost:3000/api/cron/digest \
		-H "Authorization: Bearer $${CRON_SECRET}" | jq .

test-rag: ## Smoke-test the RAG endpoint (set GROQ_API_KEY in .env.local first)
	@echo "Testing RAG endpoint..."
	curl -s -X POST http://localhost:3000/api/rag \
		-H "Content-Type: application/json" \
		-d '{"question":"What are the latest AI trends?","apiKey":"$(GROQ_API_KEY)"}' | head -c 500
