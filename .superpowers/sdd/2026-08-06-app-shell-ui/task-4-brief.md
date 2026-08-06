### Task 4: Restyle Operations pages

**Pages:** `(app)/page.tsx` (dashboard), `(app)/sales/page.tsx`, `(app)/sales/new/page.tsx` + its cart components (FEFO table included), `(app)/sales/[id]/page.tsx`, `(app)/shifts/page.tsx`, `(app)/shifts/new/page.tsx`, `(app)/shifts/[id]/page.tsx`.

- [ ] **Step 1:** Replace inline styles with Tailwind classes: page container `space-y-6`, h1 `text-xl font-semibold text-slate-900`, muted `text-sm text-slate-500`.
- [ ] **Step 2:** Buttons → shadcn `Button` (`variant="default"` = teal for primary, `outline` secondary, `destructive` void). Links-as-buttons wrap `<Link>` inside `<Button asChild>`.
- [ ] **Step 3:** Tables → shadcn `Table` family, sticky header `bg-slate-50`, rows `h-10`, money cells `text-right tabular-nums`, status pills → `Badge` (variants: default/secondary/destructive/outline).
- [ ] **Step 4:** Forms → `Label` + `Input` stacked (`grid gap-1.5`), selects → shadcn `Select` where practical (native `<select>` styled `h-9 rounded-md border px-2` acceptable where the shadcn Select adds no value — radix select in compact POS flows is heavy; ponytail: keep native selects unless a11y requires).
- [ ] **Step 5:** Dashboard KPI cards → shadcn `Card` row (`grid gap-4 sm:grid-cols-3`), value `text-2xl font-semibold tabular-nums`, delta/subtext `text-sm text-slate-500`, lucide icons top-right muted.
- [ ] **Step 6:** POS `/sales/new` — keep current client logic untouched; restyle cart list, totals block (grand total `text-xl font-bold` in a bordered foot row), FEFO stock table pointer rows (`cursor-pointer hover:bg-slate-50`).
- [ ] **Step 7:** Tests (85/85 unchanged), build, lint green. Commit `style(web): Tailwind+shadcn restyle for operations pages`.

