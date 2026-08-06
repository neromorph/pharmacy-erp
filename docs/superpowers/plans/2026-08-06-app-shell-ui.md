# UI Architecture (Auth/App/Print Shells) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat 15-link top nav with a production SaaS layout: grouped left sidebar, top header with shift status, and route groups separating auth, app, and print shells. URL paths must not change.

**Architecture:** Next.js App Router route groups `app/(auth)`, `app/(app)`, `app/(print)`. `(app)` holds all authenticated pages with the sidebar shell. `(auth)` holds login with a minimal layout. `(print)` holds receipts with a bare layout (thermal print). The root `app/layout.tsx` keeps only `<html>`/`<body>` and global CSS. Group layouts own the chrome. No URL changes (route groups are invisible).

**Tech Stack:** Next.js 16 App Router, Tailwind CSS, lucide-react (already installed), existing `/* */` CSS vars in `globals.css`.

## Global Constraints

- **Palette: Teal-600 `#0D9488` is primary** (project CONTEXT.md). NOT blue. Slate for neutrals.
- System fonts only — do not add font loading.
- **No URL changes.** Route groups `(auth)`/`(app)`/`(print)` must not alter any public path. Verify `/login`, `/`, `/sales/new`, `/receipts/[saleId]` still resolve at the same URLs.
- Keep every existing page component's behavior identical — only layouts/nav change. No logic edits inside page files.
- ASD-STE100 Simplified Technical English in comments.
- `pnpm` workspace: run web commands as `cd apps/web && npx vitest run` and `npx next build`.
- Keep the full test suite + build green after every task.
- Do not commit any `.env*` file.

## Design Contract (approved)

| Part | Choice |
|---|---|
| Subject | Pharmacy ERP, Indonesian branch staff |
| Palette | Teal-600 `#0D9488` primary, hover `#0F766E` (Teal-700), Slate neutrals |
| Type | System fonts |
| Layout | 256px sidebar + `h-14` top header, main `bg-slate-50 p-6` |
| Signature | Shift-aware status dot in header (green live dot + shift label when open, gray closed) |
| Risk | Sidebar groups mirror 7 domain areas even with 1-2 links each |
| Nav emphasis | `/sales/new` (POS cart) gets filled teal block — primary action |

## Module → Sidebar group mapping (approved)

| Sidebar group | Routes | lucide icon |
|---|---|---|
| Operations | `/` (Dashboard), `/sales` (Sales), `/shifts` (Shifts) + **emphasis block** `/sales/new` (POS) | LayoutDashboard, ShoppingCart, Clock |
| Inventory | `/products` (Products), `/kartu-stok` (Kartu Stok), `/stock-opname` (Stock Opname), `/stock/destructions` (Pemusnahan) | Package, ClipboardList, Boxes, Trash2 |
| Procurement | `/suppliers` (Suppliers), `/procurement` (Purchase Orders), `/procurement/returns` (Returns) | Truck, FileText, Undo2 |
| Finance | `/finance/payables` (Payables) | Wallet |
| Compliance | `/reports/sipnap` (SIPNAP) | ShieldCheck |
| Master Data | `/doctors` (Doctors), `/patients` (Patients) | Users |
| System | `/settings` (Settings) | Settings |

Excluded from sidebar: `/receipts/[saleId]` (print shell), `/sales/[id]` and other detail pages (navigated inline), `/api/*`.

---

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

### Task 2: Sidebar, top header, login card, atmosphere

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx` (wire in sidebar + header)
- Create: `apps/web/components/shell/Sidebar.tsx`
- Create: `apps/web/components/shell/TopHeader.tsx`
- Create: `apps/web/components/shell/shift-status.ts` (server helper that queries open shift for current tenant/user)
- Modify: `apps/web/app/(auth)/login/page.tsx` (redesign as centered card)

**Interfaces:**
- Consumes: `createClient()` from `@/utils/supabase/server` (cookie-scoped server client), `getUserRole` from `@/lib/auth` if present, the approved group map above.
- Produces: `Sidebar({ navGroups, activePath })` — client component using `usePathname`; `TopHeader({ shift, userEmail, userRole })` — server-fetched data passed in; `getOpenShift()` server helper returning `{ open: boolean; startedAt?: string }`.

- [ ] **Step 1: Write the shift status helper**

`apps/web/components/shell/shift.ts` (server-only):

```ts
import { createClient } from '@/utils/supabase/server'

export interface ShiftStatus {
  open: boolean
  openedAt: string | null
}

// One row per open shift for the current tenant user. First row only.
// shifts.status is an enum: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED'.
export async function getOpenShift(): Promise<ShiftStatus | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('shifts')
    .select('opened_at')
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return { open: false, openedAt: null }
  return { open: true, openedAt: data[0].opened_at }
}
```

Column names are REAL (from `supabase/migrations/20260804000000_create_shifts.sql`): `shifts.status` (enum with values OPEN/CLOSED/FORCE_CLOSED), `shifts.opened_at`, `shifts.closed_at`. Do NOT use started_at/ended_at — they do not exist.

- [ ] **Step 2: Build the Sidebar (client component)**

`apps/web/components/shell/Sidebar.tsx` — client component (`'use client'`, uses `usePathname`). Renders the approved groups with lucide icons. Active link: `bg-teal-50 text-teal-700`. Standard link: `text-slate-600 hover:bg-slate-100 hover:text-slate-900`. The POS entry `/sales/new` gets a filled block: `bg-teal-600 text-white rounded-md` at the top of the Operations group.

Structure per group: uppercase group label (`text-[11px] font-semibold tracking-wider text-slate-400 px-3`), then links (`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md`).

- [ ] **Step 3: Build the TopHeader (client + server split)**

`TopHeader` server component renders a client `<header>` with: mobile menu toggle (later — for now hide sidebar on mobile, show a simple Menu icon button that toggles nothing or a minimal drawer), the **shift status signature**: green live dot (`h-2 w-2 rounded-full bg-emerald-500 animate-pulse`) + "Shift open · HH:mm" when open, or gray dot `bg-slate-300` + "No shift" when closed. User chip on the right: email initial avatar `h-7 w-7 rounded-full bg-teal-100 text-teal-700 text-[11px] font-semibold` + role badge.

Keep mobile simple: sidebar hidden `hidden md:block`, header has a button that toggles an overlay sidebar (use local state in a small client wrapper). If a full drawer is too much for this task, ship the toggle button that does nothing visible yet and mark `ponytail:` with the upgrade path.

- [ ] **Step 4: Wire it into (app)/layout.tsx**

```tsx
import { createClient } from '@/utils/supabase/server'
import { getOpenShift } from '@/components/shell/shift'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopHeader } from '@/components/shell/TopHeader'
import { NAV_GROUPS } from '@/components/shell/nav-map'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shift = await getOpenShift()
  return (
    <div className="flex min-h-screen">
      <Sidebar groups={NAV_GROUPS} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader shift={shift} email={user?.email ?? ''} role={user?.app_metadata?.role ?? ''} />
        <main className="flex-1 bg-slate-50 p-6">{children}</main>
      </div>
    </div>
  )
}
```

`NAV_GROUPS` lives in `apps/web/components/shell/nav-map.ts` — the approved table above as a typed constant (group label + array of `{ href, label, icon }`).

- [ ] **Step 5: Redesign the login page**

Rewrite `apps/web/app/(auth)/login/page.tsx` as a centered card (`mx-auto max-w-sm mt-24 bg-white border border-slate-200 rounded-xl p-8 shadow-sm`): "Pharmacy ERP" title + "Sign in to your store" subtitle, email + password inputs (`w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500`), full-width primary button `bg-teal-600 hover:bg-teal-700 text-white rounded-md px-4 py-2 text-sm font-medium`. Keep the existing server action import and form action — do NOT change auth logic, only the markup/classes.

Verify the login page is a client or server component as it stands today and keep the same type; only swap CSS classes + add the card wrapper.

- [ ] **Step 6: Build + test + verify routes**

`cd apps/web && npx next build` — green; route table unchanged. `npx vitest run` — 85/85 (no new tests needed for pure layout; if a shell helper gets real logic, add one small vitest file).

- [ ] **Step 7: Manual smoke via local dev (optional) + commit**

`git add -A apps/web && git commit -m "feat(web): add sidebar shell, top header shift status, teal login card"`

---

### Task 3: Deploy + live E2E on the domain

**Files:** none (deploy + verification).

- [ ] **Step 1: Commit all work, deploy**

```bash
cd /Users/mufid/personal-projects/pharmacy-erp
rsync -az --delete --exclude node_modules --exclude .next --exclude .env --exclude .git ./ mufid@100.119.164.5:~/pharmacy-erp/
ssh mufid@100.119.164.5 'cd ~/pharmacy-erp && docker compose up -d --build web'
```

- [ ] **Step 2: Live E2E via firecrawl on https://pharmacy.nmrooms.biz.id**

- `GET /login` → 200, teal login card renders (screenshot).
- Login as `owner@mufid.dev` / `Test1234!` → lands on `/` dashboard with sidebar + header.
- Sidebar shows all 7 groups; `/sales/new` shows the filled teal block.
- Header shows shift status (open or closed) and the user chip with role OWNER.
- Navigate → `/sales`, `/kartu-stok`, `/settings` — URLs unchanged, page content renders inside the shell.
- `/receipts/<any-sale-id>` → renders WITHOUT sidebar (bare print shell).
- No 404s on any sidebar link.

- [ ] **Step 3: Local regression**

`cd apps/web && npx vitest run && npx next build` — green.

- [ ] **Step 4: Report**

Commit nothing (deploy only) unless a fix was needed; report findings.

---

## Self-Review

- **Spec coverage:** route groups (Task 1), sidebar+header+login (Task 2), deploy+E2E (Task 3). Navigation mapping per approved design contract.
- **Placeholder scan:** no TBD/TODO. Concrete Tailwind classes throughout; mobile drawer explicitly deferred with a `ponytail:` marker if the toggle ships inert.
- **Type consistency:** `ShiftStatus` interface defined once in shell/shift.ts (fields: `open`, `openedAt`) and used in TopHeader. `NAV_GROUPS` typed constant used in layout + Sidebar. Corrected after plan write: shift helper queries `status='OPEN'` + `opened_at` to match the real `shifts` table.
- **Risk noted:** URL-preserving route-group move is the riskiest step (many files move, relative imports shift one level). Mitigation: build errors pinpoint every broken import; URLs verified from build route table.
