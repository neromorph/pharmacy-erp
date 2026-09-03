# Boot Gate Caught Missing Validation Deps

2026-09-03. Found during the TypeScript 7 migration of pharmacy-erp.

## What happened

The migration plan added a boot gate: after each toolchain change, start the API and confirm it listens. On the TypeScript 7 step the API compiled clean, all Nest modules initialized, then the process exited before listening. The error: missing `class-validator`.

## Root cause

`apps/api/src/main.ts` enables a global `ValidationPipe`, which needs `class-validator` and `class-transformer` at runtime. Neither was ever a declared dependency. Jest's resolver and the pnpm store hid the gap. The API image was built and deployed but never routed, so it served zero traffic and the broken boot never showed in production.

## Lesson

1. A build gate that only compiles proves nothing about boot. A "does it start and listen" check belongs in the pipeline for every service that ships.
2. Phantom transitive dependencies stay invisible until a strict resolver or a fresh runtime exposes them. Declare what you import.
3. An unrouted service rots silently. Boot it periodically or do not deploy it.

## Fix

Added `class-validator` and `class-transformer` as direct runtime dependencies. The boot gate stays part of the migration playbook.

## Related

- [[ADR-0006 Bun Package Manager And TypeScript 7]]
