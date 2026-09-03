# ADR-0006 Bun Package Manager And TypeScript 7

## Status

Accepted, 2026-09-03. Applied to the pharmacy-erp repo.

## Context

The pharmacy-erp stack ran pnpm 11, TypeScript 6.0.3, ts-jest for API tests, and `@nestjs/cli` builds. TypeScript 7 (tsgo, the Go compiler) shipped 7.0.2 with a much faster CLI. Bun matured as a package manager. The goal was future-proofing: remove the deprecated path (ts-jest) and move to the modern compiler and package manager.

## Constraints found

- `ts-jest` does not support TypeScript 7. It is replaced by vitest 4, which the web package already used. One test runner now serves the whole repo.
- `@nestjs/cli` calls the TypeScript compiler as a library. TypeScript 7.0 ships only the `tsc` CLI; the programmatic compiler API returns in 7.1. So `nest build` cannot run on 7.0.2.
- The SWC builder was rejected: SWC lacks full `emitDecoratorMetadata` support, which the Nest dependency injector needs at boot.
- The fix: build the API with plain `tsc -p tsconfig.build.json` (tsgo CLI works in 7.0.2). The dev script pairs `tsc --watch` with `node --watch dist/main.js`.
- Bun was adopted as package manager only. The Docker runtime images stay `gcr.io/distroless/nodejs24-debian13`. A Bun runtime was evaluated and rejected: the prod traffic path must not change, and the Sentry SDK combination under Bun is unproven.

## Decision

- vitest 4 for all tests; ts-jest and Jest removed.
- TypeScript 7.0.2 in all three workspaces. API builds with plain `tsc -p`. Revisit `@nestjs/cli` when TypeScript 7.1 stable ships.
- Bun 1.4 as package manager: `bun.lock`, `trustedDependencies` (replaces pnpm `allowBuilds`), `oven-sh/setup-bun@v2` in CI, `oven/bun:1-slim` builder stages.
- Bun Docker images use floating major tags only: `1-slim`, `1-distroless`, `1-alpine`. Never a pinned version tag.
- Dockerfiles carry no comments.
- One change per deploy. Each step shipped as its own commit with green gates before the next.

## Consequences

- Installs and builds run through Bun; CI runs `bun install --frozen-lockfile`, `bun audit`, and Trivy scans `bun.lock`.
- The API image carries whole-workspace production deps because Bun has no per-package filter install. A few MB, accepted.
- The boot gate in the migration caught a latent production bug — see [[Boot Gate Caught Missing Validation Deps]].
- `pharmacy-erp-vault/setup.md` documents the new commands.
