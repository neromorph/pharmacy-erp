# Task 3 Report — app shell (sidebar, header, shift dot, redesigned login)

Status: DONE

## What was done

Created `apps/web/components/shell/` and `apps/web/components/brand/`:
- `nav-map.ts` — NAV_GROUPS: exact approved 7-group map (Operations, Inventory, Procurement, Finance, Compliance, Master Data, System) with labels/hrefs/primary flag on `/sales`.
- `brand/Logo.tsx` — server component, teal rounded square (`bg-primary`) + lucide `Pill` icon + name text, default "Pharmacy ERP", `name` prop.
- `shell/shift.ts` — async `getOpenShift()` querying `shifts` `.eq('status','OPEN')`, `opened_at` desc, maybeSingle; returns `{open, openedAt}`.
- `shell/SidebarNav.tsx` — `'use client'`, `usePathname()` active state; active = `border-l-2 border-primary bg-primary/5 text-primary font-medium`, default `text-slate-700 hover:bg-slate-100`; primary (`/sales`) = filled teal block `bg-primary text-white hover:bg-primary-hover`; per-item lucide icons via constant map (LayoutDashboard, ShoppingCart, Clock, Package, ScrollText, ClipboardCheck, Trash2, Truck, FileText, Undo2, Wallet, ShieldCheck, Stethoscope, Users, Settings); Dot fallback for unknown hrefs.
- `shell/Sidebar.tsx` — server component: Logo top, SidebarNav, tenant name footer (`tenants` query, graceful fallback "Pharmacy ERP").
- `shell/TopHeader.tsx` — sticky `h-14` header client-free server component receiving `user/tenant/shift` props from the layout; mobile Sheet (`SheetTrigger` + `SheetContent side=left` via shadcn base-nova) wrapping SidebarNav; tenant name (hidden mobile); shift dot — green pulse + "Shift open · HH:MM" when open, gray dot + "No open shift" otherwise; role `Badge` secondary; avatar circle with email initial.
- `app/(app)/layout.tsx` — trusted server component: `createClient()` + `auth.getUser()` + `getOpenShift()` + tenants query; fixed sidebar wrapper `hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r bg-white`; main column `md:pl-64` with TopHeader + `main p-6`.
- `app/(auth)/layout.tsx` — flat `bg-slate-50`, centered `max-w-md` column (no gradient).
- `app/(auth)/login/page.tsx` — server component, shadcn Card centered under brand block with tagline "Point of Sale · Stock · Compliance"; Label+Input email/password (autoComplete set); full-width teal `Button type=submit`; destructive error row from `?error=` searchParams; server action `import { login } from './actions'` preserved unchanged.

## Commands + output

- `cd apps/web && npx next build` → Compiled successfully; route table identical; `/login` and `/receipts/[saleId]` present; no errors.
- `cd apps/web && npx vitest run` → Test Files 12 passed (12), Tests 85 passed (85).
- `cd /Users/mufid/personal-projects/pharmacy-erp && pnpm -r lint` → Done for packages/domain, apps/api, apps/web.
- `git commit` → pre-commit hook ran lint + build + audit + trivy, passed. Commit `d2a1b31` (9 files, 387 insertions).

## Verification
- Build green, 85/85 tests green, `pnpm -r lint` (tsc per workspace) green.
- Route table unchanged; receipts file untouched (not in diff).
- Obsidian workspace.json noise excluded from commit.

## Concerns
- Sheet is the shadcn base-nova variant (Base UI `@base-ui/react/dialog`); `SheetTrigger` uses `render={<Button …>}` pattern — verified in the generated component API.
- No sidebar height overflow guard tested (long nav on short screens) — `overflow-y-auto` present on nav; E2E in Task 8 validates.
- Mobile shift dot text hidden below `sm:` breakpoint — intentional compaction.