# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: dependencies
# Install workspace deps (web + domain only) with a frozen lockfile.
# Cached on lockfile/manifest changes only.
# ---------------------------------------------------------------------------
FROM node:24-trixie-slim AS deps
ENV PNPM_VERSION=11.18.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json

# Install only what @pharmacy/web depends on, including its workspace dep.
RUN pnpm install --frozen-lockfile --filter @pharmacy/web...

# ---------------------------------------------------------------------------
# Stage 2: build
# Compile the Next.js web app. NEXT_PUBLIC_* values are inlined at build time.
# ---------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app

COPY apps apps
COPY packages packages
COPY tsconfig.base.json ./

# Build-time values for client-side Supabase config. must escape build
# because Next inlines NEXT_PUBLIC_* into the client bundle.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @pharmacy/web build

# ---------------------------------------------------------------------------
# Stage 3: runtime
# Minimal, nonroot, distroless image. Copies ONLY the Next standalone output
# plus the static assets. No shell, no package manager.
# ---------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs24-debian13 AS runtime
WORKDIR /app

# Standalone output traces a self-contained node_modules + server.js.
COPY --from=builder --chown=65532:65532 /app/apps/web/.next/standalone ./
# Static assets are not traced; copy them into their expected location.
COPY --from=builder --chown=65532:65532 /app/apps/web/.next/static ./apps/web/.next/static
# Serve public assets if any exist.
COPY --from=builder --chown=65532:65532 /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

USER 65532
EXPOSE 3000
CMD ["apps/web/server.js"]