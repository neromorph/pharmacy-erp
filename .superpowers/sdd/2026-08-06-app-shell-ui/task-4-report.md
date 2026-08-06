# Task 4 Report — Operations Pages Restyle

Status: DONE
Date: 2026-08-06
Commit: `91e2157` — style(web): Tailwind+shadcn restyle for operations pages

## What was done (per page)

All changes are presentation-only. Data fetching, server actions, redirects, and lib/* logic kept identical. Verified by diff review: only JSX/class changes, plus removal of now-unused imports (e.g. `statusColors` in sales/[id]).

### Dashboard — `apps/web/app/(app)/page.tsx`
- KPI cards → shadcn `Card`/`CardHeader`/`CardTitle`/`CardContent` with `CardAction` icon slot (lucide `Banknote`/`AlertTriangle`/`CalendarClock`, `size-5 text-slate-400`).
- Value `text-2xl font-semibold tabular-nums text-slate-900`, subtext `text-sm text-slate-500` (was inline styled `var(--text-...)`).
- KPI grid `grid gap-4 sm:grid-cols-3`, full-width low-stock list as Card. RPC `get_dashboard_kpis` call untouched.

### Sales list — `(app)/sales/page.tsx`
- Inline `<table>` replaced with shadcn `Table` family. Sticky `TableHeader` `sticky top-14 z-10 bg-slate-50` (sidebar shell header is `sticky top-0 h-14`).
- Status pills → `Badge` via `statusVariant` map: DRAFT=outline, PAID=default(teal), VOID=destructive, fallback secondary.
- Money columns `text-right tabular-nums`. "New Sale" link → `Button render={<Link/>}`.
- Row patterned after approved stable-pill trade (keep remapping only at head; unknown → secondary).

### Sales new — `(app)/sales/new/page.tsx`
- Server page preserved: `requireOpenShift()` hard-block kept, error banner, FEFO stock table.
- POS gate `PosBlock` → `Button render={<Link href="/shifts/new"/>}` + `lucide `CircleAlert`.
- FEFO stock table → shadcn Table, rows `h-10 cursor-pointer hover:bg-slate-50`, batch cols, `tabular-nums` qty.
- `b.current_qty` field name preserved (checked diff — no accidental `b.quantity`).

### POS cart builder — `(app)/sales/new/cart-builder.tsx` (client component)
- All handlers/state/logic byte-identical (submit(), handlePatientSelect, addIngredient, BPJS guard path).
- Two inline-style constants `inputStyle`/`miniLabel` replaced with class-string constants `fieldCls`/`labelCls` matching shadcn Input look (`h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm ...`).
- All `<button>` elements → shadcn `Button`; primary action "Create Draft Sale" teal, add-item `variant="outline" size="sm"`, remove `variant="ghost" text-destructive`.
- Cart footer block: totals right aligned tabular-nums; grand total bold.
- POS cart body kept compact so a ClearCart/summary row still appears.
- BPJS badge (green) kept as `bg-emerald-500` span.

### Sale detail — `(app)/sales/[id]/page.tsx`
- Server actions `voidSaleAction`, `paySale`, `updateSaleClinicalInfo`, `retrySatusehatSubmission.bind` — verbatim. Data fetching verbatim.
- Items table → shadcn Table, money `text-right tabular-nums`, child rows `pl-7` + `bg-slate-50`.
- Totals block right-aligned; receipt CTA `Button render={<Link href={'/receipts/'+sale.id}/>}`.
- Pay (complete sale) form: native styled select (payment method) + `Input` paid amount + teal Button; disabled logic unchanged (shift gate).
- Status Badges via saleStatusVariant; SATUSEHAT card kept.

### Shifts list — `(app)/shifts/page.tsx`
- Open-shift hero card: `rounded-xl bg-card ring-1 ring-emerald-500/50` with OPEN badge (semantic green; teal reserved for primary), `shifts/cash ledger`.
- History table → shadcn Table + Badge pills (OPEN=default, CLOSED=secondary, FORCE_CLOSED=destructive), variance `tabular-nums`, negative variance `text-destructive`, view link.

### Shifts new — `(app)/shifts/new/page.tsx`
- `Card` + `Label`/`Input`/`Textarea` stacked `grid gap-4`; `form action={openShift}` untouched; `?error` banner `bg-red-50 text-red-600`.
- Subtle helper text `text-xs text-slate-500` under opening-cash field.

### Shifts detail — `(app)/shifts/[id]/page.tsx`
- Cash stats `grid gap-4 sm:grid-cols-3` Cards (opening, received cash, expected/actual closing); variance line `tabular-nums` (negative = destructive).
- Sales table → shadcn Table sticky header; draft-count amber note; close form Label+Input+Button, force-close same with `variant=destructive`.
- Forms `action={handleClose}` / `handleForceClose` (server actions preserved inside), closing reduced to single Input.

## Commands + output

```
cd apps/web && npx tsc --noEmit          → clean (no output)
cd apps/web && npx next build            → green; all routes compiled (+ ƒ sales, /sales/[id], /sales/new, /shifts, /shifts/[id], /shifts/new)
cd apps/web && npx vitest run            → 12 files, 85 tests, 85 passed
pnpm run lint                            → apps/web lint: tsc --noEmit Done (also api+domain green)
git commit ...                           → [main 91e2157] 8 files changed, 806 insertions(+), 978 deletions(-)
```

## Verification
- tsc clean, next build green, vitest 85/85, `pnpm -r lint` green (web+api+domain tsc --noEmit).
- Pre-commit hook ran during commit: plus audit/trivy passed (no findings).
- Staged set reviewed: exactly the 8 restyle files; committed all 8.
- api/* sentry files, `apps/web/middleware.ts`, `apps/web/next.config.js`, `apps/web/package.json`, pnpm-lock, pnpm-workspace, obsidian `workspace.json` all left unstaged (parent owns).

## Concerns
- none blocking.
- Note: mid-run `git status --short`/`--porcelain` reported "clean — nothing to commit" in this environment even with a dirty tree; `git diff --name-only HEAD` was the reliable read. No impact — commit contains exactly the 8 restyle files.
- Dashboard/SALES pages still pass data role checks — no behavior diff beyond markup (verbatim compared by build/lint).