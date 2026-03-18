# Plural PLM

Enterprise Product Lifecycle Management platform for process industries — Food & Beverage, CPG, Chemicals, Paints, Tyre/Rubber, Polymers.

<img width="1709" height="889" alt="image" src="https://github.com/user-attachments/assets/fff4f1e8-a9d1-4408-af5e-756faefd8035" />


Built with **React 18 + TypeScript + Vite** (frontend) and **Express + Prisma + PostgreSQL** (backend).

---

## Features

| Module | Description |
|---|---|
| **Materials (Items)** | Material master with lifecycle status, attributes, BOM, and digital thread |
| **Formulations** | Multi-level formula builder with ingredient breakdown and version history |
| **Finished Goods** | FG items with linked formula and BOM structure |
| **NPD Projects** | Stage-gate new product development (Idea → Concept → Development → Launch) |
| **Changes** | Change requests with workflow sign-off and affected object tracking |
| **Releases** | Release packages with readiness checks and linked BOM/documents |
| **Specifications** | Parameter-based spec sheets (Physico-chemical, Nutritional, Regulatory) |
| **Documents** | File-attached document control with version history |
| **Labeling** | Label template builder — auto-generates ingredient statement, allergens, and nutrition from formula |
| **Artworks** | Artwork/packaging file management with approval workflow |
| **Reports** | KPI dashboard, change aging, release readiness, NPD status, and CSV export |
| **Configuration** | Containers, UOMs, numbering sequences, attributes, workflow templates |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser                                    │
│  React 18 + TypeScript + Vite + TanStack    │
└──────────────┬──────────────────────────────┘
               │ HTTPS :80
┌──────────────▼──────────────────────────────┐
│  Nginx                                      │
│  • Serves /  → React SPA (static)           │
│  • Proxies /api → backend:4000              │
└──────────────┬──────────────────────────────┘
               │ HTTP :4000
┌──────────────▼──────────────────────────────┐
│  Express API (Node 22)                      │
│  Prisma ORM + JWT auth + Zod validation     │
└──────┬────────────────────┬─────────────────┘
       │                    │
┌──────▼──────┐   ┌─────────▼───────┐
│ PostgreSQL  │   │ Redis           │
│ 16          │   │ 7 (sessions/    │
│             │   │  future queue)  │
└─────────────┘   └─────────────────┘
```

---

## Quick Start — Docker (Production)

The fastest way to get a full working instance running.

### Prerequisites

- Docker & Docker Compose (or Colima on macOS: `brew install colima docker && colima start`)

### 1. Clone the repo

```bash
git clone https://github.com/your-org/plm-project.git
cd plm-project
```

### 2. Configure environment

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set at minimum:

```env
POSTGRES_PASSWORD=your-strong-db-password
JWT_SECRET=your-secret-min-32-chars   # openssl rand -base64 48
```

### 3. Start all services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

This will:
- Build the backend (TypeScript → Node.js)
- Build the frontend (Vite → Nginx)
- Start PostgreSQL, Redis, backend API, and frontend
- Run database migrations automatically on first start

### 4. (Optional) Load demo data

```bash
docker exec plm-backend sh -c "npm run seed:demo -w @plm/backend"
```

### 5. Open the app

Navigate to `http://localhost` (or the IP/hostname of your server).

**Default credentials after seeding:**

| Email | Role | Password |
|---|---|---|
| `admin@plm.local` | System Admin | `Password@123` |
| `plm@plm.local` | PLM Admin | `Password@123` |
| `chemist@plm.local` | Formulation Chemist | `Password@123` |
| `qa@plm.local` | QA Manager | `Password@123` |
| `reg@plm.local` | Regulatory Affairs | `Password@123` |

> **Change all passwords immediately after first login in production.**

---

## Development Setup

### Prerequisites

- Node.js 22.x (`nvm install 22`)
- Docker / Colima (for PostgreSQL + Redis)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the database

```bash
# macOS with Colima
colima start
docker compose up -d

# Or if Docker Desktop is installed
docker compose up -d
```

### 3. Configure environment

```bash
cp .env.example .env
# The default .env works with the docker-compose.yml (Postgres on port 5433)
```

### 4. Run migrations and seed

```bash
npm run prisma:migrate -w @plm/backend   # creates + applies migrations
npm run seed:dev                          # destructive reset with dev data
```

### 5. Start dev servers

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

---

## Environment Variables

### Development (`.env` at repo root)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5433/plm_project` | Postgres connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | `change-me` | JWT signing secret |
| `JWT_EXPIRES_IN` | `1h` | Token TTL |
| `PORT` | `4000` | Backend server port |
| `VITE_API_URL` | `http://localhost:4000/api` | API base URL (baked into frontend at build time) |
| `FILES_ROOT` | `./storage` | Root path for file uploads |

### Production (`.env.production`)

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | **Yes** | Database password |
| `JWT_SECRET` | **Yes** | Minimum 32 characters |
| `POSTGRES_DB` | No (default: `plm_project`) | Database name |
| `POSTGRES_USER` | No (default: `postgres`) | Database user |
| `JWT_EXPIRES_IN` | No (default: `8h`) | Token TTL |
| `APP_PORT` | No (default: `80`) | Host port for the web interface |

---

## Project Structure

```
plm-project/
├── packages/
│   ├── backend/              # Express API
│   │   ├── src/
│   │   │   ├── routes/       # One file per domain (items, formulas, npd, ...)
│   │   │   ├── services/     # Shared business logic
│   │   │   ├── middleware/   # Auth, error handling
│   │   │   └── server.ts     # Entry point
│   │   └── storage/          # Uploaded files (mounted as Docker volume)
│   │
│   └── frontend/             # React SPA
│       └── src/
│           ├── app/          # Router
│           ├── features/     # One directory per domain page
│           ├── components/   # Shared UI components
│           ├── store/        # Zustand stores
│           └── lib/          # API client, utilities
│
├── prisma/
│   ├── schema.prisma         # Data model
│   ├── migrations/           # SQL migrations
│   └── seed.ts               # Seed script
│
├── Dockerfile.backend        # Multi-stage backend image
├── Dockerfile.frontend       # Vite build + Nginx image
├── nginx.conf                # Nginx: SPA routing + /api proxy
├── docker-compose.yml        # Dev: Postgres + Redis only
└── docker-compose.prod.yml   # Prod: full stack (all 4 services)
```

---

## Useful Commands

```bash
# Development
npm run dev                              # Start frontend + backend in watch mode
npm run build                            # Build both packages
npm run typecheck                        # TypeScript check across all packages

# Database
npm run prisma:migrate -w @plm/backend  # Create + apply a new migration (dev)
npm run prisma:deploy -w @plm/backend   # Apply pending migrations (CI/prod)
npm run seed:dev                         # Destructive seed (local dev)
npm run seed:demo                        # Idempotent seed (demo/staging)

# Docker (dev infra only)
make up                                  # Start Postgres + Redis
make down                                # Stop containers

# Docker (full production stack)
make prod-up                             # Build + start full prod stack
make prod-down                           # Stop prod stack
make prod-logs                           # Tail all service logs
make prod-seed                           # Seed demo data into prod DB
```

---

## API Overview

All endpoints except `/api/auth/login` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate, returns JWT |
| `GET/POST` | `/api/items` | Material master |
| `GET/POST` | `/api/formulas` | Formulations |
| `GET/POST` | `/api/fg` | Finished goods |
| `GET/POST` | `/api/npd` | NPD projects + gate reviews |
| `GET/POST` | `/api/changes` | Change requests |
| `GET/POST` | `/api/releases` | Release packages |
| `GET/POST` | `/api/specifications` | Spec sheets |
| `GET/POST` | `/api/documents` | Document control |
| `GET/POST` | `/api/labels` | Label templates |
| `GET` | `/api/labels/formulas/:id` | Auto-generate label data from formula |
| `GET/POST` | `/api/artworks` | Artwork / packaging files |
| `GET` | `/api/reports/kpis` | KPI summary |
| `GET` | `/api/dashboard` | Dashboard summary |
| `GET` | `/api/config` | System configuration |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router v6, Zustand, Zod |
| Backend | Node.js 22, Express 5, TypeScript, Prisma ORM, Zod, JWT, Multer |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Containerisation | Docker, Nginx 1.27 |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run `npm run typecheck` before committing
4. Open a pull request

---

## License

GNU General Public License v3.0
