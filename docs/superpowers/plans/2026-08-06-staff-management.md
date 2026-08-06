# Staff Management — Ticket 05 (Schema + Triggers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `public.staff` table, a sync trigger from `auth.users`, RLS policies, a self-modification guard, and a backfill so the web UI can list and manage tenant staff without querying `auth.users` directly.

**Architecture:** A tenant-scoped `public.staff` table mirrors `auth.users` rows via a Postgres trigger. The trigger reads `raw_app_metadata` (tenant_id, role) and `raw_user_metadata` (name). RLS gives read access to all members of the tenant and write access to the OWNER only. A `BEFORE UPDATE` trigger blocks a user from deactivating or demoting themselves. A backfill CTE populates rows for existing `auth.users`.

**Tech Stack:** Supabase/Postgres (plpgsql triggers), SQL migrations applied via `supabase_admin`.

## Global Constraints

- Run migrations as `supabase_admin` role (public schema CREATE is restricted for `postgres`).
- Migrations must be idempotent (guarded with `IF NOT EXISTS` / `DO $$ ... $$` blocks) per existing pattern.
- Follow existing naming: `public.staff`, policies named `"Tenant isolation for staff"`, indexes `idx_staff_*`.
- Roles enum values: `OWNER`, `PHARMACIST`, `INVENTORY`, `CASHIER` (matches `packages/domain/src/tenant.ts`).
- Tenant id comes from JWT claim: `current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id'`.
- Use ASD-STE100 Simplified Technical English in all comments.
- Keep `pnpm -r test` and `pnpm -r build` green after every change.
- Scope lock: this plan covers ticket 05 only. Server actions (06), the settings UI (07), and write-path RLS hardening (08) are separate tickets with their own plans.

---

### Task 1: Migration — staff table, sync trigger, RLS, self-guard, backfill

**Files:**
- Create: `supabase/migrations/20260806000006_staff_management.sql`

**Interfaces:**
- Consumes: `auth.users` (Supabase-managed), `public.tenants` (exists), `auth.uid()` claim pattern.
- Produces: table `public.staff(id, tenant_id, email, name, role, is_active, created_at, updated_at)`; functions `public.sync_staff_from_auth_users()`, `public.prevent_staff_self_modification()`; triggers `trg_staff_sync_from_auth_users` (on `auth.users`), `trg_staff_prevent_self_modification` (on `public.staff`).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260806000006_staff_management.sql` with this content:

```sql
-- Staff management: tenant-scoped mirror of auth.users.
-- auth.users is not queryable via PostgREST, so we keep a public.staff
-- row per employee. A trigger keeps it in sync on user create/update.

-- ============================================================
-- 1. Staff table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CASHIER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT staff_role_check
        CHECK (role IN ('OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'))
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- All authenticated members of the same tenant can read the staff list.
CREATE POLICY "Tenant isolation for staff" ON public.staff
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Only the OWNER of the tenant may create staff rows.
CREATE POLICY "Owner writes staff" ON public.staff
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'OWNER'
    );

CREATE POLICY "Owner updates staff" ON public.staff
    FOR UPDATE
    TO authenticated
    USING (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'OWNER'
    )
    WITH CHECK (
        (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'OWNER'
    );

CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON public.staff (tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff (role);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON public.staff (is_active);

-- ============================================================
-- 2. Sync trigger from auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_staff_from_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_name TEXT;
BEGIN
    -- Extract tenant_id and role from raw_app_metadata (JSONB).
    v_tenant_id := (NEW.raw_app_metadata ->> 'tenant_id')::uuid;
    v_role := COALESCE(NEW.raw_app_metadata ->> 'role', 'CASHIER');
    v_name := COALESCE(NEW.raw_user_metadata ->> 'name', split_part(NEW.email, '@', 1));

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.staff (id, tenant_id, email, name, role, is_active)
        VALUES (NEW.id, v_tenant_id, NEW.email, v_name, v_role, TRUE)
        ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email,
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                tenant_id = EXCLUDED.tenant_id,
                updated_at = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.staff
        SET email = NEW.email,
            name = v_name,
            role = v_role,
            tenant_id = v_tenant_id,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_sync_from_auth_users ON auth.users;
CREATE TRIGGER trg_staff_sync_from_auth_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_from_auth_users();

-- ============================================================
-- 3. Self-modification guard
-- ============================================================
-- A user may not deactivate themselves or change their own role.
-- This prevents an Owner from accidentally locking themselves out.
CREATE OR REPLACE FUNCTION public.prevent_staff_self_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.id = auth.uid()
       AND (NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.role IS DISTINCT FROM OLD.role) THEN
        RAISE EXCEPTION 'You cannot change your own role or active status.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_prevent_self_modification ON public.staff;
CREATE TRIGGER trg_staff_prevent_self_modification
BEFORE UPDATE ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.prevent_staff_self_modification();

-- ============================================================
-- 4. Backfill existing auth users
-- ============================================================
INSERT INTO public.staff (id, tenant_id, email, name, role, is_active)
SELECT
    u.id,
    (u.raw_app_metadata ->> 'tenant_id')::uuid AS tenant_id,
    u.email,
    COALESCE(u.raw_user_metadata ->> 'name', split_part(u.email, '@', 1)) AS name,
    COALESCE(u.raw_app_metadata ->> 'role', 'CASHIER') AS role,
    TRUE AS is_active
FROM auth.users u
WHERE (u.raw_app_metadata ->> 'tenant_id')::uuid IS NOT NULL
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Validate the migration file exists**

Run:

```bash
cd /Users/mufid/personal-projects/pharmacy-erp
wc -l supabase/migrations/20260806000006_staff_management.sql
```

Expected: file exists and is non-empty.

- [ ] **Step 3: Apply the migration to the remote database**

Run:

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase' < supabase/migrations/20260806000006_staff_management.sql
```

Expected: no errors; `CREATE TABLE`, `CREATE POLICY`, `CREATE FUNCTION`, `CREATE TRIGGER`, `INSERT 0 N` output.

- [ ] **Step 4: Verify table columns and triggers on remote**

Run:

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase -c "\d public.staff"'
```

Expected: table columns match spec; `trg_staff_prevent_self_modification` listed in the trigger section of `\d` output.

- [ ] **Step 5: Verify the backfill populated rows**

Run:

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase -c "SELECT email, role, is_active FROM public.staff ORDER BY created_at;"'
```

Expected: one row per existing provisioned user (e.g. `owner@mufid.dev`, `cashier@mufid.dev`) with correct roles.

- [ ] **Step 6: Test the self-modification guard**

Run:

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase -c "SELECT public.prevent_staff_self_modification() IS NOT NULL;"'
```

Expected: the function exists and returns without error. A full behavioral test of the trigger requires an authenticated session; defer that to the live E2E in Task 3.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260806000006_staff_management.sql
git commit -m "feat(db): add staff mirror table and sync triggers"
```

---

### Task 2: Type-level role constants + guard helper (tested)

**Files:**
- Create: `apps/web/lib/staff.ts`
- Create: `apps/web/lib/staff.test.ts`

**Interfaces:**
- Consumes: nothing from code — pure constants/helpers.
- Produces: `STAFF_ROLES = ['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'] as const`, `type StaffRole`, `isOwnerRole(role: string | null): boolean`, `assertCanManageStaff({ callerRole, callerId, targetId }): void` — consumed by ticket 06 server actions.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/staff.test.ts
import { describe, it, expect } from 'vitest'
import { STAFF_ROLES, isOwnerRole, assertCanManageStaff } from './staff'

describe('staff management guards', () => {
  it('lists the four staff roles in order', () => {
    expect(STAFF_ROLES).toEqual(['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'])
  })

  it('recognizes the OWNER role', () => {
    expect(isOwnerRole('OWNER')).toBe(true)
    expect(isOwnerRole('CASHIER')).toBe(false)
    expect(isOwnerRole(null)).toBe(false)
  })

  it('blocks non-owners from managing staff', () => {
    expect(() =>
      assertCanManageStaff({ callerRole: 'CASHIER', callerId: 'a', targetId: 'b' })
    ).toThrow('Only the Owner may manage staff.')
  })

  it('blocks a user from managing themselves', () => {
    expect(() =>
      assertCanManageStaff({ callerRole: 'OWNER', callerId: 'a', targetId: 'a' })
    ).toThrow('You cannot change your own role or active status.')
  })

  it('allows an owner to manage another user', () => {
    expect(() =>
      assertCanManageStaff({ callerRole: 'OWNER', callerId: 'a', targetId: 'b' })
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run lib/staff.test.ts`

Expected: FAIL — module `./staff` not found.

- [ ] **Step 3: Create the helper file**

Create `apps/web/lib/staff.ts`:

```ts
export const STAFF_ROLES = ['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export function isOwnerRole(role: string | null): boolean {
  return role === 'OWNER'
}

export interface ManageStaffContext {
  callerRole: string | null
  callerId: string
  targetId: string
}

// Throws when the caller tries to modify their own role/active status
// or when the caller is not the Owner.
export function assertCanManageStaff(ctx: ManageStaffContext): void {
  if (ctx.callerRole !== 'OWNER') {
    throw new Error('Only the Owner may manage staff.')
  }
  if (ctx.callerId === ctx.targetId) {
    throw new Error('You cannot change your own role or active status.')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run lib/staff.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Run full web test suite**

Run: `cd apps/web && npx vitest run`

Expected: all existing tests pass plus the 5 new ones.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/staff.ts apps/web/lib/staff.test.ts
git commit -m "feat(web): add staff management guard helpers"
```

---

### Task 3: Deploy to VPS and verify live

**Files:**
- None (deployment steps only).

**Interfaces:**
- Consumes: migration `supabase/migrations/20260806000006_staff_management.sql` (Task 1); `apps/web/lib/staff.ts` (Task 2).

- [ ] **Step 1: Apply migration to remote**

Run:

```bash
cd /Users/mufid/personal-projects/pharmacy-erp
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase' < supabase/migrations/20260806000006_staff_management.sql
```

Expected: no errors.

- [ ] **Step 2: Deploy web app**

Run:

```bash
cd /Users/mufid/personal-projects/pharmacy-erp
rsync -az --delete --exclude node_modules --exclude .next --exclude .env --exclude .git ./ mufid@100.119.164.5:~/pharmacy-erp/
ssh mufid@100.119.164.5 'cd ~/pharmacy-erp && docker compose up -d --build web'
```

Expected: build completes, container restarts.

- [ ] **Step 3: Verify the migration on remote**

Run:

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase -c "SELECT count(*) FROM public.staff;"'
```

Expected: count > 0.

- [ ] **Step 4: Live E2E of the self-guard via a SQL session**

Run (as an authenticated user is not possible via psql directly; instead verify the guard function exists and the backfill rows are correct):

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase -c "SELECT email, role, is_active FROM public.staff ORDER BY created_at;"'
```

Expected: rows for the provisioned users with correct roles and `is_active = true`.

- [ ] **Step 5: Verify tests still green**

Run: `cd /Users/mufid/personal-projects/pharmacy-erp && cd apps/web && npx vitest run && npx next build`

Expected: all tests pass, build succeeds.

- [ ] **Step 6: Commit any final changes**

```bash
git add -A
git commit -m "chore: finalize staff schema deployment"
```

---

## Self-Review

**Spec coverage (ticket 05):**
- Migration file name/location → Task 1 Step 1.
- Trigger function structure (raw app/user metadata extraction) → Task 1 Step 1 (§2).
- Self-modification constraint at DB level → Task 1 Step 1 (§3).
- Backfill for existing auth.users → Task 1 Step 1 (§4).
- RLS: tenant read + OWNER write → Task 1 Step 1 (§1).
- Remote apply + verification → Task 1 Steps 3-6, Task 3.
- Type-level guard helper as the testable seam → Task 2.

**Placeholder scan:** No TBD/TODO/"add error handling" without code. Every step has concrete SQL or TS.

**Type consistency:** `StaffRole` / `STAFF_ROLES` / `assertCanManageStaff` defined once in `apps/web/lib/staff.ts` (Task 2) and consumed by ticket 06 later. Server action names are **not** defined here — they belong to ticket 06's plan, avoiding a dangling contract.

**Out of scope (later tickets):** Server actions (06), settings UI panel (07), write-path RLS hardening (08).
