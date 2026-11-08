#!/bin/bash
# Gets a Claude Code cloud session ready to run `pnpm check` before pushing:
# dependencies, a local Postgres 16 with every migration applied, DATABASE_URL set,
# and origin/main fetched (the rules check compares migrations against it).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0 # on your own computer, follow docs/testing.md instead
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# ── Dependencies: only when a manifest or the lockfile changed ────────────────
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
  sha256sum .claude/hooks/session-start.sh pnpm-lock.yaml pnpm-workspace.yaml package.json \
    apps/*/package.json packages/*/package.json > "$hashes" || rm -f "$hashes"
fi

# ── Local Postgres 16 for tests (never a hosted database) ─────────────────────
PGBIN=/usr/lib/postgresql/16/bin
DB_NAME=app
DB_URL=postgres://postgres:postgres@localhost:5432/$DB_NAME

if [ -x "$PGBIN/pg_isready" ]; then
  if ! "$PGBIN/pg_isready" -q -h localhost -p 5432; then
    if command -v pg_ctlcluster >/dev/null 2>&1 && pg_lsclusters | grep -q '^16 '; then
      pg_ctlcluster 16 main start || service postgresql start
    else
      service postgresql start
    fi >/dev/null 2>&1 || true
  fi
  for _ in $(seq 1 30); do "$PGBIN/pg_isready" -q -h localhost -p 5432 && break; sleep 0.5; done
  su postgres -c "$PGBIN/psql -qc \"ALTER USER postgres PASSWORD 'postgres';\"" >/dev/null
  su postgres -c "$PGBIN/psql -tAc \"SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'\"" | grep -q 1 ||
    su postgres -c "$PGBIN/createdb $DB_NAME"
elif command -v docker >/dev/null 2>&1; then
  docker start app-pg >/dev/null 2>&1 ||
    docker run -d --name app-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=$DB_NAME \
      -p 5432:5432 postgres:16 >/dev/null
  for _ in $(seq 1 40); do docker exec app-pg pg_isready -q && break; sleep 0.5; done
else
  echo "No Postgres 16 available: pnpm test will not run in this session." >&2
  exit 0
fi

DATABASE_URL=$DB_URL pnpm --silent db:migrate ||
  echo "db:migrate did not run (no migrations yet, or the db package is not built)." >&2

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export DATABASE_URL=$DB_URL" >> "$CLAUDE_ENV_FILE"
fi

# ── origin/main, so the rules check can spot edits to applied migrations ──────
git fetch --quiet origin main 2>/dev/null ||
  echo "Couldn't fetch origin/main; the edited-migration check will be skipped." >&2
