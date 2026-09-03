FROM oven/bun:1-slim AS deps
WORKDIR /app
COPY bun.lock package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN bun install --frozen-lockfile --ignore-scripts
FROM deps AS builder
WORKDIR /app
COPY apps apps
COPY packages packages
COPY tsconfig.base.json ./
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN bun run --filter @pharmacy/web build
FROM gcr.io/distroless/nodejs24-debian13 AS runtime
WORKDIR /app
COPY --from=builder --chown=65532:65532 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=65532:65532 /app/apps/web/public ./apps/web/public
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
USER 65532
EXPOSE 3000
CMD ["apps/web/server.js"]
