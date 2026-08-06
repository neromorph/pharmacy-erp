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

