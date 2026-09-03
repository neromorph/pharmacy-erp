FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY bun.lock package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN bun install --frozen-lockfile --ignore-scripts
FROM deps AS builder
WORKDIR /app
COPY apps apps
COPY packages packages
COPY tsconfig.base.json ./
RUN bun run --filter @pharmacy/api build \
    && rm -rf node_modules apps/api/node_modules apps/web/node_modules packages/domain/node_modules \
    && bun install --production --frozen-lockfile --ignore-scripts --linker=hoisted \
    && rm -rf apps/api/node_modules apps/web/node_modules packages/domain/node_modules
FROM gcr.io/distroless/nodejs24-debian13 AS runtime
WORKDIR /app
COPY --from=builder --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=builder --chown=65532:65532 /app/apps/api/dist ./dist
ENV NODE_ENV=production \
    PORT=3001
USER 65532
EXPOSE 3001
CMD ["dist/main.js"]
