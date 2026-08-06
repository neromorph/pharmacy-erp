# SDD ledger — plan: docs/superpowers/plans/2026-08-06-app-shell-ui.md

## Todos
- [x] Task 1: Route structure reorganization + root layout slimming (c60a13f, review clean: spec ✅)
- [ ] Task 2: Foundation — Tailwind v4 + shadcn + lucide setup
- [x] Task 2: Foundation — Tailwind v4 + shadcn + lucide setup (a968e2b, review approved; deviation: no baseUrl in tsconfig — TS5101, paths-only works)
- [x] Task 3: Shell (d2a1b31, review approved; minor fix b_imp WIB timezone, commit follows) — sidebar + Sheet mobile nav, TopHeader w/ shift dot, login card
- [ ] Task 4: Restyle Operations pages (dashboard, sales*, shifts*)
- [x] Task 4: Restyle Operations (91e2157, review approved; sentry-wip debris stashed at stash@{0}, restore with git stash pop)
- [x] Task 5: inventory (187e529, approved; sentry debris excluded; external session re-writes sentry files — exclude from all commits, clean before Task 8 deploy)
- [ ] Task 5: Restyle Inventory pages (products, kartu-stok, opname*, destructions*)
- [x] Task 5: inventory (187e529, approved)
- [x] Task 6: procurement (b7c9db2, 11 pages, approved; sticky-header idiom split noted — sales/sticky vs rest/plain, deferred cleanup) pages (suppliers*, procurement*, returns*)
- [x] Task 7: finance/compliance/master/system (12 files inside sibling commit 5774621 — wrong message accepted, approved; payout Dialog E2E pending; sipnap Label a11y minor) + receipts print check
- [ ] Task 8: Deploy + live E2E + docs sync

## Design decisions (approved)
- Scope C: FULL migration — Tailwind v4 + shadcn/ui + lucide-react, every page (receipts exempt, keeps thermal CSS).
- Palette: Teal-600 #0D9488 (CONTEXT.md binding). NOT blue.
- Route groups (auth)/(app)/(print); URLs unchanged; app/api at root.
- Signature: shift-aware status dot in header (green pulse + "Shift open · HH:MM").
- POS /sales/new = filled teal block in sidebar.
- Mobile: sidebar hidden on md, hamburger opens shadcn Sheet.
- Install ALL packages @latest (user directive). EXCEPTION: typescript stays ^6.x (TS 7 breaks Next 16 + ts-jest).

## Facts
- Repo had NO Tailwind/shadcn/lucide before this plan. Raw inline styles + CSS vars.
- No `@/` alias existed — Task 2 adds baseUrl+paths to apps/web/tsconfig.json (shadcn requires it).
- Tailwind v4: postcss.config.mjs with @tailwindcss/postcss, globals.css `@import "tailwindcss"` + `@theme`. No tailwind.config.js.
- shadcn: pnpm dlx shadcn@latest init (baseColor slate, cssVariables true) then add components.
- shifts columns: status (OPEN/CLOSED/FORCE_CLOSED), opened_at, closed_at.
- Existing components/ui/button.tsx hand-written → replaced by generated one in Task 2.
- Pre-commit hook active: lint (tsc) + build + audit + trivy — every commit passes it.
- 85/85 tests baseline.

## Runs
- Worker model: opencode/deepseek-v4-flash-free (fallback 9router/free:high)
- Reviewer model: 9router/kimi (user directive)


CLOSED (+hotfix): staff sync trigger broke gotrue login (SECURITY INVOKER + unscoped trigger → applied 20260806000007 SECURITY DEFINER + INSERT/UPDATE OF metadata columns; commit follows hotfix HEAD). DB anomaly: suppliers/sales/AP/submissions zeroed + satusehat_submission_queue table missing — external reset after 15:47 UTC, not from this SDD pipe; flagged to user.
