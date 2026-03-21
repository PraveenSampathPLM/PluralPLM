#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Plural PLM — Dev start script
# Starts Colima → Docker (Postgres + Redis) → Backend → Frontend
# Usage: ./start-dev.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}▶ $*${NC}"; }
success() { echo -e "${GREEN}✔ $*${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $*${NC}"; }
error()   { echo -e "${RED}✖ $*${NC}"; exit 1; }

# ── 1. Colima ────────────────────────────────────────────────────────────────
info "Checking Colima..."
if ! command -v colima &>/dev/null; then
  error "Colima not found. Install with: brew install colima docker"
fi

if colima status 2>/dev/null | grep -q "Running"; then
  success "Colima already running"
else
  # Clear stale Lima disk lock if left behind by a crashed previous run
  DISK_LOCK="/Users/$(whoami)/.colima/_lima/_disks/colima/in_use_by"
  if [ -L "$DISK_LOCK" ]; then
    warn "Removing stale Colima disk lock..."
    rm -f "$DISK_LOCK"
  fi
  info "Starting Colima (this takes ~30s on first boot)..."
  colima start
  success "Colima started"
fi

# ── 2. Docker containers (Postgres + Redis) ──────────────────────────────────
info "Starting Docker containers (Postgres + Redis)..."
docker compose up -d

info "Waiting for Postgres to be healthy..."
for i in {1..30}; do
  if docker exec plm-postgres pg_isready -U postgres -d plm_project &>/dev/null; then
    success "Postgres ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Postgres did not become ready in time. Check: docker logs plm-postgres"
  fi
  sleep 1
done

# ── 3. Prisma migrate (applies any pending migrations) ───────────────────────
info "Running Prisma migrations..."
npm run prisma:migrate -w @plm/backend 2>/dev/null || \
  npx prisma migrate deploy --schema=packages/backend/prisma/schema.prisma 2>/dev/null || \
  warn "Migration step skipped (may already be up to date)"

# ── 4. Start backend + frontend in background ────────────────────────────────
info "Starting backend (port 4000) and frontend (port 5173)..."

# Kill any processes already using our ports
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start backend
npm run dev -w @plm/backend > /tmp/plm-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be up
for i in {1..20}; do
  if curl -s http://localhost:4000/api/health &>/dev/null || \
     curl -s http://localhost:4000/health &>/dev/null; then
    success "Backend ready at http://localhost:4000"
    break
  fi
  sleep 1
done

# Start frontend
npm run dev -w @plm/frontend > /tmp/plm-frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3
success "Frontend starting at http://localhost:5173"

# ── 5. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Plural PLM is running${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  App        → ${CYAN}http://localhost:5173${NC}"
echo -e "  API        → ${CYAN}http://localhost:4000/api${NC}"
echo -e "  Postgres   → ${CYAN}localhost:5433${NC}  (db: plm_project / postgres)"
echo -e "  Redis      → ${CYAN}localhost:6379${NC}"
echo ""
echo -e "  Backend log  → /tmp/plm-backend.log"
echo -e "  Frontend log → /tmp/plm-frontend.log"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── 6. Trap Ctrl+C — clean shutdown ─────────────────────────────────────────
cleanup() {
  echo ""
  info "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  docker compose stop
  success "All services stopped. Colima left running (run 'colima stop' to shut it down fully)."
  exit 0
}
trap cleanup INT TERM

# Keep script alive
wait $BACKEND_PID $FRONTEND_PID
