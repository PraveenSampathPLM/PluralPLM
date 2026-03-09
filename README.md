# PLM Project

Enterprise PLM starter platform for process industries (CPG, Chemicals, Tyre/Rubber, Polymers, Paints, Food & Beverage).

## Tooling Versions

- Node.js: 22.18.0
- Postgres: 16.x
- Docker: 26.x

## Monorepo Structure

- `packages/frontend`: React 18 + TypeScript + Vite UI app
- `packages/backend`: Express + TypeScript + Prisma REST API
- `packages/shared`: Shared TS types
- `prisma/schema.prisma`: Data model
- `prisma/seed.ts`: Seed data

## Quick Start

1. `cp .env.example .env`
2. `docker-compose up -d`
3. `npm install`
4. `npm run prisma:migrate -w @plm/backend`
5. `npm run seed:dev`
6. `npm run dev`

## Seed Users

All users use password: `Password@123`

- `admin@plm.local` (System Admin)
- `plm@plm.local` (PLM Admin)
- `chemist@plm.local` (Formulation Chemist)
- `qa@plm.local` (QA Manager)
- `reg@plm.local` (Regulatory Affairs)

## Environment

The Docker compose file maps Postgres to `5433`, so the default dev `DATABASE_URL` uses:

`postgresql://postgres:postgres@127.0.0.1:5433/plm_project`

Keep `.env` and `packages/backend/.env` in sync.

## Migrations

Use `npm run prisma:migrate -w @plm/backend` for local development.
CI and production deploys use `npm run prisma:deploy -w @plm/backend`.

## Seed Modes

- `npm run seed:dev`: destructive reset, best for local dev
- `npm run seed:demo`: idempotent seed, safe to re-run on demo databases

## Initial API Surface

- `POST /api/auth/login`
- `GET/POST/PUT /api/items`
- `GET/POST /api/formulas`
- `GET /api/dashboard`

All non-auth endpoints require `Authorization: Bearer <token>`.
