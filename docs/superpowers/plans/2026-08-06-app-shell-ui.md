# App shell + full UI migration Implementation Plan (scope C)

> **For agentic workers:** REQUIRED SUPER-SKILL: Use superpowers:subagent-driven-development (if this plan was dispatched to implement or execute) or superpowers:executing-plans (if executing this plan in the current session) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the pharmacy-erp web app: route-group architecture (done), app shell with sidebar + top header, and a FULL migration of every page to Tailwind CSS v4 + shadcn/ui + lucide-react. Visual identity keeps the project palette (Teal/Emerald on Slate, light-first, compact).

**Description:** Next.js 16 (App Router, Turbopack) + Supabase SSR. Styling layer moves from inline styles + CSS vars to Tailwind v4 (CSS-first `@theme`) with shadcn/ui primitives and lucide icons. Palette: Primary `#0D9488` teal (hover `#0F766E`), success `#10B981`, slate neutrals. Bound palette (CONTEXT.md) — NOT blue. Grouped sidebar navigation, teal outline active markers, top header with tenant identity, role badge, shift-aware live status dot (signature), POS `/sales/new` emphasized as filled teal. Print pages (receipts) stay on their own thermal CSS — NOT rewritten to Tailwind.

**Tech stack (current):** pnpm 11 monorepo, apps/web = Next.js 16.2.12 + React 19 + @supabase/ssr, vitest. **New deps (apps/web):** `tailwindcss`, `@tailwindcss/postcss`, `lucide-react`, plus what `shadcn init`/`add` pulls (`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/*` per component).

**Version policy (user directive):** install every NEW package with `@latest` and record resolved versions in the report; also run `pnpm update --latest` inside `apps/web` for existing deps. **Exception (binding): `typescript` stays on 6.x** — TS 7 breaks Next 16 + ts-jest (AGENTS.md). If a latest major breaks the build and the fix is non-trivial, pin to the last working major and record it — do NOT silently skip the upgrade.

**Deployment:** VPS `mufid@100.119.164.5` → `~/pharmacy-erp/`; rsync + rebuild container `pharmacy-erp-web-1`. Live: `https://pharmacy.nmrooms.biz.id`.

## Global Constraints

- Follow project ASD-STE100 Simplified Technical English in code comments, commit messages, UI copy, docs.
- Never commit secrets. `.env.local` stays local.
- Next.js 16 + TypeScript 6.x. New deps only in `apps/web/package.json`.
- Do not touch `apps/api`, `packages/`, `supabase/` in this plan.
- Respect RLS: pages query through the JWT-scoped client (`utils/supabase/server.ts` exports async `createClient()`).
- Public URLs must not change. Route groups `(auth)`, `(app)`, `(print)` invisible in paths.
- All existing tests stay green: `cd apps/web && npx vitest run` → 85/85. lib pure helpers are NOT restyled.
- Receipts page (`(print)/receipts/[saleId]`) keeps its own thermal print CSS — do NOT rewrite it to Tailwind; only verify print styles still win over Tailwind preflight.
- Whether a route is gated by OWNER comes from `app_metadata.role` in the JWT — shell shows everything, pages keep their own gates (no new authorization work here).
- The `shifts` table real columns: `status` enum `shift_status` values `OPEN`, `CLOSED`, `FORCE_CLOSED`; `opened_at`, `closed_at` (see `supabase/migrations/20260804000000_create_shifts.sql`). Use those exact names.
- This repo has NO `@/` alias today — Task 2 adds it; new code may use `@/`, existing relative imports stay as they are.
- Pre-commit hook runs `pnpm run lint` (tsc per workspace) + `pnpm run build` + audit + trivy. Every commit must pass it.

## Findings to apply before/during work

- **Tailwind v4 on Next 16**: install `tailwindcss` + `@tailwindcss/postcss` in `apps/web`; create `apps/web/postcss.config.mjs` with `plugins: { "@tailwindcss/postcss": {} }`; in `app/globals.css` use `@import "tailwindcss";` and define custom colors under `@theme { --color-primary: #0d9488; … }` (CSS-first, no `tailwind.config.js`). Source: tailwindcss.com/docs/installation/framework-guides/nextjs + docs/colors.
- **shadcn**: requires the `@/*` alias in `apps/web/tsconfig.json` (`"baseUrl": "."`, `"paths": { "@/*": ["./*"] }`). Then `pnpm dlx shadcn@latest init` with components.json: `style: "base-nova"` (or default "new-york"), `rsc: true`, `tailwind.css: "app/globals.css"`, `baseColor: "slate"`, `cssVariables: true`. After that: `pnpm dlx shadcn@latest add button input label card badge table dialog sheet select textarea skeleton separator`. Source: ui.shadcn.com/docs/installation/next + docs/tailwind-v4.
- **Existing `apps/web/components/ui/button.tsx`** predates shadcn (hand-written). Task 2 replaces it with the generated shadcn Button (same path).
- **Existing `apps/web/app/globals.css`** owns CSS vars (`--primary: #0d9488` etc.) and element styles (`body`, `main`, tables). Task 2 rewrites it: keep the var VALUES under Tailwind `@theme` (and keep the raw vars via `@theme inline` bridging so any leftover inline-style code reading var(--primary) still works), add base body styles, keep any table/print helpers that receipts depend on (audit first).
- **Receipts page**: `apps/web/app/(print)/receipts/[saleId]/page.tsx` + its print CSS (thermal 80/58mm via `?w=`). Tailwind preflight (CSS reset) may strip its assumptions — Task 2 must scope-check receipts still print correctly; Task 7 re-verifies visually.
- **shifts columns**: `status`, `opened_at`, `closed_at`. Shift query: `.eq('status', 'OPEN')`, read `opened_at`.

## Approved visual systems (binding)

- **Layout:** `(app)` = left fixed sidebar `w-64` (256px, desktop) + top header `h-14` sticky + `main` (max-w-7xl, p-6, bg-slate-50). Mobile (`<md`): sidebar hidden, hamburger opens a shadcn `Sheet` (left drawer) with the same nav.
- **Typography:** system font stack (Inter fallback: `font-sans`), body 14px, card titles 16px semibold, h1 20-24px. 4px/8px spacing, compact table rows (`h-10`), `tabular-nums` for money.
- **Color token → utility mapping** (define in `@theme`): `--color-primary: #0d9488` → `bg-primary`, `text-primary`, `border-primary`; `--color-primary-hover: #0f766e`; keep `slate` grays default; semantic `emerald-500` success, `amber-500` warning, `red-500` danger (Tailwind defaults already close — don't redefine danger/warning unless a page needs the old var).
- **Component rules:** buttons = shadcn `Button` (primary default variant restyled to teal via CSS var override of `--primary` in shadcn's theme block); tables = shadcn `Table` with sticky header + right-aligned money + zebra hover; badges for status pills; cards = shadcn `Card`; forms = `Input`/`Label`/`Select`; dialogs for confirmations = `Dialog`.
- **Priority layers:** primary actions = filled teal; secondary = slate outline; POS `/sales/new` in sidebar = filled teal block.
- **Forbidden:** gradients, glows, glassmorphism, dark POS screens, purple/blue palette change, `transition: all`.

## Approved group navigation map

```ts
NAV_GROUPS = [
  { title: 'Operations', items: [{ label: 'Dashboard', href: '/' }, { label: 'Sales', href: '/sales', primary: true }, { label: 'Shifts', href: '/shifts' }] },
  { title: 'Inventory', items: [{ label: 'Products', href: '/products' }, { label: 'Kartu Stok', href: '/kartu-stok' }, { label: 'Stock Opname', href: '/stock-opname' }, { label: 'Pemusnahan', href: '/stock/destructions' }] },
  { title: 'Procurement', items: [{ label: 'Suppliers', href: '/suppliers' }, { label: 'Purchase Orders', href: '/procurement' }, { label: 'Returns', href: '/procurement/returns' }] },
  { title: 'Finance', items: [{ label: 'Payables', href: '/finance/payables' }] },
  { title: 'Compliance', items: [{ label: 'SIPNAP', href: '/reports/sipnap' }] },
  { title: 'Master Data', items: [{ label: 'Doctors', href: '/doctors' }, { label: 'Patients', href: '/patients' }] },
  { title: 'System', items: [{ label: 'Settings', href: '/settings' }] },
]
```

---

### Task 1: Route structure reorganization [COMPLETE]

Route groups `(auth)`, `(app)`, `(print)` + root layout slim. Commit `c60a13f`. Reviewer: spec ✅.

---

### Task 2: Foundation — Tailwind v4 + shadcn + lucide setup

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/postcss.config.mjs`, `apps/web/components.json`
- Modify: `apps/web/tsconfig.json` (add alias)
- Rewrite: `apps/web/app/globals.css`
- Generate/replace: `apps/web/components/ui/*` (shadcn), `apps/web/lib/utils.ts` (cn helper)
- Modify: `apps/web/.env`-adjacent none. `pnpm-lock.yaml` updates via install.

- [ ] **Step 1: Install Tailwind v4 + PostCSS plugin.**

Run in `apps/web`:
```bash
pnpm add -D tailwindcss@latest @tailwindcss/postcss@latest
pnpm add lucide-react@latest
pnpm update --latest   # bump existing web deps; revert/downgrade only if build breaks and record it
```

- [ ] **Step 2: `apps/web/postcss.config.mjs`.**

Exact:
```javascript
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

- [ ] **Step 3: Add `@/*` alias to `apps/web/tsconfig.json`.**

Merge into `compilerOptions` (keep everything else):
```json
"baseUrl": ".",
"paths": {
  "@/*": ["./*"]
}
```

- [ ] **Step 4: Rewrite `apps/web/app/globals.css`.**

Content shape (audit the current file first; preserve anything receipts need — e.g. thermal print classes, `@media print` blocks — by copying it to the bottom of the new file):

```css
@import "tailwindcss";

@theme {
  --color-primary: #0d9488;        /* Teal-600 — project primary */
  --color-primary-hover: #0f766e;  /* Teal-700 */
  --color-primary-foreground: #ffffff;
}

/* Bridge old raw vars so leftover inline styles keep working during migration. */
@theme inline {
  --color-surface: var(--surface);
  --color-card: var(--card);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-border: var(--border);
}

:root {
  --surface: #f8fafc;
  --card: #ffffff;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
}

html {
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

/* …preserve: existing table defaults, receipt thermal/print CSS, @media print blocks… */
```

Rules: no dark-mode work; drop the old `main { padding: 2rem }` global (layouts own padding now); keep `body` base background `bg-slate-50` via class on body in root layout instead of element selector.

- [ ] **Step 5: shadcn init + add components.**

In `apps/web`:
```bash
pnpm dlx shadcn@latest init -y -d   # -d defaults: new-york, slate base, CSS variables on
pnpm dlx shadcn@latest add button input label card badge table dialog sheet select textarea skeleton separator
```
If `init` is interactive or refuses (existing components/ui/button.tsx), delete that file first — it is replaced by the generated version. Ensure `components.json` `tailwind.css` points at `app/globals.css` and `aliases.ui` = `@/components/ui`, `aliases.lib` = `@/lib`. Verify `apps/web/lib/utils.ts` now exports `cn`.

- [ ] **Step 6: Root layout body class** — in `apps/web/app/layout.tsx` set `<body className="bg-slate-50 text-slate-900 antialiased">` (body stays the only html shell here; group layouts add their own wrappers).

- [ ] **Step 7: Verify.**

`cd apps/web && npx next build` green; `npx vitest run` 85/85; `pnpm -r lint` green (tsc). `git diff` shows no page file changes (visual restyle comes later). Receipts print CSS preserved (grep for `@media print` and thermal classes in the new globals.css).

- [ ] **Step 8: Commit.**

`feat(web): add Tailwind v4 + shadcn/ui + lucide-react foundation`

---

### Task 3: Shell — sidebar, top header, login card

**Files:**
- Create: `apps/web/components/shell/Sidebar.tsx`, `apps/web/components/shell/SidebarNav.tsx` (client), `apps/web/components/shell/TopHeader.tsx`, `apps/web/components/shell/shift.ts`, `apps/web/components/brand/Logo.tsx`, `apps/web/components/shell/nav-map.ts`
- Modify: `apps/web/app/(app)/layout.tsx`, `apps/web/app/(auth)/layout.tsx`
- Rewrite: `apps/web/app/(auth)/login/page.tsx`

- [ ] **Step 1: `components/shell/nav-map.ts`** — export `NAV_GROUPS` exactly as the approved map above.

- [ ] **Step 2: `components/brand/Logo.tsx`.**

Server component. Compact mark: teal rounded square (`size-8 rounded-md bg-primary text-white grid place-items-center`) with lucide `Pill` icon `size-5`, next to name text (`font-semibold text-slate-900`, default "Pharmacy ERP", prop `name`). No gradients.

- [ ] **Step 3: `components/shell/shift.ts`.**

```ts
import { createClient } from '@/utils/supabase/server'

export interface ShiftStatus {
  open: boolean
  openedAt: string | null
}

// Returns the currently open shift's status for the shift-aware dot in the header.
export async function getOpenShift(): Promise<ShiftStatus> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shifts')
    .select('status, opened_at')
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { open: !!data, openedAt: data?.opened_at ?? null }
}
```
(ponytail: re-verified — remote `shifts` columns are `status` + `opened_at`; checkouts with no open shift return `{ open: false, openedAt: null }`.)

- [ ] **Step 4: `components/shell/SidebarNav.tsx`** — `'use client'`, uses `usePathname()`, renders group label (`px-3 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500`), item links (`flex items-center gap-2 rounded-md px-3 py-2 text-sm`), active = `border-l-2 border-primary bg-primary/5 text-primary font-medium`, default = `text-slate-700 hover:bg-slate-100`, `primary: true` item (`/sales`) rendered as filled block `bg-primary text-white hover:bg-primary-hover font-medium`. lucide icons per item (`LayoutDashboard`, `ShoppingCart`, `Clock`, `Package`, `ScrollText`, `ClipboardCheck`, `Trash2`, `Truck`, `FileText`, `Undo2`, `Wallet`, `ShieldCheck`, `Stethoscope`, `Users`, `Settings`). Client component so Sheet reuse works.

- [ ] **Step 5: `components/shell/Sidebar.tsx` (server)** — renders `<Logo/>` top, `<SidebarNav/>`, tenant name footer (fetch tenant row name from `tenants`, graceful fallback).

- [ ] **Step 6: `components/shell/TopHeader.tsx` (server)** — sticky `h-14 border-b bg-white flex items-center gap-3 px-6`; children: mobile `SheetTrigger` (hamburger, `md:hidden`, wraps SidebarNav in Sheet), tenant name (`text-sm font-medium text-slate-900`, hidden mobile), shift dot (green `size-2 rounded-full bg-emerald-500 animate-pulse` when open + "Shift open · HH:MM" muted text; gray dot + "No open shift" otherwise), right side: `Badge` with user role (from JWT `app_metadata.role` via `getUserRole` in `@/utils/auth`), avatar circle with email initial (`size-7 rounded-full bg-slate-200 grid place-items-center text-xs font-medium`, placeholder `U`).

- [ ] **Step 7: `app/(app)/layout.tsx` rewrite:**

```tsx
import { createClient } from '@/utils/supabase/server'
import { getOpenShift } from '@/components/shell/shift'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopHeader } from '@/components/shell/TopHeader'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shift = await getOpenShift()
  const tenant = await supabase.from('tenants').select('name').limit(1).maybeSingle()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r bg-white">
        <Sidebar />
      </div>
      <div className="flex flex-col md:pl-64">
        <TopHeader
          user={{ email: user?.email ?? null, role: (user?.app_metadata?.role as string | undefined) ?? null }}
          tenant={{ name: tenant?.data?.name ?? null }}
          shift={shift}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: `(auth)/layout.tsx`** — `min-h-screen bg-gradient-to-b from-slate-50 to-slate-100`?? NO — flat `min-h-screen bg-slate-50`, `<div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">{children}</div>`.

- [ ] **Step 9: Login page rewrite** — centered shadcn `Card` (`w-full`), brand block above card (Logo centered, `text-3xl font-semibold` name, `text-sm text-slate-500` tagline "Point of Sale · Stock · Compliance"), card content: heading "Sign in" + description, email/password `Input` + `Label`, submit `Button` full width filled teal, server action unchanged (import from `./actions`), error row in destructive red (`text-sm text-destructive`).

- [ ] **Step 10: Verify** — build, 85/85 tests, `pnpm -r lint` green. Manual render check deferred to Task 8 E2E.

- [ ] **Step 11: Commit:**

`feat(ui): app shell (sidebar, header, shift dot, redesigned login)`

---

### Task 4: Restyle Operations pages

**Pages:** `(app)/page.tsx` (dashboard), `(app)/sales/page.tsx`, `(app)/sales/new/page.tsx` + its cart components (FEFO table included), `(app)/sales/[id]/page.tsx`, `(app)/shifts/page.tsx`, `(app)/shifts/new/page.tsx`, `(app)/shifts/[id]/page.tsx`.

- [ ] **Step 1:** Replace inline styles with Tailwind classes: page container `space-y-6`, h1 `text-xl font-semibold text-slate-900`, muted `text-sm text-slate-500`.
- [ ] **Step 2:** Buttons → shadcn `Button` (`variant="default"` = teal for primary, `outline` secondary, `destructive` void). Links-as-buttons wrap `<Link>` inside `<Button asChild>`.
- [ ] **Step 3:** Tables → shadcn `Table` family, sticky header `bg-slate-50`, rows `h-10`, money cells `text-right tabular-nums`, status pills → `Badge` (variants: default/secondary/destructive/outline).
- [ ] **Step 4:** Forms → `Label` + `Input` stacked (`grid gap-1.5`), selects → shadcn `Select` where practical (native `<select>` styled `h-9 rounded-md border px-2` acceptable where the shadcn Select adds no value — radix select in compact POS flows is heavy; ponytail: keep native selects unless a11y requires).
- [ ] **Step 5:** Dashboard KPI cards → shadcn `Card` row (`grid gap-4 sm:grid-cols-3`), value `text-2xl font-semibold tabular-nums`, delta/subtext `text-sm text-slate-500`, lucide icons top-right muted.
- [ ] **Step 6:** POS `/sales/new` — keep current client logic untouched; restyle cart list, totals block (grand total `text-xl font-bold` in a bordered foot row), FEFO stock table pointer rows (`cursor-pointer hover:bg-slate-50`).
- [ ] **Step 7:** Tests (85/85 unchanged), build, lint green. Commit `style(web): Tailwind+shadcn restyle for operations pages`.

### Task 5: Restyle Inventory pages

**Pages:** `(app)/products/page.tsx`, `(app)/kartu-stok/page.tsx`, `(app)/stock-opname/page.tsx` + `/new` + `/[id]`, `(app)/stock/destructions/page.tsx` + `/new` + `/[id]`.

- [ ] **Steps:** same playbook as Task 4 (containers, h1, buttons, tables, badges, forms via the shared rules); kartu stok ledger table gets `font-mono`-free numeric right columns; batch view rows grouped by product header row `bg-slate-50 font-medium`. Tests + build + lint green. Commit `style(web): Tailwind+shadcn restyle for inventory pages`.

### Task 6: Restyle Procurement pages

**Pages:** `(app)/suppliers/page.tsx` + `/[id]`, `(app)/procurement/page.tsx` + `/new` + `/[id]` + `/[id]/receive`, `(app)/procurement/returns/page.tsx` + `/new` + `/[id]`.

- [ ] **Steps:** same playbook; PO status machine pills map DRAFT→outline, PENDING_APPROVAL→secondary, APPROVED→default, RECEIVED→secondary, CANCELLED→destructive; receive page qty inputs compact `w-24`. Tests + build + lint green. Commit `style(web): Tailwind+shadcn restyle for procurement pages`.

### Task 7: Restyle Finance, Compliance, Master Data, System + receipts print check

**Pages:** `(app)/finance/payables/page.tsx`, `(app)/reports/sipnap/page.tsx`(s), `(app)/doctors/page.tsx`, `(app)/patients/page.tsx`, `(app)/settings/page.tsx`. Verify `(print)/receipts/[saleId]/page.tsx` print styles unaffected by Tailwind preflight (load with `?w=80`, inspect @media print output).

- [ ] **Steps:** same playbook; payout form in a `Dialog` (keep server action `postPayout` contract); SIPNAP download link = `Button asChild` outline; settings form in a `Card` with submit `Button`. Receipts: if preflight broke any thermal style, add missing rules to globals.css print section (do NOT rewrite receipt markup to Tailwind). Tests + build + lint green. Commit `style(web): Tailwind+shadcn restyle for finance/compliance/master/system pages`.

### Task 8: Deploy + live E2E + docs

- [ ] **Step 1: Deploy.**
```bash
rsync -az --delete --exclude node_modules --exclude .next --exclude .env --exclude .git ./ mufid@100.119.164.5:~/pharmacy-erp/
ssh mufid@100.119.164.5 "cd ~/pharmacy-erp && docker compose up -d --build web"
ssh mufid@100.119.164.5 "docker inspect --format '{{.State.Status}}' pharmacy-erp-web-1"
curl -s -o /dev/null -w "%{http_code}" https://pharmacy.nmrooms.biz.id/login  # expect 200 or 307→200
curl -s -o /dev/null -w "%{http_code}" https://pharmacy.nmrooms.biz.id         # expect 307 to /login
```

- [ ] **Step 2: Browser E2E on the domain via firecrawl interact (never localhost):**
  `https://pharmacy.nmrooms.biz.id/login` — credentials `owner@mufid.dev` / `Test1234!`.
  1. Login page: new card design renders, teal primary button.
  2. Login → dashboard: sidebar with 7 groups visible, POS `/sales` item filled teal.
  3. Top header: tenant name, OWNER role badge, gray "No open shift" dot (or green when open).
  4. Navigation: click `/finance/payables` (Finance) and `/procurement` (Procurement) — pages render restyled tables.
  5. Open one sale detail `/sales/[id]` and its receipt `/receipts/[saleId]` — receipt thermal layout intact.
  6. Mobile check (viewport 390px): hamburger opens Sheet nav. (If firecrawl viewport control unavailable, DOM check for `md:hidden` trigger suffices.)
  Report outcome + screenshots.

- [ ] **Step 3: Docs sync** — update `pharmacy-erp-vault/CONTEXT.md` UI section: Tailwind v4 + shadcn/ui + lucide-react now the styling layer, palette unchanged; AGENTS.md status lines mention the shell. Commit `docs: ui stack is now Tailwind v4 + shadcn`.

- [ ] **Step 4: Commit + deploy + verify done.**

## Self-review notes

- Task 1 already complete (no rework).
- Task 2 Step 5 deletes hand-written `components/ui/button.tsx` — generated counterpart replaces it.
- Task 2 Step 6 sets body class in root layout; group layouts do not re-set it.
- Table/print helpers in old globals.css MUST be audited before rewrite (receipts depend on them).
- Receipts page is the only Tailwind-exempt page (thermal print CSS is load-bearing).
- Base-cadnce: every task ends with build + 85/85 tests + `pnpm -r lint` green (pre-commit enforces it too).
