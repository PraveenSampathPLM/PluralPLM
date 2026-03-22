# Tatva

> **The Enterprise Product Lifecycle Management platform built for process industries.**

Tatva gives food & beverage, CPG, chemical, paint, rubber, and polymer manufacturers a single system of record — from raw material to shelf. Formula management, stage-gate NPD, regulatory labeling, change control, and release management, all in one place.

<img alt="Tatva — Product Lifecycle Management" src="docs/tatva-hero.svg" width="100%"/>

[![License: Non-Commercial](https://img.shields.io/badge/License-Non--Commercial-orange.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-22-green.svg)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](docker-compose.prod.yml)

---

## Why Tatva?

Most PLM tools are built for discrete manufacturing — mechanical parts, assemblies, BOMs with counts. **Process industries are different.** Ingredients have percentages. Formulas have multiple versions in parallel development. Labels must declare allergens. Products go through gate reviews before launch.

Tatva is purpose-built for process:

| Pain point | How Tatva solves it |
|---|---|
| Formula versions scattered in spreadsheets | Versioned formula builder with approval workflows and full audit trail |
| Manual ingredient statement preparation | Auto-generates FSSAI/EU/FDA-compliant ingredient declarations from formula weights |
| No visibility into NPD progress | Stage-gate project management (Idea → Concept → Development → Launch) with gate review sign-offs |
| Change requests lost in email | Structured change control with affected object tracking and multi-role sign-off |
| Specs, docs, and labels in different systems | Unified document control, spec sheets, and label templates — all linked to the formula |
| Onboarding a new ERP takes 12+ months | Docker-based deployment, self-hosted in under 10 minutes, no commerical dependencies |

---

## Key Modules

### Control Tower Dashboard
Real-time overview of your entire PLM portfolio — open changes, active formulas, release status, NPD pipeline, and trend charts across all modules in one view.

![Dashboard](docs/screenshots/01-dashboard.png)

---

### Materials & Item Management
Manage all raw materials, packaging, formulations, and finished goods in one master item registry. Full lifecycle tracking from DRAFT to RELEASED with revision history and export.

![Materials](docs/screenshots/02-items.png)

---

### Formulation Management
Build multi-level formulas with ingredients, quantities, and weight percentages. Every change is versioned. Linked BOMs, specs, and processing instructions all in one place.

![Formulas](docs/screenshots/03-formulas.png)

![Formula Detail](docs/screenshots/04-formula-detail.png)

---

### Digital Thread — Product Traceability
Hub-and-spoke digital thread connects the formula to ingredients, output FG item, documents, specifications, changes, releases, and NPD project. See completeness scores and action items at a glance.

![Digital Thread](docs/screenshots/05-digital-thread.png)

---

### NPD Stage-Gate
Kanban-style pipeline across Discovery → Feasibility → Development → Validation → Launch. Configurable gate criteria (must-meet & should-meet) with formal gate review sign-offs. Gate 5 GO automatically triggers a release request.

![NPD Stage-Gate](docs/screenshots/06-npd.png)

---

### Change Control
Raise change requests (ECR/ECN), assign priority, attach affected objects, route through multi-role sign-off, and link to downstream releases. Full audit trail on every object.

![Change Management](docs/screenshots/07-changes.png)

---

### Release Management
Package approved changes, BOMs, and documents into numbered release requests. Track release readiness across the portfolio with per-release progress reporting.

![Release Management](docs/screenshots/08-releases.png)

---

### Enterprise Reporting
Out-of-the-box KPI dashboard, change aging, release readiness, NPD pipeline status, FG items missing formulas, and items-by-status bar chart. One-click CSV export for every report.

![Reports](docs/screenshots/09-reports.png)

---

### Regulatory Labeling
Link a label template to a formula and click **Generate** — Tatva recursively walks the entire formula tree, sorts ingredients by weight (FSSAI/EU 1169/FDA compliant), detects allergens from material attributes, and populates the full label: ingredient statement, allergen declaration, nutrition panel, shelf life, country of origin, and batch format.

![Labeling](docs/screenshots/10-labeling.png)

---

### Compliance & Specifications
Configure parameter-based specification templates per industry (physico-chemical, nutritional, regulatory). Attach spec sheets to any material or formula and validate against target ranges.

![Specifications](docs/screenshots/11-specifications.png)

---

### Finished Good Structures
Link finished good items to their formula and packaging components. View and manage the complete FG BOM — formula version, revision, status, and packaging count all in one place.

![FG Structures](docs/screenshots/12-fg-structures.png)

---

### ERP Integration Framework

Connect Tatva to your ERP system to synchronise items, formulas, and BOMs in real time. Tatva ships with native adapters for **SAP S/4HANA**, **Oracle EBS**, **Oracle Fusion Cloud**, **Microsoft Dynamics 365**, **NetSuite**, and any **Generic REST API** — no middleware required.

**Integration Hub** — configure and manage all ERP connections from one place. Each card shows the ERP type, sync status, last sync timestamp, and mapping/log counts.

![ERP Integration Hub](docs/screenshots/erp-integrations-hub.png)

**3-step setup wizard** — choose your ERP system, configure the base URL and authentication (API Key, Bearer Token, Basic Auth, or OAuth2), and select which entities to sync (Items, Formulas, FG Structures, Changes, Releases).

**Integration detail — Overview** — trigger Push or Pull syncs per entity type, view connection health, and see when the integration last ran.

![ERP Integration Overview](docs/screenshots/erp-integration-overview.png)

**Field Mappings** — define exactly how PLM fields map to ERP fields with direction control (PLM→ERP, ERP→PLM, or bidirectional) and optional transform rules. Default mappings are seeded automatically for each ERP type (e.g. `itemCode → MATNR` for SAP).

![ERP Field Mappings](docs/screenshots/erp-integration-mappings.png)

**Sync History** — every sync run is logged with status (SUCCESS / PARTIAL / FAILED), record counts, duration, and expandable error details. Logs refresh live every 5 seconds during an active sync.

![ERP Sync History](docs/screenshots/erp-integration-logs.png)

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

### One-command start (macOS with Colima)

```bash
# Clone and install dependencies first
git clone https://github.com/PraveenSampathPLM/PluralPLM.git && cd PluralPLM
npm install

# Then just run:
./start-dev.sh
```

`start-dev.sh` handles everything in one shot:
- Starts **Colima** (auto-clears stale disk locks from crashed sessions)
- Starts **Postgres + Redis** via Docker and waits until healthy
- Runs **Prisma migrations**
- Starts **backend** (port 4000) and **frontend** (port 5173)
- Press **Ctrl+C** to cleanly stop all services

### Manual setup

```bash
# Prerequisites: Node 22, Docker / Colima

npm install                                    # install all workspace deps
colima start                                   # start Colima (macOS)
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
