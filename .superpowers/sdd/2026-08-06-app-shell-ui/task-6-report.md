# Task 6 Report — Restyle Procurement pages

## Status: DONE

## What was done (per page)

- `(app)/procurement/page.tsx` — PO inbox: shadcn Table (sticky header bg-slate-50, rows h-10), status pills via Badge (DRAFT=outline, PENDING_APPROVAL=secondary, APPROVED=default, RECEIVED=secondary, CANCELLED=destructive), New PO as `<Button render={<Link/>}>`. Inline styles removed. Data fetch untouched.
- `(app)/procurement/new/page.tsx` — form: Label + Input stacked (grid gap-1.5), native select styled with selectClass, Create PO as Button. Server action byte-identical.
- `(app)/procurement/[id]/page.tsx` — detail: Badge status pill, shadcn Table with money cells text-right tabular-nums, Submit/Approve as `<Button type="submit" formAction={...}>`, Receive Goods as `<Button render={<Link/>}>`. Server actions byte-identical.
- `(app)/procurement/[id]/receive/page.tsx` — receive form: item rows as grid cards (rounded-lg border), qty + unit cost inputs compact `w-24`, Label+Input pattern, Receive Goods Button. Server action byte-identical.
- `(app)/procurement/returns/page.tsx` — returns list: shadcn Table, APPLIED=default / OPEN=secondary Badge, money right-aligned tabular-nums, New Return Button link.
- `(app)/procurement/returns/new/page.tsx` — page shell restyled (space-y-6, h1, muted p). Role gate logic untouched.
- `(app)/procurement/returns/new/return-form.tsx` — client form restyled (Label+Input, styled selects, Add Item/Remove as outline Buttons, Create Return as Button). All useState/row logic byte-identical.
- `(app)/procurement/returns/[id]/page.tsx` — detail: summary card grid, shadcn Table, tabular-nums money cells.
- `(app)/suppliers/page.tsx` — list: shadcn Table, PBF=default / Non-PBF=secondary Badge.
- `(app)/suppliers/[id]/page.tsx` — supplier statement: **print safety preserved** — `printCss()` block, `.statement-print` and `.no-print` class names untouched; only screen view restyled (Card-style info grid, shadcn Table, TableFooter for closing balance).
- `(app)/suppliers/[id]/print-button.tsx` — restyled to outline Button.

## Commands + output

- `cd apps/web && npx tsc --noEmit` → exit 0
- `cd apps/web && npx vitest run` → 12 files passed, 85 tests passed
- `cd apps/web && npx next build` → green, 26 routes (route table unchanged)
- `git add` scoped files only, `git diff --name-only --cached` = 11 files, all in `(app)/procurement` + `(app)/suppliers`
- `git commit` → hook (lint + build + audit + trivy) passed, commit `b7c9db2`

## Verification

- tsc clean, 85/85 tests, build green, hook green.
- No unstaged files left (only pre-existing obsidian workspace.json noise).

## Concerns

- `procurement/status.ts` still exports `statusColors` (now unused by procurement pages; finance/payables has its own local copy) — left untouched per scope (presentation-only, and Task 7 owns finance).
- None blocking.
