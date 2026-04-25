#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${PORT:-3001}"

echo "== ARN.IO: starting =="

echo "Checking PostgreSQL..."
if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -h "${PG_HOST:-localhost}" -p "${PG_PORT:-5432}" >/dev/null 2>&1; then
    echo "PostgreSQL is not ready on ${PG_HOST:-localhost}:${PG_PORT:-5432}."
    if command -v systemctl >/dev/null 2>&1; then
      echo "Attempting to start PostgreSQL (may ask for sudo password)..."
      sudo systemctl start postgresql || true
    fi
  fi
else
  echo "pg_isready not found; skipping DB readiness check."
fi

# Install deps if missing
if [ ! -d "$ROOT_DIR/server/node_modules" ]; then
  echo "Installing backend dependencies..."
  (cd "$ROOT_DIR/server" && npm install)
fi

if [ ! -d "$ROOT_DIR/client/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT_DIR/client" && npm install)
fi

PIDS=()

echo "Checking backend on http://localhost:${BACKEND_PORT} ..."
if command -v curl >/dev/null 2>&1 && curl -fsS "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
  echo "Backend already running on port ${BACKEND_PORT}; reusing it."
else
  echo "Starting backend (http://localhost:${BACKEND_PORT})..."
  (cd "$ROOT_DIR/server" && npm run dev) &
  PIDS+=("$!")
fi

FRONTEND_PORT=""
if command -v curl >/dev/null 2>&1; then
  for p in 5173 5174 5175 5176 5177 5178 5179 5180; do
    if curl -fsS "http://localhost:${p}/" 2>/dev/null | grep -q "/@vite/client"; then
      FRONTEND_PORT="$p"
      break
    fi
  done
fi

if [ -n "$FRONTEND_PORT" ]; then
  echo "Frontend already running on http://localhost:${FRONTEND_PORT}/ ; reusing it."
else
  echo "Starting frontend (Vite; port printed in logs)..."
  (cd "$ROOT_DIR/client" && npm run dev) &
  PIDS+=("$!")
fi

cleanup() {
  echo
  echo "== ARN.IO: stopping =="
  if [ "${#PIDS[@]}" -gt 0 ]; then
    kill "${PIDS[@]}" 2>/dev/null || true
  fi
}
trap cleanup INT TERM EXIT

# Keep running until a child exits (or Ctrl+C)
wait -n "${PIDS[@]}" 2>/dev/null || true
exit 0
