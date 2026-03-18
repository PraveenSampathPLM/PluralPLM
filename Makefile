.PHONY: dev build test seed migrate \
        up down \
        prod-up prod-down prod-build prod-logs prod-seed prod-shell

# ─── Development ──────────────────────────────────────────────────────────────

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

typecheck:
	npm run typecheck

# ─── Database (local dev) ─────────────────────────────────────────────────────

migrate:
	npm run prisma:migrate -w @plm/backend

seed:
	npm run seed -w @plm/backend

seed-dev:
	npm run seed:dev -w @plm/backend

seed-demo:
	npm run seed:demo -w @plm/backend

# ─── Docker — dev infra only (Postgres + Redis) ───────────────────────────────

up:
	docker compose up -d

down:
	docker compose down

# ─── Docker — full production stack ───────────────────────────────────────────
# Requires .env.production (copy from .env.production.example and fill in secrets)

prod-build:
	docker compose -f docker-compose.prod.yml --env-file .env.production build

prod-up:
	docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml --env-file .env.production down

prod-logs:
	docker compose -f docker-compose.prod.yml --env-file .env.production logs -f

prod-seed:
	docker exec plm-backend sh -c "npm run seed:demo -w @plm/backend"

prod-shell:
	docker exec -it plm-backend sh
