# Pharmacy SaaS Foundation Init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize repo structure for pharmacy SaaS with docs, frontend, backend, and shared domain boundaries.

**Architecture:** Start with a thin monorepo-style layout that separates UI, API, and domain docs from day 1. Keep implementation minimal: folder structure, package scaffolding, config baselines, and domain glossary/docs only. No business logic yet; this plan only makes later feature work clean and testable.

**Tech Stack:** Next.js, NestJS, Supabase, TypeScript, Tailwind CSS, Shadcn/UI.

## Global Constraints

- One tenant = one pharmacy store branch.
- One user = one tenant only.
- FEFO is the primary stock rule.
- Supplier is the technical model name; PBF is the UI label.
- Dashboard shows only 3 KPIs on day 1.
- Day 1 scope: POS, Procurement, Stock, OTC retail first, Light prescription tracking.
- UI reference: clean clinical enterprise UI, light-first, data-dense, compact, high-contrast, Emerald/Teal primary, Slate neutrals.
- Do not use pure dark theme for operational or checkout screens.
- Do not use low-contrast gray text for medicine dosages or prices.
- Do not use slow transitions above 200ms on POS scanning.

---

### Task 1: Lock repo skeleton and workspace boundaries

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.env.example`

**Interfaces:**
- Consumes: none
- Produces: repo workspace layout for `apps/web`, `apps/api`, `packages/domain`, `docs`

- [ ] **Step 1: Write the failing check**

```bash
test -f package.json && test -f pnpm-workspace.yaml && test -f tsconfig.base.json
```

- [ ] **Step 2: Run check to verify it fails**

Run: `test -f package.json && test -f pnpm-workspace.yaml && test -f tsconfig.base.json`
Expected: fail because files do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create workspace files with these exact contents:

```json
{
  "name": "pharmacy-erp",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test"
  }
}
```

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": "."
  }
}
```

- [ ] **Step 4: Run check to verify it passes**

Run: `test -f package.json && test -f pnpm-workspace.yaml && test -f tsconfig.base.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .editorconfig .env.example
git commit -m "chore: init workspace skeleton"
```

---

### Task 2: Create domain docs and ADR entry points

**Files:**
- Modify: `CONTEXT.md`
- Create: `docs/adr/0003-ui-reference-clean-medical-enterprise-saas.md`
- Create: `docs/adr/0004-one-user-one-tenant.md`

**Interfaces:**
- Consumes: project glossary in `CONTEXT.md`
- Produces: stable domain terms for future code and UI decisions

- [ ] **Step 1: Write the failing check**

```bash
test -f CONTEXT.md && test -f docs/adr/0003-ui-reference-clean-medical-enterprise-saas.md && test -f docs/adr/0004-one-user-one-tenant.md
```

- [ ] **Step 2: Run check to verify it fails**

Run: `test -f CONTEXT.md && test -f docs/adr/0003-ui-reference-clean-medical-enterprise-saas.md && test -f docs/adr/0004-one-user-one-tenant.md`
Expected: fail because ADR files do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Append these terms to `CONTEXT.md` if missing:

```md
- **UI reference**: clean clinical enterprise design system with light-first, data-dense, compact, high-contrast screens for pharmacy operations.
- **Domain language**: one user belongs to exactly one tenant.
```

Create ADRs with these decisions:

```md
# ADR 0003: UI Reference Is Clean Medical And Enterprise SaaS

## Status

Accepted

## Context

Operational pharmacy screens need fast scanability, high contrast, compact density, and clear status colors.

## Decision

Use a clean medical and enterprise SaaS design system: light-first, data-dense, compact, high-contrast, Emerald/Teal primary, Slate neutrals.

## Consequences

- Keep POS and stock screens compact.
- Use explicit alert colors for stock and expiry states.
- Avoid dark-first checkout UI.
```

```md
# ADR 0004: User Belongs To One Tenant

## Status

Accepted

## Context

Day 1 does not need cross-tenant staff access.

## Decision

Each user belongs to exactly one tenant.

## Consequences

- Authorization stays simple.
- Cross-branch access is deferred to later phases.
```

- [ ] **Step 4: Run check to verify it passes**

Run: `test -f CONTEXT.md && test -f docs/adr/0003-ui-reference-clean-medical-enterprise-saas.md && test -f docs/adr/0004-one-user-one-tenant.md`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add CONTEXT.md docs/adr/0003-ui-reference-clean-medical-enterprise-saas.md docs/adr/0004-one-user-one-tenant.md
git commit -m "docs: lock domain language and ui reference"
```

---

### Task 3: Scaffold frontend app shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/components/ui/button.tsx`

**Interfaces:**
- Consumes: design system tokens from `CONTEXT.md`
- Produces: runnable Next.js app shell with one landing page and one shared button component

- [ ] **Step 1: Write the failing test**

```bash
test -f apps/web/app/page.tsx && test -f apps/web/app/layout.tsx && test -f apps/web/app/globals.css
```

- [ ] **Step 2: Run test to verify it fails**

Run: `test -f apps/web/app/page.tsx && test -f apps/web/app/layout.tsx && test -f apps/web/app/globals.css`
Expected: fail because app shell does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a bare Next.js app router shell that renders:

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>Pharmacy ERP</h1>
      <p>POS, procurement, and stock for one branch tenant.</p>
    </main>
  )
}
```

Keep styles compact and light-first in `globals.css` using Slate and Teal tokens from `CONTEXT.md`.

- [ ] **Step 4: Run test to verify it passes**

Run: `test -f apps/web/app/page.tsx && test -f apps/web/app/layout.tsx && test -f apps/web/app/globals.css`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): scaffold app shell"
```

---

### Task 4: Scaffold backend API shell

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health.controller.ts`
- Create: `apps/api/src/health.controller.spec.ts`

**Interfaces:**
- Consumes: workspace TypeScript config
- Produces: NestJS API boot path plus health endpoint for smoke testing

- [ ] **Step 1: Write the failing test**

```bash
test -f apps/api/src/health.controller.ts && test -f apps/api/src/main.ts
```

- [ ] **Step 2: Run test to verify it fails**

Run: `test -f apps/api/src/health.controller.ts && test -f apps/api/src/main.ts`
Expected: fail because API shell does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a NestJS app that exposes `GET /health` returning `{ "status": "ok" }`.

```ts
@Get('health')
health() {
  return { status: 'ok' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `test -f apps/api/src/health.controller.ts && test -f apps/api/src/main.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): scaffold nest shell"
```

---

### Task 5: Add shared domain package boundary

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/tenant.ts`
- Create: `packages/domain/src/stock.ts`
- Create: `packages/domain/src/index.test.ts`

**Interfaces:**
- Consumes: glossary terms from `CONTEXT.md`
- Produces: shared types/constants for future app and API code

- [ ] **Step 1: Write the failing test**

```ts
import { TENANT_SCOPE, STOCK_RULE } from './index'

test('exports core domain constants', () => {
  expect(TENANT_SCOPE).toBe('branch')
  expect(STOCK_RULE).toBe('fefo')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmacy/domain test`
Expected: fail because exports do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const TENANT_SCOPE = 'branch' as const
export const STOCK_RULE = 'fefo' as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @pharmacy/domain test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/domain
git commit -m "feat(domain): add shared core constants"
```

---

### Task 6: Add repo-level verification and docs pass

**Files:**
- Create: `README.md`
- Create: `docs/setup.md`
- Create: `docs/architecture.md`

**Interfaces:**
- Consumes: all earlier scaffolds
- Produces: clear bootstrap instructions for future feature work

- [ ] **Step 1: Write the failing test**

```bash
test -f README.md && test -f docs/setup.md && test -f docs/architecture.md
```

- [ ] **Step 2: Run test to verify it fails**

Run: `test -f README.md && test -f docs/setup.md && test -f docs/architecture.md`
Expected: fail because docs are missing.

- [ ] **Step 3: Write minimal implementation**

Create short docs that explain:

```md
# Setup

- install pnpm
- install dependencies
- run web and api apps
```

```md
# Architecture

- `apps/web` for Next.js UI
- `apps/api` for NestJS API
- `packages/domain` for shared domain terms
- `docs/adr` for decisions
```

- [ ] **Step 4: Run test to verify it passes**

Run: `test -f README.md && test -f docs/setup.md && test -f docs/architecture.md`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/setup.md docs/architecture.md
git commit -m "docs: add project bootstrap guidance"
```

## Review Checklist

1. Every project-wide rule from `CONTEXT.md` is represented in a task.
2. No task references functions, files, or packages introduced nowhere else in the plan.
3. No placeholder text like TBD or TODO remains.
4. Tasks are independently testable and small enough for a single review gate.
5. Plan stays focused on initialization, not business logic.
