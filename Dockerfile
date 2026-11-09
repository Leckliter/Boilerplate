# syntax=docker/dockerfile:1
#
# The web app as a small container (docs/deploy.md → Docker). Three stages: install, build, run.
#
#   docker build -t app-web .
#   docker run --rm -p 3000:3000 --env-file .env app-web
#
# Build-time variables that end up in the browser bundle (NEXT_PUBLIC_*) must be passed as build args:
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://app.example.com -t app-web .
# Everything else (DATABASE_URL, keys, BACKEND …) is read when the container starts. Migrations are NOT
# run by the image: run `pnpm db:migrate` as a release step (docs/deploy.md → Migrations).

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
# The exact pnpm in package.json's "packageManager".
RUN corepack enable
WORKDIR /repo

# ── 1. Install: only the manifests, so this layer is cached until a dependency changes ───────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ── 2. Build: a self-contained server in apps/web/.next/standalone ──────────────────────────────────
FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_OUTPUT=standalone \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN pnpm --filter web build

# ── 3. Run: only what the server needs, as a non-root user ──────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.status<500?0:1),()=>process.exit(1))"
# The standalone server keeps the monorepo layout, so the entry point is apps/web/server.js.
CMD ["node", "apps/web/server.js"]
