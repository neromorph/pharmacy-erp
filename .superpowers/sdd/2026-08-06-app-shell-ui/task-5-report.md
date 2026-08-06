# Task 5 Report: Restyle Inventory pages

Status: DONE

## What was done (per page)

All 9 files converted from inline `style={}` + CSS vars to Tailwind classes + shadcn/ui components. Server actions, data fetching, redirects, and lib imports byte-identical.

- `(app)/products/page.tsx` — New Product form in `Card` + `Label`/`Input` grid (`sm:grid-cols-2 lg:grid-cols-4`); table → shadcn `Table` family with `bg-slate-50` header, `h-10` rows; regulatory category pills → `Badge variant="outline"` + color class map (`catClass`); Edit `<details>` form restyled same way; `Button` submit.
- `(app)/kartu-stok/page.tsx` — empty state → `Card` + `Button render={<Link/>}`; filter form → `Label`+`Input`/native select in `bg-card ring-1` container with `Filter` outline Button + Clear link; view toggle (By Product / By Batch) → two `size="sm"` buttons, active = default, inactive = outline; product group header rows `bg-slate-50 font-medium`; movement type pills → `Badge` via `typeBadge` map (IN default, OUT destructive, ADJUSTMENT outline, VOID secondary); batch sub-group headers `bg-slate-50 text-xs font-medium`; qty/balance cells `text-right tabular-nums`, balance `font-medium`.
- `(app)/stock-opname/page.tsx` — table → shadcn `Table`; status pills → `Badge` via `statusVariant` (DRAFT secondary, PENDING_APPROVAL outline, APPROVED default, CANCELLED destructive); New Opname button → `Button render={<Link/>}`.
- `(app)/stock-opname/new/page.tsx` — form card + `Label`+select; batches table → shadcn `Table` (`overflow-x-auto` wrapper for wide table); physical qty cells `w-36` `Input`, reason `w-36` native select; Save Draft `Button mt-6`. Server action `createStockOpname` untouched.
- `(app)/stock-opname/[id]/page.tsx` — back link, `h1` + `Badge` + type; items table → shadcn `Table` with numeric cells right-aligned tabular-nums; action buttons (`Submit for Approval` default, `Cancel` destructive, `Approve` default) inside preserved hidden-input forms. All three server actions unchanged.
- `(app)/stock/destructions/page.tsx` — access-denied message → `text-destructive`; header + New Destruction `Button render={<Link/>}`; table → shadcn `Table`, BAP link `text-primary`.
- `(app)/stock/destructions/new/page.tsx` — back link + h1 + description; server data fetching untouched.
- `(app)/stock/destructions/new/destruction-form.tsx` — client component: form rows → `Label`+`Input` grid `sm:grid-cols-2`; dynamic item rows grid `sm:grid-cols-[2fr_1.5fr_1fr_auto]`, bordered `rounded-lg border p-3`, product/batch native selects via shared `selectClass`; Remove `Button outline`, Add Item `Button outline`, Create Destruction `Button default`. All React state/logic byte-identical.
- `(app)/stock/destructions/[id]/page.tsx` — detail card → `bg-card ring-4 grid sm:grid-cols-2`; items → shadcn `Table`; access-denied text-destructive.

## Commands + output

- `npx tsc --noEmit` → clean (no output).
- `npx next build` → Compiled successfully; route table identical (26 routes incl. /products, /stock-opname/*, /stock/destructions/*, /kartu-stok).
- `npx vitest run` → Test Files 12 passed (12), Tests 85 passed (85).
- `git commit` → pre-commit hook (lint/tsc/buil/audit/trivy) passed. Commit `187e529`.

## Verification

- Build green, 85/85 tests green, tsc clean.
- Route table unchanged.
- Only the 9 scoped files staged (`git diff --name-only --cached` verified before commit). Unrelated dirty files (sentry debris, obsidian workspace.json) left untouched unstaged.

## Concerns

- Categories in `products` keep bespoke colors (teal/amber/red/purple) — semantic, palette-consistent; mapped via `Badge variant="outline"` + color class.
- Native styled selects kept where shadcn Select adds no value (per plan/brief). `@/components/ui/select` not used.
- Stock opname new table wrapped in `overflow-x-auto` for narrow screens.