### Task 1: Route structure reorganization + root layout slimming

**Files:**
- Modify: `apps/web/app/layout.tsx` (strip chrome; keep html/body/globals.css + fonts)
- Move: all app page dirs from `apps/web/app/<dir>` to `apps/web/app/(app)/<dir>`
- Move: `apps/web/app/login` to `apps/web/app/(auth)/login`
- Move: `apps/web/app/receipts` to `apps/web/app/(print)/receipts`
- Create: `apps/web/app/(auth)/layout.tsx`
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/(print)/layout.tsx`

**Interfaces:**
- Consumes: existing pages (unchanged). Root `app/layout.tsx` currently holds all chrome — remove chrome from it.
- Produces: three group layouts. `(app)/layout.tsx` initially renders a placeholder `<main>{children}</main>` plus an empty sidebar div (real sidebar in Task 2). `(auth)/layout.tsx` wraps in `min-h-screen bg-slate-50`. `(print)/layout.tsx` is bare `{children}` (no chrome at all — thermal print).

- [ ] **Step 1: Slim the root layout**

Rewrite `apps/web/app/layout.tsx` to keep ONLY the html shell:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pharmacy ERP',
  description: 'POS, procurement, and stock for one branch tenant.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

Verify: check `globals.css` does not rely on the old header markup (it should style base elements only). If globals.css has `.header` classes, leave them — they become dead CSS, harmless.

- [ ] **Step 2: Create the three group layouts**

`apps/web/app/(auth)/layout.tsx`:

```tsx
// Auth shell: blank canvas, no app chrome, centered content area.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>
}
```

`apps/web/app/(app)/layout.tsx` (placeholder sidebar; Task 2 fleshes it out):

```tsx
// App shell: left sidebar + top header + main content.
// The real sidebar content lands in Task 2; this establishes the grid.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:block" />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
```

`apps/web/app/(print)/layout.tsx`:

```tsx
// Print shell: no chrome at all — receipts render bare for thermal output.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 3: Move route directories into groups**

Run from `apps/web`:

```bash
mkdir -p "app/(app)" "app/(auth)" "app/(print)"
git mv app/login "app/(auth)/login"
git mv app/receipts "app/(print)/receipts"
# Everything else app-route except api/, (auth), (app), (print), layout.tsx, globals.css, favicon, page.tsx (the dashboard root page)
git mv app/doctors app/finance app/kartu-stok app/patients app/procurement app/products app/reports app/sales app/settings app/shifts app/stock app/stock-opname app/suppliers "app/(app)/"
git mv app/page.tsx "app/(app)/page.tsx"
```

`app/api` stays at the root (unauthenticated machine endpoints, unaffected by layout groups anyway). Do NOT move `app/api`.

- [ ] **Step 4: Verify no broken imports**

Every moved page file currently imports via relative paths (`../../utils/...`, `../../../lib/...`). Since all pages moved exactly one directory level deeper, those relative imports break. Fix by searching every moved `*.tsx`/`*.ts` file for relative imports that now resolve incorrectly and adjust one level. Expected pattern changes:

```
../utils/    → ../../utils/
../../utils/ → ../../../utils/
../lib/      → ../../lib/
../../lib/   → ../../../lib/
```

Run: `cd apps/web && npx next build` and fix the reported import errors one file at a time until the build passes. (Alternative, if many: a careful sed over `app/(app)/**/*.tsx` replacing `from '../` → `from '../../'` etc. — verify with build either way.)

Wait — actually `app/(app)/<route>/page.tsx` is deeper by exactly one segment than `app/<route>/page.tsx`. So `../../utils/x` becomes `../../../utils/x`. Confirm with the build errors.

- [ ] **Step 5: Verify URLs unchanged**

`cd apps/web && npx next build` then confirm the build output route table still lists the same paths: `/`, `/login`, `/sales`, `/sales/new`, `/receipts/[saleId]`, `/procurement`, etc. Route groups must NOT appear in paths (Next strips parentheses-segments).

- [ ] **Step 6: Run full test suite**

`cd apps/web && npx vitest run` → 85/85 pass.

- [ ] **Step 7: Commit**

`git add -A apps/web && git commit -m "refactor(web): group routes into auth/app/print shells"`

---

