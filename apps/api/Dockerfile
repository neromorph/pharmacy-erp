# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: dependencies
# Install API workspace deps with a frozen lockfile.
# Cached on lockfile/manifest changes only.
# ---------------------------------------------------------------------------
FROM node:26-trixie-slim AS deps
ENV PNPM_VERSION=11.18.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json

# Install only what @pharmacy/api depends on. pnpm validates the whole
# workspace, so all package manifests must be present.
RUN pnpm install --frozen-lockfile --filter @pharmacy/api...

# ---------------------------------------------------------------------------
# Stage 2: build
# Compile the NestJS API, then deploy a self-contained prod bundle.
# pnpm deploy flattens the symlinked node_modules into real files, which is
# required for a minimal distroless runtime image.
# ---------------------------------------------------------------------------
FROM deps AS builder
WORKDIR /app

COPY apps apps
COPY packages packages
COPY tsconfig.base.json ./

RUN pnpm --filter @pharmacy/api build \
    && pnpm --filter @pharmacy/api deploy --legacy --prod /app/api-deploy

# ---------------------------------------------------------------------------
# Stage 3: runtime
# Minimal, nonroot, distroless image. Self-contained bundle only.
# ---------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs24-debian13 AS runtime
WORKDIR /app

COPY --from=builder --chown=65532:65532 /app/api-deploy ./

ENV NODE_ENV=production \
    PORT=3001

USER 65532
EXPOSE 3001
CMD ["dist/main.js"]