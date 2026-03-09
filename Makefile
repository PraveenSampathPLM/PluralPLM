.PHONY: dev build test seed migrate up down

up:
	docker compose up -d

down:
	docker compose down

migrate:
	npm run prisma:migrate -w @plm/backend

seed:
	npm run seed -w @plm/backend

dev:
	npm run dev

test:
	npm run test

build:
	npm run build
