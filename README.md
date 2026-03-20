# Plural PLM

> **The source-available Product Lifecycle Management platform built for process industries.**

Plural PLM gives food & beverage, CPG, chemical, paint, rubber, and polymer manufacturers a single system of record — from raw material to shelf. Formula management, stage-gate NPD, regulatory labeling, change control, and release management, all in one place.

<img width="1709" height="889" alt="image" src="https://github.com/user-attachments/assets/99787e80-3a0b-4053-a851-3fb93155d8c4" />

[![License: Non-Commercial](https://img.shields.io/badge/License-Non--Commercial-orange.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-22-green.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](docker-compose.prod.yml)

---

## Why Plural PLM?

Most PLM tools are built for discrete manufacturing — mechanical parts, assemblies, BOMs with counts. **Process industries are different.** Ingredients have percentages. Formulas have multiple versions in parallel development. Labels must declare allergens. Products go through gate reviews before launch.

Plural PLM is purpose-built for process:

| Pain point | How Plural solves it |
|---|---|
| Formula versions scattered in spreadsheets | Versioned formula builder with approval workflows and full audit trail |
| Manual ingredient statement preparation | Auto-generates FSSAI/EU/FDA-compliant ingredient declarations from formula weights |
| No visibility into NPD progress | Stage-gate project management (Idea → Concept → Development → Launch) with gate review sign-offs |
| Change requests lost in email | Structured change control with affected object tracking and multi-role sign-off |
| Specs, docs, and labels in different systems | Unified document control, spec sheets, and label templates — all linked to the formula |
| Onboarding a new ERP takes 12+ months | Docker-based deployment, self-hosted in under 10 minutes, no commerical dependencies |

---

## Key Modules

### Formulation Management
Build multi-level formulas with ingredients, quantities, and processing instructions. Every change is versioned. Compare revisions side-by-side. Digital thread links the formula to its raw materials, specifications, documents, changes, releases, and NPD project — all in one view.

### NPD Stage-Gate
Run structured new product development with configurable gate criteria. Must-meet and should-meet criteria evaluated at each gate review. Gate 5 (Launch GO) automatically triggers a release request. FG items and formulas are created as deliverables within the project, not manual fields.

### Regulatory Labeling
Link a label template to a formula and click **Generate** — Plural recursively walks the entire formula tree, sorts ingredients by weight (compliant with FSSAI, EU 1169, FDA), detects allergens from material attributes, and populates the full label: ingredient statement, allergen declaration, nutrition panel, shelf life, country of origin, batch format. Edit and save as a numbered label document.

### Change Control
Raise change requests, attach affected materials/formulas/documents, route through workflow sign-off, and link to downstream releases. Full audit trail on every object.

### Release Management
Package a set of BOMs, formulas, and documents into a release request. Track readiness by linked object. Release reports show percentage readiness per release across the portfolio.

### Compliance & Specifications
Attach parameter-based specification sheets (physico-chemical, nutritional, regulatory) to materials and formulas. Compliance module checks formula specs against target ranges.

### Enterprise Reporting
Out-of-the-box reports: KPI dashboard, change aging, release readiness, NPD pipeline status, FG items missing formulas, items by lifecycle status. One-click CSV export.

### Digital Twin of the Product with Traceability
<img width="1446" height="606" alt="image" src="https://github.com/user-attachments/assets/16cdbf6f-b525-4564-9861-d7f1ed9915c4" />

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser                                    │
│  React 18 · TypeScript · TanStack Query     │
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
│  Prisma ORM · JWT auth · Zod validation     │
└──────┬────────────────────┬─────────────────┘
       │                    │
┌──────▼──────┐   ┌─────────▼──────┐
│ PostgreSQL  │   │ Redis          │
│ 16          │   │ 7              │
└─────────────┘   └────────────────┘
```

---

## Get Running in 3 Commands

```bash
# 1. Clone
git clone https://github.com/PraveenSampathPLM/PluralPLM.git && cd PluralPLM

# 2. Configure (set POSTGRES_PASSWORD and JWT_SECRET)
cp .env.production.example .env.production && nano .env.production

# 3. Launch
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Then load demo data:
```bash
docker exec plm-backend sh -c "npm run seed:demo -w @plm/backend"
```

Open `http://localhost` — done.

---

## Default Demo Credentials

> All demo users share password: `Password@123`

| Email | Role |
|---|---|
| `admin@plm.local` | System Administrator |
| `plm@plm.local` | PLM Administrator |
| `chemist@plm.local` | Formulation Chemist |
| `qa@plm.local` | QA Manager |
| `reg@plm.local` | Regulatory Affairs |

---

## Development Setup

```bash
# Prerequisites: Node 22, Docker / Colima

npm install                                    # install all workspace deps
docker compose up -d                           # start Postgres + Redis
cp .env.example .env                           # default dev config works out of the box
npm run prisma:migrate -w @plm/backend         # apply migrations
npm run seed:dev                               # seed dev data
npm run dev                                    # frontend :5173 · backend :4000
```

---

## Environment Variables

### Production (`.env.production`)

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_PASSWORD` | **Yes** | Database password |
| `JWT_SECRET` | **Yes** | Min 32 chars — `openssl rand -base64 48` |
| `POSTGRES_DB` | No (default: `plm_project`) | Database name |
| `POSTGRES_USER` | No (default: `postgres`) | Database user |
| `JWT_EXPIRES_IN` | No (default: `8h`) | Token TTL |
| `APP_PORT` | No (default: `80`) | Host port for the web UI |

### Development (`.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5433/plm_project` | Postgres (mapped to 5433 in dev compose) |
| `REDIS_URL` | `redis://localhost:6379` | Redis |
| `JWT_SECRET` | `change-me` | Dev secret |
| `PORT` | `4000` | Backend port |
| `VITE_API_URL` | `http://localhost:4000/api` | API URL baked into frontend at build time |

---

## Project Structure

```
PluralPLM/
├── packages/
│   ├── backend/              # Express REST API
│   │   └── src/routes/       # items · formulas · npd · changes · releases · labels · ...
│   └── frontend/             # React SPA
│       └── src/features/     # one directory per domain module
├── prisma/
│   ├── schema.prisma         # data model
│   ├── migrations/           # versioned SQL migrations
│   └── seed.ts               # demo + dev seed data
├── Dockerfile.backend        # multi-stage Node build
├── Dockerfile.frontend       # Vite build → Nginx
├── nginx.conf                # SPA routing + /api proxy + gzip
├── docker-compose.yml        # dev: Postgres + Redis only
└── docker-compose.prod.yml   # prod: all 4 services
```

---

## Useful Commands

```bash
make prod-up       # build + start full production stack
make prod-logs     # tail all service logs
make prod-seed     # load demo data into running prod stack
make prod-shell    # open a shell in the backend container
make dev           # start frontend + backend in watch mode
make migrate       # create + apply a new Prisma migration
```

---

## Tech Stack

| | |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query v5, React Router v6, Zustand, Zod |
| **Backend** | Node.js 22, Express, TypeScript, Prisma ORM, JWT, Zod, Multer |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Infra** | Docker, Nginx 1.27, multi-stage builds |

---

## Roadmap

- [ ] Compliance checker — automated spec-against-target validation
- [ ] Multi-language label support
- [ ] API documentation hub in Configuration
- [ ] LDAP / SSO integration
- [ ] Mobile-responsive label preview
- [ ] Webhook / ERP integration layer

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Run `npm run typecheck` before committing
4. Open a pull request

---

## License

Non-Commercial — free for personal use, R&D, and academic research. A commercial license is required for production or revenue-generating use. See [LICENSE](LICENSE) for full terms.
